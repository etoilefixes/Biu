// ============================================================
// Biu Auto-Optimizer — R-09: Lighthouse 审计
// ============================================================

import { BaseAnalyzer } from './base.js';
import type { BiuOptConfig } from '../config/types.js';
import type { AnalysisResult } from '../types/analysis.js';
import { AnalysisCategory, Severity } from '../types/analysis.js';
import { exec } from '../utils/exec.js';
import { debug, warn } from '../utils/logger.js';

/**
 * Lighthouse JSON 输出结构（部分）
 */
interface LighthouseResult {
  categories?: Record<
    string,
    {
      score: number;
      title: string;
    }
  >;
  audits?: Record<
    string,
    {
      score: number | null;
      displayValue?: string;
      title: string;
    }
  >;
}

/**
 * LighthouseAnalyzer — Lighthouse 性能审计
 *
 * 使用 CLI 方式运行 Lighthouse：
 * npx lighthouse {url} --output json --chrome-flags="--headless=old"
 *
 * 提取 FCP / LCP / TBT / CLS 及评分
 * 评分 < 80 → high；< 60 → critical
 */
export class LighthouseAnalyzer extends BaseAnalyzer {
  readonly id = 'lighthouse';
  readonly category = AnalysisCategory.performance;

  private static readonly SCORE_THRESHOLD_HIGH = 80;
  private static readonly SCORE_THRESHOLD_CRITICAL = 60;

  protected async run(config: BiuOptConfig): Promise<AnalysisResult[]> {
    const lhCfg = config.analyzers['lighthouse'];
    if (!lhCfg?.enabled) return [];

    const url =
      (lhCfg.options as Record<string, unknown> | undefined)?.url as
        | string
        | undefined ?? 'http://localhost:5173';

    try {
      const results = await this.runLighthouse(url);
      return results;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      warn(`[lighthouse] 审计失败: ${msg}`);

      return [
        {
          id: `lh-error-${Date.now()}`,
          analyzerId: this.id,
          category: this.category,
          severity: Severity.info,
          message: `Lighthouse 审计失败: ${msg}`,
          suggestion:
            '请确保 Chrome 已安装，或使用 --chrome-flags 指定 Chrome 路径',
        },
      ];
    }
  }

  private async runLighthouse(url: string): Promise<AnalysisResult[]> {
    debug(`[lighthouse] 对 ${url} 运行 Lighthouse...`);

    const result = await exec(
      'npx',
      [
        'lighthouse',
        url,
        '--output',
        'json',
        '--chrome-flags="--headless=old --no-sandbox --disable-gpu"',
        '--quiet',
        '--max-wait-for-load=30000',
      ],
      { timeout: 90_000 },
    );

    if (!result.stdout) {
      return [
        {
          id: `lh-empty-${Date.now()}`,
          analyzerId: this.id,
          category: this.category,
          severity: Severity.info,
          message: 'Lighthouse 未返回结果',
          suggestion: '请检查目标 URL 是否可访问',
        },
      ];
    }

    let parsed: LighthouseResult;
    try {
      parsed = JSON.parse(result.stdout) as LighthouseResult;
    } catch {
      warn('[lighthouse] 无法解析 JSON 输出');
      return [
        {
          id: `lh-parse-err-${Date.now()}`,
          analyzerId: this.id,
          category: this.category,
          severity: Severity.info,
          message: 'Lighthouse JSON 解析失败',
          suggestion: '检查 Lighthouse 输出格式',
        },
      ];
    }

    const results: AnalysisResult[] = [];
    let counter = 0;

    // 分类评分
    if (parsed.categories) {
      for (const [key, cat] of Object.entries(parsed.categories)) {
        const score = cat.score * 100;

        results.push({
          id: `lh-${String(counter++).padStart(4, '0')}`,
          analyzerId: this.id,
          category: this.category,
          severity: this.scoreToSeverity(score),
          message: `${cat.title}: ${score.toFixed(0)}/100`,
          suggestion:
            score < LighthouseAnalyzer.SCORE_THRESHOLD_HIGH
              ? `建议优化 ${cat.title} 相关指标`
              : undefined,
          rule: `lighthouse-${key}`,
          metadata: {
            category: key,
            title: cat.title,
            score,
          },
        });
      }
    }

    // 关键审计项（FCP/LCP/TBT/CLS）
    const keyAudits = [
      'first-contentful-paint',
      'largest-contentful-paint',
      'total-blocking-time',
      'cumulative-layout-shift',
      'speed-index',
      'interactive',
    ];

    if (parsed.audits) {
      for (const key of keyAudits) {
        const audit = parsed.audits[key];
        if (!audit || audit.score === null) continue;

        const score = audit.score * 100;
        results.push({
          id: `lh-${String(counter++).padStart(4, '0')}`,
          analyzerId: this.id,
          category: this.category,
          severity: this.auditScoreToSeverity(score, key),
          message: `${audit.title}: ${
            audit.displayValue ?? `${score.toFixed(0)}/100`
          }`,
          suggestion:
            score < 80
              ? this.getAuditSuggestion(key, audit.displayValue ?? '')
              : undefined,
          rule: `lighthouse-audit-${key}`,
          metadata: {
            auditKey: key,
            title: audit.title,
            score,
            displayValue: audit.displayValue,
          },
        });
      }
    }

    return results;
  }

  private scoreToSeverity(score: number): Severity {
    if (score < LighthouseAnalyzer.SCORE_THRESHOLD_CRITICAL) return Severity.critical;
    if (score < LighthouseAnalyzer.SCORE_THRESHOLD_HIGH) return Severity.high;
    if (score < 90) return Severity.moderate;
    return Severity.info;
  }

  private auditScoreToSeverity(score: number, auditKey: string): Severity {
    // CLS 和 TBT 更严格
    if (auditKey === 'cumulative-layout-shift' || auditKey === 'total-blocking-time') {
      if (score < 50) return Severity.critical;
      if (score < 75) return Severity.high;
    }

    return this.scoreToSeverity(score);
  }

  private getAuditSuggestion(auditKey: string, currentValue: string): string {
    const suggestions: Record<string, string> = {
      'first-contentful-paint':
        '考虑代码分割、减少关键渲染路径、启用 CDN 加速静态资源',
      'largest-contentful-paint':
        '优化图片加载（使用 WebP、懒加载）、预加载关键资源',
      'total-blocking-time':
        '减少 JavaScript 执行时间，使用 Web Worker 或代码分割',
      'cumulative-layout-shift':
        '为图片/视频设置明确宽高、避免动态注入布局内容',
      'speed-index': '减少主线程工作量、优化关键渲染路径',
      interactive: '减少不必要的 polyfill、延迟非关键脚本加载',
    };

    return (
      suggestions[auditKey] ??
      `当前值: ${currentValue}，建议优化此指标`
    );
  }
}
