// ============================================================
// Biu Auto-Optimizer — R-14: 依赖健康度评分
// ============================================================

import { BaseAnalyzer } from './base.js';
import type { BiuOptConfig } from '../config/types.js';
import type { AnalysisResult } from '../types/analysis.js';
import { AnalysisCategory, Severity } from '../types/analysis.js';
import { debug, warn } from '../utils/logger.js';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/**
 * npm registry 返回的包信息
 */
interface NpmPackageInfo {
  downloads?: number;
  lastPublish?: string;
  maintainers?: number;
  version?: string;
}

/**
 * DepHealthAnalyzer — 依赖健康度评分
 *
 * 对每个 production dependency：
 * - 从 npm registry API 获取包信息
 * - 计算健康度评分 (0-100)
 *   - 下载趋势 (30 分)
 *   - 时效性 (25 分)
 *   - 维护者 (25 分)
 *   - 版本稳定性 (20 分)
 * - 评分 < 60 → high severity
 */
export class DepHealthAnalyzer extends BaseAnalyzer {
  readonly id = 'dep-health';
  readonly category = AnalysisCategory.dependencies;

  private static readonly HEALTH_THRESHOLD = 60;

  protected async run(config: BiuOptConfig): Promise<AnalysisResult[]> {
    const rootDir = resolve(config.rootDir);

    // 读取 package.json 获取 production dependencies
    const pkgPath = resolve(rootDir, 'package.json');
    let dependencies: Record<string, string> = {};

    try {
      const pkgContent = await readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(pkgContent) as {
        dependencies?: Record<string, string>;
      };
      dependencies = pkg.dependencies ?? {};
    } catch {
      warn('[dep-health] 无法读取 package.json');
      return [];
    }

    const deps = Object.entries(dependencies);
    if (deps.length === 0) return [];

    debug(`[dep-health] 分析 ${deps.length} 个依赖...`);

    const results: AnalysisResult[] = [];
    let counter = 0;

    for (const [name, version] of deps) {
      try {
        const info = await this.fetchPackageInfo(name);
        const score = this.calculateScore(info, version);
        const severity =
          score < DepHealthAnalyzer.HEALTH_THRESHOLD
            ? Severity.high
            : score < 75
              ? Severity.moderate
              : Severity.info;

        results.push({
          id: `dh-${String(counter++).padStart(4, '0')}`,
          analyzerId: this.id,
          category: this.category,
          severity,
          message: `${name}@${version}: 健康度评分 ${score}/100`,
          suggestion:
            score < DepHealthAnalyzer.HEALTH_THRESHOLD
              ? `依赖 ${name} 健康度较低，建议评估替代方案`
              : undefined,
          rule: 'dep-health-score',
          metadata: {
            package: name,
            version,
            score,
            downloads: info.downloads,
            lastPublish: info.lastPublish,
            maintainers: info.maintainers,
          },
        });
      } catch {
        // 网络失败，跳过单个包
      }
    }

    debug(`[dep-health] 完成 ${results.length} 个依赖评分`);
    return results;
  }

  private async fetchPackageInfo(
    pkgName: string,
  ): Promise<NpmPackageInfo> {
    const info: NpmPackageInfo = {};

    try {
      // 下载量
      const dlUrl = `https://api.npmjs.org/downloads/point/last-month/${encodeURIComponent(pkgName)}`;
      const dlRes = await fetch(dlUrl);
      if (dlRes.ok) {
        const dlData = (await dlRes.json()) as { downloads?: number };
        info.downloads = dlData.downloads ?? 0;
      }
    } catch {
      info.downloads = 0;
    }

    try {
      // 包元数据
      const regUrl = `https://registry.npmjs.org/${encodeURIComponent(pkgName)}`;
      const regRes = await fetch(regUrl);
      if (regRes.ok) {
        const regData = (await regRes.json()) as {
          time?: Record<string, string>;
          maintainers?: Array<{ name: string }>;
          'dist-tags'?: { latest?: string };
        };
        info.maintainers = regData.maintainers?.length ?? 0;

        // 最后发布时间
        const latest = regData['dist-tags']?.latest;
        if (latest && regData.time?.[latest]) {
          info.lastPublish = regData.time[latest];
        }
      }
    } catch {
      info.maintainers = 0;
    }

    return info;
  }

  private calculateScore(
    info: NpmPackageInfo,
    _version: string,
  ): number {
    let score = 0;

    // 下载趋势 (30 分)
    if (info.downloads != null) {
      if (info.downloads > 1_000_000) score += 30;
      else if (info.downloads > 100_000) score += 24;
      else if (info.downloads > 10_000) score += 18;
      else if (info.downloads > 1_000) score += 12;
      else if (info.downloads > 0) score += 6;
    }

    // 时效性 (25 分) — 最近一年内有更新
    if (info.lastPublish) {
      const daysSince = (Date.now() - new Date(info.lastPublish).getTime()) / (24 * 60 * 60 * 1000);
      if (daysSince < 30) score += 25;
      else if (daysSince < 90) score += 20;
      else if (daysSince < 180) score += 15;
      else if (daysSince < 365) score += 10;
      else score += 5;
    }

    // 维护者 (25 分)
    if (info.maintainers != null) {
      if (info.maintainers >= 5) score += 25;
      else if (info.maintainers >= 3) score += 20;
      else if (info.maintainers >= 2) score += 15;
      else if (info.maintainers >= 1) score += 10;
    }

    // 版本稳定性 (20 分) — 基于版本号判断
    // 如果是 major version > 0，给予基线分
    const versionMatch = _version.match(/^[\^~]?(\d+)\./);
    if (versionMatch) {
      const major = parseInt(versionMatch[1]!, 10);
      if (major >= 1) score += 20;
      else if (major === 0) score += 10; // 0.x 版本不稳定
    } else {
      score += 10; // 无法解析版本
    }

    return Math.min(score, 100);
  }
}
