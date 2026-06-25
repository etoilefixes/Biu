// ============================================================
// Biu Auto-Optimizer — Analyzer 基类
// ============================================================

import type { BiuOptConfig } from '../config/types.js';
import type {
  AnalysisResult,
  AnalysisReport,
  AnalysisSummary,
} from '../types/analysis.js';
import { AnalysisCategory, Severity } from '../types/analysis.js';
import { debug, info } from '../utils/logger.js';

// ---- 接口 ----

/**
 * Analyzer 接口
 * 所有分析器必须实现此接口
 */
export interface IAnalyzer {
  /** 分析器唯一 ID */
  readonly id: string;
  /** 分析器归属类别 */
  readonly category: AnalysisCategory;
  /** 执行分析并返回结构化报告 */
  analyze(config: BiuOptConfig): Promise<AnalysisReport>;
}

// ---- 抽象基类 ----

/**
 * BaseAnalyzer — 分析器抽象基类
 *
 * 子类只需实现：
 *  - id (getter)
 *  - category (getter)
 *  - run(config): Promise<AnalysisResult[]>
 *
 * analyze() 负责计时、构建 summary、返回完整 AnalysisReport
 */
export abstract class BaseAnalyzer implements IAnalyzer {
  abstract readonly id: string;
  abstract readonly category: AnalysisCategory;

  /**
   * 执行分析 — 由子类实现
   * @param config - BiuOptConfig 完整配置
   * @returns 分析结果列表
   */
  protected abstract run(config: BiuOptConfig): Promise<AnalysisResult[]>;

  /**
   * 执行分析并返回结构化报告
   *
   * 流程：
   * 1. 记录开始时间
   * 2. 调用 run() 获取结果
   * 3. 构建按 severity/category 分组的 summary
   * 4. 返回 AnalysisReport
   *
   * @param config - BiuOptConfig 完整配置
   * @returns AnalysisReport
   */
  async analyze(config: BiuOptConfig): Promise<AnalysisReport> {
    const startTime = Date.now();
    debug(`[${this.id}] 开始分析...`);

    let results: AnalysisResult[];

    try {
      results = await this.run(config);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      info(`[${this.id}] 分析出错: ${message}`);
      results = [];
    }

    const durationMs = Date.now() - startTime;
    const summary = this.buildSummary(results);

    debug(`[${this.id}] 分析完成 — ${summary.total} 个问题 (${durationMs}ms)`);

    return {
      timestamp: new Date().toISOString(),
      durationMs,
      summary,
      results: this.sortBySeverity(results),
    };
  }

  /**
   * 构建 AnalysisSummary
   */
  private buildSummary(results: AnalysisResult[]): AnalysisSummary {
    const bySeverity: Record<Severity, number> = {
      [Severity.critical]: 0,
      [Severity.high]: 0,
      [Severity.moderate]: 0,
      [Severity.low]: 0,
      [Severity.info]: 0,
    };

    const byCategory: Record<AnalysisCategory, number> = {
      [AnalysisCategory['code-quality']]: 0,
      [AnalysisCategory.security]: 0,
      [AnalysisCategory.dependencies]: 0,
      [AnalysisCategory.performance]: 0,
      [AnalysisCategory.complexity]: 0,
      [AnalysisCategory['type-safety']]: 0,
      [AnalysisCategory.duplication]: 0,
    };

    for (const r of results) {
      bySeverity[r.severity]++;
      byCategory[r.category]++;
    }

    return {
      total: results.length,
      bySeverity,
      byCategory,
    };
  }

  /**
   * 按 severity 降序排列
   */
  private sortBySeverity(results: AnalysisResult[]): AnalysisResult[] {
    const order: Record<Severity, number> = {
      [Severity.critical]: 0,
      [Severity.high]: 1,
      [Severity.moderate]: 2,
      [Severity.low]: 3,
      [Severity.info]: 4,
    };

    return [...results].sort((a, b) => order[a.severity] - order[b.severity]);
  }
}
