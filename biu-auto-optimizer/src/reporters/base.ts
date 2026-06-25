// ============================================================
// Biu Auto-Optimizer — IReporter 接口
// ============================================================

import type { AnalysisReport } from '../types/analysis.js';

/**
 * Reporter 接口
 * 所有报告输出器必须实现此接口
 */
export interface IReporter {
  /** 报告器名称 */
  readonly name: string;

  /**
   * 渲染报告为字符串
   * @param report - 分析报告
   * @returns 格式化后的字符串
   */
  render(report: AnalysisReport): Promise<string>;

  /**
   * 将报告写入输出目标
   * @param report - 分析报告
   * @param outputPath - 输出路径（CLI reporter 可忽略）
   */
  write(report: AnalysisReport, outputPath: string): Promise<void>;
}
