// ============================================================
// Biu Auto-Optimizer — 配置类型定义
// ============================================================

/**
 * 回滚与质量阈值配置
 * 所有百分比阈值为 0.0 ~ 1.0（0.05 = 允许 5% 劣化）
 * securityCritical / securityHigh 为绝对增量（整数）
 */
export interface Thresholds {
  /** 通用回滚触发阈值（默认 0.05 = 5%） */
  rollback: number;
  /** Lint 错误数量增加的允许比例（默认 0.05） */
  lintErrors: number;
  /** 安全严重漏洞绝对增量阈值（默认 0，任何新增即回滚） */
  securityCritical: number;
  /** 安全高危漏洞绝对增量阈值（默认 0，任何新增即回滚） */
  securityHigh: number;
  /** 性能劣化百分比阈值（默认 0.05） */
  performanceDegradation: number;
  /** 最大允许圈复杂度（默认 15） */
  complexityMax: number;
  /** 最低类型覆盖率（默认 0.95 = 95%） */
  typeCoverageMin: number;
  /** CI 构建时间增加比例阈值（默认 0.20 = 20%） */
  ciBuildTimeIncrease: number;
}

/** 单个分析器的启停配置 */
export interface AnalyzerEntryConfig {
  enabled: boolean;
  options?: Record<string, unknown>;
}

/** 代码审查分析器配置 */
export interface CodeReviewAnalyzerConfig {
  enabled: boolean;
  options?: {
    /** ESLint 配置文件路径 */
    eslintConfig?: string;
  };
}

/** 安全扫描分析器配置 */
export interface SecurityScanAnalyzerConfig {
  enabled: boolean;
  options?: {
    /** npm audit 级别 */
    auditLevel?: string;
  };
}

/** 依赖检查分析器配置 */
export interface DependencyCheckAnalyzerConfig {
  enabled: boolean;
  options?: {
    /** 是否自动修复非破坏性更新 */
    autoFixNonBreaking?: boolean;
  };
}

/** 性能分析器配置 */
export interface PerformanceAnalyzerConfig {
  enabled: boolean;
  options?: {
    /** 基准测试目标 API 端点列表 */
    endpoints?: string[];
  };
}

/** 所有分析器配置集合 */
export interface AnalyzersConfig {
  'code-review': CodeReviewAnalyzerConfig;
  'security-scan': SecurityScanAnalyzerConfig;
  'dependency-check': DependencyCheckAnalyzerConfig;
  performance?: PerformanceAnalyzerConfig;
  [key: string]: AnalyzerEntryConfig | PerformanceAnalyzerConfig | undefined;
}

/** 自动修复配置 */
export interface AutoFixConfig {
  /** 是否启用自动修复 */
  enabled: boolean;
  /** 是否创建独立分支 */
  createBranch: boolean;
  /** 是否自动合并低风险修复 */
  autoMergeLowRisk: boolean;
  /** 单次修复最大文件数 */
  maxFilesPerFix: number;
}

/** 夜间优化窗口配置 */
export interface NightlyConfig {
  /** 是否启用夜间窗口 */
  enabled: boolean;
  /** 调度时间（HH:mm 格式） */
  schedule: string;
  /** 是否自动创建 PR */
  autoCreatePR: boolean;
}

/** Dashboard 配置 */
export interface DashboardConfig {
  /** 是否启用 Dashboard */
  enabled: boolean;
  /** 监听端口 */
  port: number;
}

/** 报告输出配置 */
export interface ReportingConfig {
  /** 输出格式列表：cli, json, markdown, html */
  formats: string[];
  /** 报告输出目录（相对于 rootDir） */
  outputDir: string;
}

/**
 * Biu Auto-Optimizer 完整配置
 * 由 cosmiconfig 从 .biu-opt.json 加载并 Zod 校验
 */
export interface BiuOptConfig {
  /** 项目根目录 */
  rootDir: string;
  /** 质量阈值 */
  thresholds: Thresholds;
  /** 分析器配置 */
  analyzers: AnalyzersConfig;
  /** 自动修复配置 */
  autoFix: AutoFixConfig;
  /** 夜间窗口配置 */
  nightly: NightlyConfig;
  /** Dashboard 配置 */
  dashboard: DashboardConfig;
  /** 报告配置 */
  reporting: ReportingConfig;
  /** Monorepo 工作区列表 */
  workspaces: string[];
}
