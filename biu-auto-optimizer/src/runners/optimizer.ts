// ============================================================
// Biu Auto-Optimizer — 优化编排器
// ============================================================

import type { BiuOptConfig } from '../config/types.js';
import type { MetricSnapshot, SnapshotComparison } from '../types/snapshot.js';
import type { AnalysisReport } from '../types/analysis.js';
import { CodeReviewAnalyzer } from '../analyzers/code-review.js';
import { SecurityAnalyzer } from '../analyzers/security-scan.js';
import { DependencyCheckAnalyzer } from '../analyzers/dependency-check.js';
import type { IAnalyzer } from '../analyzers/base.js';
import { GitRunner } from './git.js';
import { NpmRunner } from './npm.js';
import { SnapshotStore } from '../snapshots/store.js';
import { collectMetrics } from '../snapshots/metrics.js';
import { evaluateRollback } from '../snapshots/rollback.js';
import { CliReporter } from '../reporters/cli.js';
import { MarkdownReporter } from '../reporters/markdown.js';
import { JsonReporter } from '../reporters/json.js';
import { getCurrentHash, getCurrentBranch } from '../utils/git.js';
import { debug, info, warn } from '../utils/logger.js';
import { resolve } from 'node:path';

/**
 * 优化结果
 */
export interface OptimizationResult {
  /** 是否成功 */
  success: boolean;
  /** 前置快照 */
  beforeSnapshot: MetricSnapshot;
  /** 后置快照（可能因回滚而缺失） */
  afterSnapshot?: MetricSnapshot;
  /** 快照对比 */
  comparison?: SnapshotComparison;
  /** 各分析器报告 */
  reports: AnalysisReport[];
  /** 是否回滚 */
  wasRolledBack: boolean;
  /** 自动修复信息 */
  fixes?: {
    auditFixed: number;
    auditRemained: number;
    depsUpdated: number;
  };
}

/**
 * OptimizerRunner — 优化编排器
 *
 * 核心流程：
 * 1. takeSnapshot (before)
 * 2. 并行运行所有 enabled analyzers
 * 3. 应用自动修复 (audit fix, npm update)
 * 4. 创建自动修复分支 + commit
 * 5. takeSnapshot (after)
 * 6. 对比 + 回滚决策
 * 7. 超阈值 → resetHard + deleteBranch; 否则 → tag + push
 * 8. 生成所有格式报告
 */
export class OptimizerRunner {
  private readonly config: BiuOptConfig;
  private readonly git: GitRunner;
  private readonly npm: NpmRunner;
  private readonly store: SnapshotStore;
  private readonly rootDir: string;

  constructor(config: BiuOptConfig) {
    this.config = config;
    this.rootDir = resolve(config.rootDir);
    this.git = new GitRunner(this.rootDir);
    this.npm = new NpmRunner(this.rootDir);
    this.store = new SnapshotStore(this.rootDir);
  }

