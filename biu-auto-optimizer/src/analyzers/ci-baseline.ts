// ============================================================
// Biu Auto-Optimizer — R-17: CI 构建时间基线
// ============================================================

import { BaseAnalyzer } from './base.js';
import type { BiuOptConfig } from '../config/types.js';
import type { AnalysisResult } from '../types/analysis.js';
import { AnalysisCategory, Severity } from '../types/analysis.js';
import { exec } from '../utils/exec.js';
import { SnapshotStore } from '../snapshots/store.js';
import { debug, warn } from '../utils/logger.js';
import { resolve } from 'node:path';

/**
 * CiBaselineAnalyzer — CI 构建时间基线
 *
 * 1. 执行构建脚本并计时
 * 2. 读取历史快照中的 buildTimeMs 数据
 * 3. 计算最近 7 次构建的移动平均值
 * 4. 本次构建时间 > 移动平均 * (1 + 阈值) → 告警
 */
export class CiBaselineAnalyzer extends BaseAnalyzer {
  readonly id = 'ci-baseline';
  readonly category = AnalysisCategory.performance;

  protected async run(config: BiuOptConfig): Promise<AnalysisResult[]> {
    const ciCfg = config.analyzers['ci-baseline'];
    if (!ciCfg?.enabled) return [];

    const rootDir = resolve(config.rootDir);
    const buildScript =
      (ciCfg.options as Record<string, unknown> | undefined)?.buildScript as
        | string
        | undefined ?? 'build';
    const threshold = config.thresholds.ciBuildTimeIncrease;

    // 1. 运行构建并计时
    const buildTimeMs = await this.measureBuild(rootDir, buildScript);

    if (buildTimeMs === null) {
      return [
        {
          id: 'ci-build-error',
          analyzerId: this.id,
          category: this.category,
          severity: Severity.info,
          message: `构建脚本 "${buildScript}" 执行失败`,
          suggestion: '请检查构建脚本是否存在且可正常运行',
        },
      ];
    }

    // 2. 读取历史快照
    const store = new SnapshotStore(rootDir);
    const snapshots = await store.list(30);

    // 过滤有 buildTimeMs 的快照
    const historicalBuilds = snapshots
      .filter((s) => s.metrics.buildTimeMs != null && s.metrics.buildTimeMs > 0)
      .slice(0, 7);

    const results: AnalysisResult[] = [];

    if (historicalBuilds.length < 2) {
      // 历史数据不足，记录本次构建
      results.push({
        id: 'ci-baseline-init',
        analyzerId: this.id,
        category: this.category,
        severity: Severity.info,
        message: `本次构建耗时: ${(buildTimeMs / 1000).toFixed(1)}s (历史数据不足，无法对比)`,
        metadata: {
          buildTimeMs,
          historicalCount: historicalBuilds.length,
        },
      });
      return results;
    }

    // 3. 计算移动平均值
    const avgBuildTimeMs =
      historicalBuilds.reduce((sum, s) => sum + (s.metrics.buildTimeMs ?? 0), 0) /
      historicalBuilds.length;

    const ratio = buildTimeMs / avgBuildTimeMs;
    const timeDiff = buildTimeMs - avgBuildTimeMs;
    const timeDiffSec = (timeDiff / 1000).toFixed(1);

    // 4. 判断是否超阈值
    const isAlert = ratio > 1 + threshold;

    if (isAlert) {
      results.push({
        id: `ci-regression-${Date.now()}`,
        analyzerId: this.id,
        category: this.category,
        severity:
          ratio > 1 + threshold * 3
            ? Severity.critical
            : ratio > 1 + threshold * 2
              ? Severity.high
              : Severity.moderate,
        message: `构建时间回归: ${(buildTimeMs / 1000).toFixed(1)}s vs 平均 ${(avgBuildTimeMs / 1000).toFixed(1)}s (+${((ratio - 1) * 100).toFixed(1)}%)`,
        suggestion:
          '建议分析构建时间增长原因，检查新增依赖、bundle 大小变化等',
        rule: 'ci-build-time-regression',
        metadata: {
          buildTimeMs,
          avgBuildTimeMs: Math.round(avgBuildTimeMs),
          ratio: Math.round(ratio * 100) / 100,
          threshold,
          historicalSamples: historicalBuilds.length,
          buildScript,
        },
      });
    }

    // 始终输出本次构建记录
    results.push({
      id: `ci-current-${Date.now()}`,
      analyzerId: this.id,
      category: this.category,
      severity: isAlert ? Severity.low : Severity.info,
      message: `构建完成: ${(buildTimeMs / 1000).toFixed(1)}s (对比平均 ${(avgBuildTimeMs / 1000).toFixed(1)}s, Δ ${timeDiffSec}s)`,
      metadata: {
        buildTimeMs,
        avgBuildTimeMs: Math.round(avgBuildTimeMs),
        threshold,
        historicalSamples: historicalBuilds.length,
      },
    });

    return results;
  }

  private async measureBuild(
    rootDir: string,
    buildScript: string,
  ): Promise<number | null> {
    debug(`[ci-baseline] 运行构建: npm run ${buildScript}`);

    const startTime = Date.now();

    try {
      await exec('npm', ['run', buildScript], {
        cwd: rootDir,
        timeout: 300_000,
      });

      return Date.now() - startTime;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      warn(`[ci-baseline] 构建失败: ${msg}`);
      return null;
    }
  }
}
