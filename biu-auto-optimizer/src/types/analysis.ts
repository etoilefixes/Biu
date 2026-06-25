// ============================================================
// Biu Auto-Optimizer — 分析相关类型定义
// ============================================================

/**
 * 问题严重程度枚举
 */
export enum Severity {
  critical = 'critical',
  high = 'high',
  moderate = 'moderate',
  low = 'low',
  info = 'info',
}

/**
 * 分析类别枚举
 */
export enum AnalysisCategory {
  'code-quality' = 'code-quality',
  security = 'security',
  dependencies = 'dependencies',
  performance = 'performance',
  complexity = 'complexity',
  'type-safety' = 'type-safety',
  duplication = 'duplication',
}

/**
 * 单条分析结果
 * 由各个 Analyzer 产出，经 Reporter 格式化输出
 */
export interface AnalysisResult {
  /** 结果唯一标识（格式：{analyzerId}-{hash}） */
  id: string;
  /** 分析器 ID（如 'code-review', 'security-scan'） */
  analyzerId: string;
  /** 分析类别 */
  category: AnalysisCategory;
  /** 严重程度 */
  severity: Severity;
  /** 问题所在文件路径（可选） */
  file?: string;
  /** 问题所在行号（可选） */
  line?: number;
  /** 问题所在列号（可选） */
  column?: number;
  /** 问题描述 */
  message: string;
  /** 修复建议（可选） */
  suggestion?: string;
  /** 触发的规则名称（可选） */
  rule?: string;
  /** 附加元数据（可选） */
  metadata?: Record<string, unknown>;
}

/**
 * 分析汇总统计
 */
export interface AnalysisSummary {
  /** 问题总数 */
  total: number;
  /** 按严重程度分组统计 */
  bySeverity: Record<Severity, number>;
  /** 按分析类别分组统计 */
  byCategory: Record<AnalysisCategory, number>;
}

/**
 * 单次分析报告
 * 由一个 Analyzer 运行完成后产出
 */
export interface AnalysisReport {
  /** 报告生成时间（ISO 8601） */
  timestamp: string;
  /** 分析耗时（毫秒） */
  durationMs: number;
  /** 汇总统计 */
  summary: AnalysisSummary;
  /** 详细分析结果列表 */
  results: AnalysisResult[];
}
