// ============================================================
// Biu Auto-Optimizer — 回滚决策
// ============================================================

import type { MetricSnapshot } from '../types/snapshot.js';
import type { SnapshotComparison } from '../types/snapshot.js';
import type { Thresholds } from '../config/types.js';
import { debug } from '../utils/logger.js';

/**
 * 回滚评估结果
 */
export interface RollbackEvaluation {
  /** 是否应该回滚 */
  shouldRollback: boolean;
  /** 超出阈值的指标名称列表 */
  exceeded: string[];
}

/**
 * 评估是否需要回滚
 *
 * 逐项检查 before → after 的指标劣化是否超出阈值：
 * - lintErrors: 增加的百分比 > thresholds.lintErrors
 * - securityCritical: 绝对增量 > thresholds.securityCritical
 * - securityHigh: 绝对增量 > thresholds.securityHigh
 * - performanceDegradation: P95 延迟上升百分比 > thresholds.performanceDegradation
 * - outdatedDeps: 数量增加率 > thresholds.rollback
 * - buildTime: 增加率 > thresholds.ciBuildTimeIncrease
 *
 * @param before - 优化前快照
 * @param after - 优化后快照
 * @param thresholds - 质量阈值配置
 * @returns RollbackEvaluation
 */
export function evaluateRollback(
  before: MetricSnapshot,
  after: MetricSnapshot,
  thresholds: Thresholds,
): RollbackEvaluation {
  const exceeded: string[] = [];

  const bm = before.metrics;
  const am = after.metrics;

  // 1. Lint 错误数检查（百分比增长）
  const lintErrorsDelta = am.lintErrors - bm.lintErrors;
  if (lintErrorsDelta > 0 && bm.lintErrors > 0) {
    const lintErrorRatio = lintErrorsDelta / bm.lintErrors;
    if (lintErrorRatio > thresholds.lintErrors) {
      exceeded.push('lintErrors');
      debug(`[rollback] lintErrors 超出阈值: +${(lintErrorRatio * 100).toFixed(1)}% > ${(thresholds.lintErrors * 100).toFixed(1)}%`);
    }
  } else if (lintErrorsDelta > 0 && bm.lintErrors === 0) {
    // 之前为 0，现在有新增
    if (lintErrorsDelta > 5) {
      exceeded.push('lintErrors');
      debug(`[rollback] lintErrors 新增 ${lintErrorsDelta} 个（基线为 0）`);
    }
  }

  // 2. Lint 警告数检查
  const lintWarningsDelta = am.lintWarnings - bm.lintWarnings;
  if (lintWarningsDelta > 0 && bm.lintWarnings > 0) {
    const lintWarnRatio = lintWarningsDelta / bm.lintWarnings;
    if (lintWarnRatio > thresholds.lintErrors) {
      exceeded.push('lintWarnings');
    }
  }

  // 3. 安全严重漏洞绝对增量
  const secCriticalDelta =
    am.securityVulnerabilities.critical - bm.securityVulnerabilities.critical;
  if (secCriticalDelta > thresholds.securityCritical) {
    exceeded.push('securityCritical');
    debug(`[rollback] securityCritical 超出阈值: +${secCriticalDelta} > ${thresholds.securityCritical}`);
  }

  // 4. 安全高危漏洞绝对增量
  const secHighDelta =
    am.securityVulnerabilities.high - bm.securityVulnerabilities.high;
  if (secHighDelta > thresholds.securityHigh) {
    exceeded.push('securityHigh');
    debug(`[rollback] securityHigh 超出阈值: +${secHighDelta} > ${thresholds.securityHigh}`);
  }

  // 5. 性能劣化检查（P95 延迟）
  if (bm.performance && am.performance) {
    const p95Before = bm.performance.p95LatencyMs;
    const p95After = am.performance.p95LatencyMs;
    if (p95Before > 0) {
      const degradation = (p95After - p95Before) / p95Before;
      if (degradation > thresholds.performanceDegradation) {
        exceeded.push('performanceDegradation');
        debug(`[rollback] performanceDegradation 超出阈值: +${(degradation * 100).toFixed(1)}% > ${(thresholds.performanceDegradation * 100).toFixed(1)}%`);
      }
    }
  }

  // 6. 过期依赖数增长
  const outdatedDelta = am.outdatedDependencies - bm.outdatedDependencies;
  if (outdatedDelta > 0 && bm.outdatedDependencies > 0) {
    const outdatedRatio = outdatedDelta / bm.outdatedDependencies;
    if (outdatedRatio > thresholds.rollback) {
      exceeded.push('outdatedDependencies');
    }
  }

  // 7. 构建时间增长
  if (bm.buildTimeMs != null && am.buildTimeMs != null && bm.buildTimeMs > 0) {
    const buildIncrease = (am.buildTimeMs - bm.buildTimeMs) / bm.buildTimeMs;
    if (buildIncrease > thresholds.ciBuildTimeIncrease) {
      exceeded.push('ciBuildTimeIncrease');
      debug(`[rollback] ciBuildTimeIncrease 超出阈值: +${(buildIncrease * 100).toFixed(1)}% > ${(thresholds.ciBuildTimeIncrease * 100).toFixed(1)}%`);
    }
  }

  // 8. 通用回滚检查：如果有 previously not-zero lint errors 且增长超过 rollback 阈值
  if (
    !exceeded.includes('lintErrors') &&
    lintErrorsDelta > 0 &&
    bm.lintErrors > 0
  ) {
    const generalRatio = lintErrorsDelta / bm.lintErrors;
    if (generalRatio > thresholds.rollback) {
      exceeded.push('rollback');
    }
  }

  const shouldRollback = exceeded.length > 0;

  debug(`[rollback] 评估结果: shouldRollback=${shouldRollback}, exceeded=[${exceeded.join(', ')}]`);

  return { shouldRollback, exceeded };
}
