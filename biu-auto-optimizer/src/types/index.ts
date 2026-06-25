// ============================================================
// Biu Auto-Optimizer — 类型统一导出
// ============================================================

export {
  Severity,
  AnalysisCategory,
} from './analysis.js';

export type {
  AnalysisResult,
  AnalysisSummary,
  AnalysisReport,
} from './analysis.js';

export type {
  VulnerabilityCount,
  PerformanceMetrics,
  MetricsData,
  MetricSnapshot,
  MetricsDelta,
  SnapshotComparison,
} from './snapshot.js';

export type {
  ChangelogEntry,
  GroupedEntries,
  ChangelogReport,
} from './changelog.js';

export type {
  BiuOptConfig,
  Thresholds,
  AnalyzersConfig,
  AnalyzerEntryConfig,
  AutoFixConfig,
  NightlyConfig,
  DashboardConfig,
  ReportingConfig,
} from '../config/types.js';
