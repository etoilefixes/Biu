// ============================================================
// Biu Auto-Optimizer — R-01: ESLint + TypeScript 严格模式扫描
// ============================================================

import { BaseAnalyzer } from './base.js';
import type { BiuOptConfig } from '../config/types.js';
import type { AnalysisResult } from '../types/analysis.js';
import { AnalysisCategory, Severity } from '../types/analysis.js';
import { exec } from '../utils/exec.js';
import { debug, warn } from '../utils/logger.js';
import { resolve } from 'node:path';

/**
 * ESLint JSON 输出的单条消息结构
 */
interface EslintMessage {
  ruleId: string | null;
  severity: number; // 1 = warn, 2 = error
  message: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  nodeType?: string;
  fix?: { range: [number, number]; text: string };
  suggestions?: Array<{ desc: string; fix: { range: [number, number]; text: string } }>;
}

/**
 * ESLint JSON 输出的文件结果
 */
interface EslintFileResult {
  filePath: string;
  messages: EslintMessage[];
  errorCount: number;
  warningCount: number;
  fatalErrorCount: number;
}

/**
 * ESLint JSON 输出的顶层结构
 */
type EslintOutput = EslintFileResult[];

/**
 * CodeReviewAnalyzer
 *
 * 并行运行：
 * 1. npx eslint . --format json → 解析结构化 Lint 结果
 * 2. npx tsc --noEmit --strict → 解析 TS 严格模式错误
 *
 * 将两者规范化为统一的 AnalysisResult[] 输出。
 */
export class CodeReviewAnalyzer extends BaseAnalyzer {
  readonly id = 'code-review';
  readonly category = AnalysisCategory['code-quality'];

  protected async run(config: BiuOptConfig): Promise<AnalysisResult[]> {
    const rootDir = resolve(config.rootDir);
    const eslintResults = await this.runEslint(rootDir, config);
    const tscResults = await this.runTsc(rootDir);

    // 合并并过滤
    const allResults = [...eslintResults, ...tscResults];
    return this.filterExcluded(allResults, rootDir);
  }

  // ---- ESLint ----

  private async runEslint(rootDir: string, config: BiuOptConfig): Promise<AnalysisResult[]> {
    const eslintConfig = config.analyzers['code-review']?.options?.eslintConfig;
    const args = ['.', '--format', 'json'];
    if (eslintConfig) {
      args.push('--config', eslintConfig);
    }

    try {
      const result = await exec('npx', ['eslint', ...args], { cwd: rootDir });
      if (!result.stdout) {
        debug('[code-review] ESLint: 无输出');
        return [];
      }

      const eslintOutput = JSON.parse(result.stdout) as EslintOutput;
      if (!Array.isArray(eslintOutput)) {
        warn('[code-review] ESLint 输出格式异常');
        return [];
      }

      return this.parseEslintResults(eslintOutput);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      warn(`[code-review] ESLint 执行失败: ${msg}`);
      return [];
    }
  }

  private parseEslintResults(files: EslintOutput): AnalysisResult[] {
    const results: AnalysisResult[] = [];
    let counter = 0;

    for (const file of files) {
      for (const msg of file.messages) {
        const severity = this.mapEslintSeverity(msg.severity);
        results.push({
          id: `eslint-${String(counter++).padStart(4, '0')}`,
          analyzerId: this.id,
          category: this.category,
          severity,
          file: file.filePath,
          line: msg.line,
          column: msg.column,
          message: msg.message,
          suggestion: (msg.fix || msg.suggestions?.length) ? '可自动修复' : undefined,
          rule: msg.ruleId ?? undefined,
          metadata: {
            fixable: !!(msg.fix || msg.suggestions?.length),
            endLine: msg.endLine,
            endColumn: msg.endColumn,
          },
        });
      }
    }

    return results;
  }

  /**
   * ESLint severity 映射
   * 0 = off, 1 = warn → Severity.low, 2 = error → Severity.high
   */
  private mapEslintSeverity(severity: number): Severity {
    switch (severity) {
      case 2:
        return Severity.high;
      case 1:
        return Severity.low;
      default:
        return Severity.info;
    }
  }

  // ---- TypeScript 严格模式 ----

  private async runTsc(rootDir: string): Promise<AnalysisResult[]> {
    try {
      const result = await exec('npx', ['tsc', '--noEmit', '--strict'], { cwd: rootDir });
      if (!result.stderr && !result.stdout) {
        return [];
      }
      return this.parseTscOutput(result.stdout || result.stderr || '', rootDir);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      warn(`[code-review] tsc 执行失败: ${msg}`);
      return [];
    }
  }

  /**
   * 解析 tsc --noEmit 输出
   * 格式: src/file.ts(10,5): error TS2322: Type 'string' is not assignable...
   */
  private parseTscOutput(output: string, rootDir: string): AnalysisResult[] {
    const results: AnalysisResult[] = [];
    const lines = output.split('\n');
    let counter = 0;

    // tsc 输出模式: filePath(line,col): error TS1234: message
    const tscPattern = /^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+TS(\d+):\s+(.+)$/;

    for (const line of lines) {
      const match = line.match(tscPattern);
      if (!match) continue;

      const [, filePath, lineStr, colStr, level, code, message] = match;

      results.push({
        id: `tsc-${String(counter++).padStart(4, '0')}`,
        analyzerId: this.id,
        category: AnalysisCategory['type-safety'],
        severity: level === 'error' ? Severity.high : Severity.moderate,
        file: filePath,
        line: parseInt(lineStr, 10),
        column: parseInt(colStr, 10),
        message: message.trim(),
        rule: `TS${code}`,
        metadata: { tsCode: `TS${code}` },
      });
    }

    return results;
  }

  // ---- 过滤 ----

  /**
   * 排除 node_modules 和 .biu-opt 目录的结果
   */
  private filterExcluded(results: AnalysisResult[], rootDir: string): AnalysisResult[] {
    const normalizedRoot = rootDir.replace(/\\/g, '/');
    return results.filter((r) => {
      if (!r.file) return true;
      const normalized = r.file.replace(/\\/g, '/');
      const relative = normalized.startsWith(normalizedRoot)
        ? normalized.slice(normalizedRoot.length).replace(/^\//, '')
        : normalized;

      // 排除 node_modules 和 .biu-opt 目录
      if (relative.includes('node_modules/') || relative.startsWith('node_modules/')) return false;
      if (relative.includes('.biu-opt/') || relative.startsWith('.biu-opt/')) return false;

      return true;
    });
  }
}
