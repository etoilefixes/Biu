// ============================================================
// Biu Auto-Optimizer — R-02: npm audit + .env 密钥扫描
// ============================================================

import { BaseAnalyzer } from './base.js';
import type { BiuOptConfig } from '../config/types.js';
import type { AnalysisResult } from '../types/analysis.js';
import { AnalysisCategory, Severity } from '../types/analysis.js';
import { exec } from '../utils/exec.js';
import { debug, warn } from '../utils/logger.js';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import fastGlob from 'fast-glob';

/**
 * npm audit JSON 输出结构
 */
interface NpmAuditAdvisory {
  findings: Array<{
    version: string;
    paths: string[];
  }>;
  id: number;
  created: string;
  updated: string;
  deleted?: boolean;
  title: string;
  found_by: { name: string };
  reported_by: { name: string };
  module_name: string;
  cves: string[];
  vulnerable_versions: string;
  patched_versions: string;
  overview: string;
  recommendation: string;
  references: string;
  access: string;
  severity: 'critical' | 'high' | 'moderate' | 'low';
  cwe: string;
  metadata: {
    module_type: string;
    exploitability: number;
    affected_components: string;
  };
  url: string;
}

interface NpmAuditOutput {
  auditReportVersion: number;
  vulnerabilities: Record<string, NpmAuditAdvisory>;
  metadata: {
    vulnerabilities: {
      info: number;
      low: number;
      moderate: number;
      high: number;
      critical: number;
      total: number;
    };
    dependencies: { prod: number; dev: number; optional: number; peer: number; peerOptional: number; total: number };
  };
}

/**
 * SecurityAnalyzer
 *
 * 并行执行三个安全扫描：
 * 1. npm audit --json → 已知漏洞检查
 * 2. .env / .env.local 文件密钥泄漏扫描
 * 3. 源代码硬编码密钥检测
 */
export class SecurityAnalyzer extends BaseAnalyzer {
  readonly id = 'security-scan';
  readonly category = AnalysisCategory.security;

  protected async run(config: BiuOptConfig): Promise<AnalysisResult[]> {
    const rootDir = resolve(config.rootDir);

    const [auditResults, envResults, hardcodedResults] = await Promise.all([
      this.runNpmAudit(rootDir),
      this.scanEnvFiles(rootDir, config.workspaces),
      this.scanHardcodedKeys(rootDir, config.workspaces),
    ]);

    // 按 advisory URL 去重 npm audit 结果
    const uniqueAuditResults = this.deduplicateByUrl(auditResults);

    return [...uniqueAuditResults, ...envResults, ...hardcodedResults];
  }

  // ---- npm audit ----

  private async runNpmAudit(rootDir: string): Promise<AnalysisResult[]> {
    try {
      const result = await exec('npm', ['audit', '--json'], {
        cwd: rootDir,
        timeout: 120_000,
      });

      if (!result.stdout) {
        debug('[security-scan] npm audit: 无输出');
        return [];
      }

      const auditOutput = JSON.parse(result.stdout) as NpmAuditOutput;

      // npm audit 成功无漏洞时返回 { "auditReportVersion": 2, ... } 而非 { "vulnerabilities": {} }
      if (!auditOutput.vulnerabilities) {
        debug('[security-scan] npm audit: 未发现漏洞');
        return [];
      }

      return this.parseNpmAuditResults(auditOutput.vulnerabilities);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      warn(`[security-scan] npm audit 执行失败: ${msg}`);
      return [];
    }
  }

  private parseNpmAuditResults(
    vulnerabilities: Record<string, NpmAuditAdvisory>,
  ): AnalysisResult[] {
    const results: AnalysisResult[] = [];
    let counter = 0;

    for (const [pkgName, advisory] of Object.entries(vulnerabilities)) {
      if (advisory.deleted) continue;

      const severity = this.mapAuditSeverity(advisory.severity);
      const affectedPaths = advisory.findings.flatMap((f) => f.paths).slice(0, 5);

      results.push({
        id: `npm-audit-${String(counter++).padStart(4, '0')}`,
        analyzerId: this.id,
        category: this.category,
        severity,
        message: `[${pkgName}] ${advisory.title}`,
        suggestion: advisory.recommendation || `升级到 ${advisory.patched_versions}`,
        rule: advisory.cves.length > 0 ? advisory.cves[0] : undefined,
        metadata: {
          package: pkgName,
          advisoryUrl: advisory.url,
          vulnerableVersions: advisory.vulnerable_versions,
          patchedVersions: advisory.patched_versions,
          cves: advisory.cves,
          cwe: advisory.cwe,
          exploitability: advisory.metadata?.exploitability,
          affectedPaths,
        },
      });
    }

    return results;
  }

  private mapAuditSeverity(severity: string): Severity {
    switch (severity) {
      case 'critical':
        return Severity.critical;
      case 'high':
        return Severity.high;
      case 'moderate':
        return Severity.moderate;
      case 'low':
        return Severity.low;
      default:
        return Severity.info;
    }
  }

