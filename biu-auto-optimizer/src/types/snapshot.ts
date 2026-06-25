// ============================================================
// Biu Auto-Optimizer — 快照与指标类型定义
// ============================================================

/**
 * 安全漏洞数量统计
 */
export interface VulnerabilityCount {
  /** 严重漏洞数 */
  critical: number;
  /** 高危漏洞数 */
  high: number;
  /** 中危漏洞数 */
  moderate: number;
  /** 低危漏洞数 */
  low: number;
}

/**
 * 性能基准指标
 */
export interface PerformanceMetrics {
  /** P50 延迟（毫秒） */
  p50LatencyMs: number;
  /** P95 延迟（毫秒） */
  p95LatencyMs: number;
  /** P99 延迟（毫秒） */
  p99LatencyMs: number;
  /** 吞吐量（请求/秒） */
  throughputRps: number;
}

/**
 * 指标数据集合
 * 每次快照包含的完整指标体系
 */
export interface MetricsData {
  /** Lint 错误数 */
  lintErrors: number;
  /** Lint 警告数 */
  lintWarnings: number;
  /** 安全漏洞统计 */
  securityVulnerabilities: VulnerabilityCount;
  /** 过期依赖数 */
  outdatedDependencies: number;
  /** 构建耗时（毫秒，可选） */
  buildTimeMs?: number;
  /** 打包体积（字节，可选） */
  bundleSizeBytes?: number;
  /** TypeScript 类型覆盖率百分比（0-1，可选） */
  typeCoveragePercent?: number;
  /** 性能基准指标（可选） */
  performance?: PerformanceMetrics;
}

/**
 * 指标快照
 * 在优化前后各拍一次，用于对比决策
 */
export interface MetricSnapshot {
  /** 快照唯一 ID（格式：snap-{YYYYMMDD}-{HHmmss}-{gitShortHash}） */
  id: string;
  /** 快照时间（ISO 8601） */
  timestamp: string;
  /** 当前 Git commit hash */
  gitHash: string;
  /** 当前 Git 分支名 */
  gitBranch: string;
  /** 指标数据 */
  metrics: MetricsData;
  /** 参与本次快照的分析器 ID 列表 */
  analyzerIds: string[];
}

/**
 * 指标差值
 * 正数表示劣化（问题增加），负数表示改善
 */
export interface MetricsDelta {
  /** Lint 错误数变化 */
  lintErrorsDelta: number;
  /** Lint 警告数变化 */
  lintWarningsDelta: number;
  /** 安全严重漏洞变化（绝对增量） */
  securityCriticalDelta: number;
  /** 安全高危漏洞变化（绝对增量） */
  securityHighDelta: number;
  /** 过期依赖数变化 */
  outdatedDepsDelta: number;
  /** 构建时间变化百分比（可选） */
  buildTimeDeltaPercent?: number;
  /** 性能劣化百分比（可选） */
  performanceDegradationPercent?: number;
}

/**
 * 快照对比结果
 * 对比优化前后的两个快照，决定是否回滚
 */
export interface SnapshotComparison {
  /** 优化前快照 */
  before: MetricSnapshot;
  /** 优化后快照 */
  after: MetricSnapshot;
  /** 指标差值 */
  delta: MetricsDelta;
  /** 是否建议回滚 */
  shouldRollback: boolean;
  /** 超出阈值的指标名称列表 */
  exceededThresholds: string[];
}