  /**
   * 执行完整优化周期
   * @param selectedAnalyzers - 指定运行的 analyzer ID 列表（空 = 所有已启用）
   * @returns OptimizationResult
   */
  async runFullCycle(selectedAnalyzers?: string[]): Promise<OptimizationResult> {
    const startTime = new Date();
    info('🚀 Biu Opt 优化周期开始...');
    debug(`rootDir: ${this.rootDir}`);

    // 1. 拍前置快照
    const beforeSnapshot = await this.takeSnapshot('before');

    // 2. 获取要运行的分析器
    const analyzers = this.getEnabledAnalyzers(selectedAnalyzers);
    debug(`[optimizer] 启用分析器: ${analyzers.map((a) => a.id).join(', ')}`);

    // 3. 并行运行所有分析器
    const reports = await this.runAnalyzers(analyzers);

    // 4. 应用自动修复
    let auditFixed = 0;
    let auditRemained = 0;
    let depsUpdated = 0;

    if (this.config.autoFix.enabled) {
      info('🔧 应用自动修复...');

      // npm audit fix
      try {
        const fixResult = await this.npm.auditFix();
        auditFixed = fixResult.fixed;
        auditRemained = fixResult.remained;
        debug(`[optimizer] audit fix: ${auditFixed} fixed, ${auditRemained} remained`);
      } catch {
        warn('[optimizer] audit fix 失败，跳过');
      }
    }

    // 5. 创建自动修复分支 + commit
    let branchName = '';
    let wasRolledBack = false;
    let afterSnapshot: MetricSnapshot | undefined;

    if (this.config.autoFix.enabled && auditFixed > 0) {
      try {
        const ts = startTime.toISOString().replace(/[:.]/g, '-').slice(0, 19);
        branchName = `biu-opt/auto-fix-${ts}`;

        await this.git.createBranch(branchName);
        const commitHash = await this.git.commit('chore(biu-opt): auto-fix applied');
        debug(`[optimizer] 自动修复分支: ${branchName} (${commitHash})`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        warn(`[optimizer] 创建自动修复分支失败: ${msg}`);
      }
    }

    // 6. 拍后置快照
    afterSnapshot = await this.takeSnapshot('after');

    // 7. 对比 + 回滚决策
    const comparison = this.buildComparison(beforeSnapshot, afterSnapshot);
    const rollbackResult = evaluateRollback(
      beforeSnapshot,
      afterSnapshot,
      this.config.thresholds,
    );

    comparison.shouldRollback = rollbackResult.shouldRollback;
    comparison.exceededThresholds = rollbackResult.exceeded;

    // 8. 超阈值处理
    if (rollbackResult.shouldRollback) {
      warn(`⚠️  回滚触发! 超出阈值: ${rollbackResult.exceeded.join(', ')}`);

      try {
        // 回到原分支
        const originalBranch = beforeSnapshot.gitBranch;
        await this.git.checkout(originalBranch);

        // 硬回滚到快照 commit
        await this.git.resetHard(beforeSnapshot.gitHash);

        // 删除自动修复分支
        if (branchName) {
          await this.git.deleteBranch(branchName);
        }

        wasRolledBack = true;
        info('↩️  已回滚到优化前状态');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        warn(`[optimizer] 回滚失败: ${msg}`);
      }
    } else {
      // 未超阈值 → tag + push
      if (branchName) {
        try {
          const tagName = `biu-opt/safe-${beforeSnapshot.id}`;
          await this.git.createTag(tagName);

          if (this.config.autoFix.autoMergeLowRisk) {
            await this.git.push(branchName);
          }

          info('✅ 所有指标在阈值内，修复已保留');
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          warn(`[optimizer] tag/push 失败: ${msg}`);
        }
      }
    }

    // 9. 生成所有格式报告
    await this.generateReports(reports);

    const totalIssues = reports.reduce((sum, r) => sum + r.summary.total, 0);
    info(`🏁 优化周期完成: ${totalIssues} 个问题发现${wasRolledBack ? ', 已回滚' : ''}`);

    return {
      success: !wasRolledBack || totalIssues === 0,
      beforeSnapshot,
      afterSnapshot,
      comparison,
      reports,
      wasRolledBack,
      fixes: {
        auditFixed,
        auditRemained,
        depsUpdated,
      },
    };
  }

  /**
   * 拍摄指标快照
   * @param label - 快照标签（before/after），用于日志
   */
  async takeSnapshot(label: string): Promise<MetricSnapshot> {
    const hash = await getCurrentHash(this.rootDir);
    const branch = await getCurrentBranch(this.rootDir);

    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timePart = now.toISOString().slice(11, 19).replace(/:/g, '');
    const id = `snap-${datePart}-${timePart}-${hash}`;

    const analyzerIds = this.getEnabledAnalyzers().map((a) => a.id);
    const metrics = await collectMetrics(analyzerIds, this.rootDir);

    const snapshot: MetricSnapshot = {
      id,
      timestamp: now.toISOString(),
      gitHash: hash,
      gitBranch: branch,
      metrics,
      analyzerIds,
    };

    await this.store.save(snapshot);
    debug(`[optimizer] ${label} 快照已保存: ${id}`);
    return snapshot;
  }

  // ---- 私有方法 ----

  /**
   * 获取已启用的分析器实例
   */
  private getEnabledAnalyzers(selectedIds?: string[]): IAnalyzer[] {
    const all: IAnalyzer[] = [
      new CodeReviewAnalyzer(),
      new SecurityAnalyzer(),
      new DependencyCheckAnalyzer(),
    ];

    const selectedSet = selectedIds ? new Set(selectedIds) : null;

    return all.filter((analyzer) => {
      const cfg = this.config.analyzers[analyzer.id];
      if (!cfg || !cfg.enabled) return false;
      if (selectedSet && !selectedSet.has(analyzer.id)) return false;
      return true;
    });
  }

  /**
   * 并行运行分析器
   */
  private async runAnalyzers(analyzers: IAnalyzer[]): Promise<AnalysisReport[]> {
    const results = await Promise.allSettled(
      analyzers.map((analyzer) => analyzer.analyze(this.config)),
    );

    return results
      .filter(
        (r): r is PromiseFulfilledResult<AnalysisReport> => r.status === 'fulfilled',
      )
      .map((r) => r.value);
  }

  /**
   * 构建快照对比
   */
  private buildComparison(
    before: MetricSnapshot,
    after: MetricSnapshot,
  ): SnapshotComparison {
    return {
      before,
      after,
      delta: {
        lintErrorsDelta: after.metrics.lintErrors - before.metrics.lintErrors,
        lintWarningsDelta: after.metrics.lintWarnings - before.metrics.lintWarnings,
        securityCriticalDelta:
          after.metrics.securityVulnerabilities.critical -
          before.metrics.securityVulnerabilities.critical,
        securityHighDelta:
          after.metrics.securityVulnerabilities.high -
          before.metrics.securityVulnerabilities.high,
        outdatedDepsDelta:
          after.metrics.outdatedDependencies - before.metrics.outdatedDependencies,
        buildTimeDeltaPercent:
          before.metrics.buildTimeMs != null &&
          after.metrics.buildTimeMs != null &&
          before.metrics.buildTimeMs > 0
            ? (after.metrics.buildTimeMs - before.metrics.buildTimeMs) /
              before.metrics.buildTimeMs
            : undefined,
        performanceDegradationPercent:
          before.metrics.performance &&
          after.metrics.performance &&
          before.metrics.performance.p95LatencyMs > 0
            ? (after.metrics.performance.p95LatencyMs -
                before.metrics.performance.p95LatencyMs) /
              before.metrics.performance.p95LatencyMs
            : undefined,
      },
      shouldRollback: false,
      exceededThresholds: [],
    };
  }

  /**
   * 生成所有格式报告
   */
  private async generateReports(reports: AnalysisReport[]): Promise<void> {
    const cliReporter = new CliReporter();
    const mdReporter = new MarkdownReporter();
    const jsonReporter = new JsonReporter();

    const outputDir = resolve(
      this.rootDir,
      this.config.reporting.outputDir,
    );

    for (const report of reports) {
      const analyzerId = report.results[0]?.analyzerId ?? 'unknown';
      const ts = report.timestamp.replace(/[:.]/g, '-').slice(0, 19);

      try {
        // CLI 输出
        if (this.config.reporting.formats.includes('cli')) {
          await cliReporter.write(report, '');
        }
      } catch {
        warn(`[optimizer] CLI 报告输出失败: ${analyzerId}`);
      }

      try {
        // Markdown
        if (this.config.reporting.formats.includes('markdown')) {
          await mdReporter.write(
            report,
            resolve(outputDir, `report-${analyzerId}-${ts}.md`),
          );
        }
      } catch {
        warn(`[optimizer] Markdown 报告输出失败: ${analyzerId}`);
      }

      try {
        // JSON
        if (this.config.reporting.formats.includes('json')) {
          await jsonReporter.write(
            report,
            resolve(outputDir, `report-${analyzerId}-${ts}.json`),
          );
        }
      } catch {
        warn(`[optimizer] JSON 报告输出失败: ${analyzerId}`);
      }
    }
  }
}