  /**
   * 按 advisory URL 去重
   */
  private deduplicateByUrl(results: AnalysisResult[]): AnalysisResult[] {
    const seen = new Set<string>();
    return results.filter((r) => {
      const url = (r.metadata as Record<string, unknown>)?.advisoryUrl as string | undefined;
      if (!url) return true;
      if (seen.has(url)) return false;
      seen.add(url);
      return true;
    });
  }

  // ---- .env 文件密钥泄漏扫描 ----

  private async scanEnvFiles(
    rootDir: string,
    workspaces: string[],
  ): Promise<AnalysisResult[]> {
    const results: AnalysisResult[] = [];
    const dirs = [rootDir, ...workspaces.map((ws) => resolve(rootDir, ws))];

    // 密钥模式: key_name = "value" 或 key_name=value
    const secretPattern = /(apiKey|secret|password|token|key)\s*[:=]\s*["'][^"'\n]{4,}["']/gi;

    let counter = 0;

    for (const dir of dirs) {
      for (const filename of ['.env', '.env.local']) {
        const filePath = resolve(dir, filename);
        try {
          const content = await readFile(filePath, 'utf-8');
          const lines = content.split('\n');

          for (let lineNum = 0; lineNum < lines.length; lineNum++) {
            const line = lines[lineNum];
            // 跳过空行和注释
            const trimmed = line.trim();
            if (trimmed === '' || trimmed.startsWith('#')) continue;

            // 检测密钥模式
            secretPattern.lastIndex = 0;
            let match: RegExpExecArray | null;
            while ((match = secretPattern.exec(line)) !== null) {
              const keyName = match[1]?.toLowerCase() ?? '';
              // 仅标记非示例值
              const value = match[0];
              if (value.includes('your_') || value.includes('example') || value.includes('xxx') || value.includes('test_')) {
                continue;
              }

              results.push({
                id: `env-secret-${String(counter++).padStart(4, '0')}`,
                analyzerId: this.id,
                category: this.category,
                severity: Severity.high,
                file: filePath,
                line: lineNum + 1,
                message: `环境变量文件中发现疑似硬编码密钥: ${keyName}`,
                suggestion: '请使用环境变量注入或密钥管理服务替代硬编码',
                metadata: { keyName, fileName: filename },
              });
            }
          }
        } catch {
          // 文件不存在，跳过
        }
      }
    }

    return results;
  }

  // ---- 源代码硬编码密钥扫描 ----

  private async scanHardcodedKeys(
    rootDir: string,
    workspaces: string[],
  ): Promise<AnalysisResult[]> {
    const results: AnalysisResult[] = [];
    const wsPatterns = workspaces.map((ws) => `${ws}/**/*.{ts,tsx,js,jsx}`);
    const patterns = [
      ...wsPatterns,
      '!**/node_modules/**',
      '!**/.biu-opt/**',
      '!**/*.test.{ts,tsx,js}',
      '!**/*.spec.{ts,tsx,js}',
    ];

    // 高风险模式
    const highRiskPatterns: Array<{ pattern: RegExp; description: string }> = [
      {
        pattern: /["']sk-[a-zA-Z0-9]{20,}["']/g,
        description: '疑似 OpenAI API Key',
      },
      {
        pattern: /["']-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/g,
        description: '疑似私钥硬编码',
      },
      {
        pattern: /["']ghp_[a-zA-Z0-9]{36}["']/g,
        description: '疑似 GitHub Personal Access Token',
      },
      {
        pattern: /["']eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{0,}["']/g,
        description: '疑似 JWT Token 硬编码',
      },
    ];

    let counter = 0;

    try {
      const files = await fastGlob(patterns, { cwd: rootDir, absolute: true });

      for (const filePath of files) {
        try {
          const content = await readFile(filePath, 'utf-8');
          const lines = content.split('\n');

          for (let lineNum = 0; lineNum < lines.length; lineNum++) {
            const line = lines[lineNum];

            for (const { pattern, description } of highRiskPatterns) {
              pattern.lastIndex = 0;
              let match: RegExpExecArray | null;
              while ((match = pattern.exec(line)) !== null) {
                results.push({
                  id: `hardcoded-key-${String(counter++).padStart(4, '0')}`,
                  analyzerId: this.id,
                  category: this.category,
                  severity: Severity.critical,
                  file: filePath,
                  line: lineNum + 1,
                  message: `${description} (行 ${lineNum + 1})`,
                  suggestion: '请移除硬编码密钥，改用环境变量或密钥管理服务',
                  metadata: {
                    pattern: description,
                    snippet: match[0].substring(0, 20) + '...',
                  },
                });
              }
            }
          }
        } catch {
          // 读取失败，跳过
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      warn(`[security-scan] 硬编码密钥扫描失败: ${msg}`);
    }

    return results;
  }
}
