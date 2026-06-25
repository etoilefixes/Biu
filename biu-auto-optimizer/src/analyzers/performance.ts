// ============================================================
// Biu Auto-Optimizer — R-06: autocannon 性能基准测试
// ============================================================

import { BaseAnalyzer } from './base.js';
import type { BiuOptConfig } from '../config/types.js';
import type { AnalysisResult } from '../types/analysis.js';
import { AnalysisCategory, Severity } from '../types/analysis.js';
import { exec } from '../utils/exec.js';
import { debug, warn } from '../utils/logger.js';

/**
 * autocannon 输出中单个百分位延迟
 */
interface AutocannonLatency {
  p50: number;
  p95: number;
  p99: number;
}

/**
 * 解析 autocannon JSON 输出
 */
interface AutocannonOutput {
  requests?: {
    average?: number;
    mean?: number;
    stddev?: number;
    min?: number;
    max?: number;
    total?: number;
  };
  latency?: AutocannonLatency;
  throughput?: {
    average?: number;
    mean?: number;
    max?: number;
    total?: number;
  };
}

/**
 * PerformanceAnalyzer — 性能基准测试
 *
 * 对配置的每个 API 端点运行 autocannon，提取：
 * - P50 / P95 / P99 延迟
 * - 吞吐量 (RPS)
 */
export class PerformanceAnalyzer extends BaseAnalyzer {
  readonly id = 'performance';
  readonly category = AnalysisCategory.performance;

  protected async run(config: BiuOptConfig): Promise<AnalysisResult[]> {
    const perfCfg = config.analyzers['performance'];
    if (!perfCfg?.enabled) return [];

    const endpoints =
      (perfCfg.options?.endpoints as string[] | undefined) ?? [];
    if (endpoints.length === 0) {
      return [];
    }

    // 检查 autocannon 是否可用
    const hasAutocannon = await this.checkAutocannon();
    if (!hasAutocannon) {
      return [
        {
          id: 'perf-install-hint',
          analyzerId: this.id,
          category: this.category,
          severity: Severity.info,
          message:
            'autocannon 未安装。运行 `npm install -g autocannon` 后可使用性能基准测试。',
          suggestion: 'npm install -g autocannon',
        },
      ];
    }

    const results: AnalysisResult[] = [];
    let counter = 0;

    for (const url of endpoints) {
      try {
        const item = await this.benchmarkEndpoint(url, counter);
        if (item) {
          results.push(item);
          counter++;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        warn(`[performance] 端点 ${url} 测试失败: ${msg}`);
      }
    }

    return results;
  }

  private async checkAutocannon(): Promise<boolean> {
    try {
      const result = await exec('npx', ['autocannon', '--version'], {
        timeout: 10_000,
      });
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }

  private async benchmarkEndpoint(
    url: string,
    index: number,
  ): Promise<AnalysisResult | null> {
    debug(`[performance] 测试端点: ${url}`);

    const result = await exec(
      'npx',
      ['autocannon', '-d', '10', '-c', '10', '--json', url],
      { timeout: 30_000 },
    );

    if (!result.stdout) {
      return null;
    }

    let parsed: AutocannonOutput;
    try {
      parsed = JSON.parse(result.stdout) as AutocannonOutput;
    } catch {
      warn(`[performance] 无法解析 ${url} 的输出`);
      return null;
    }

    const p50 = parsed.latency?.p50 ?? 0;
    const p95 = parsed.latency?.p95 ?? 0;
    const p99 = parsed.latency?.p99 ?? 0;
    const rps = parsed.throughput?.average ?? parsed.requests?.average ?? 0;

    // 根据 P95 延迟判断 severity
    const severity =
      p95 > 1000
        ? Severity.high
        : p95 > 500
          ? Severity.moderate
          : p95 > 200
            ? Severity.low
            : Severity.info;

    return {
      id: `perf-${String(index).padStart(4, '0')}`,
      analyzerId: this.id,
      category: this.category,
      severity,
      message: `${url}: P95=${p95.toFixed(1)}ms, RPS=${rps.toFixed(1)}`,
      suggestion:
        p95 > 500
          ? '建议优化端点响应时间或增加缓存层'
          : undefined,
      metadata: {
        url,
        p50,
        p95,
        p99,
        rps,
        testDuration: 10,
        connections: 10,
      },
    };
  }
}
