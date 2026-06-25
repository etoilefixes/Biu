// ============================================================
// 测试: BaseAnalyzer 抽象基类
// ============================================================

import { describe, it, expect, vi } from 'vitest';
import { BaseAnalyzer } from '../src/analyzers/base.js';
import { AnalysisCategory, Severity } from '../src/types/analysis.js';
import type { AnalysisResult, AnalysisReport } from '../src/types/analysis.js';
import type { BiuOptConfig } from '../src/config/types.js';

// ============================================================
// 具体分析器实现（用于测试）
// ============================================================

class SuccessAnalyzer extends BaseAnalyzer {
  readonly id = 'test-analyzer';
  readonly category = AnalysisCategory['code-quality'];

  protected async run(_config: BiuOptConfig): Promise<AnalysisResult[]> {
    return [
      {
        id: 'test-1',
        analyzerId: this.id,
        category: this.category,
        severity: Severity.high,
        file: 'src/test.ts',
        line: 10,
        message: 'Test issue: type mismatch',
        suggestion: 'Add type annotation',
        rule: 'no-implicit-any',
      },
      {
        id: 'test-2',
        analyzerId: this.id,
        category: this.category,
        severity: Severity.low,
        file: 'src/test.ts',
        line: 42,
        message: 'Unused variable',
        rule: 'no-unused-vars',
      },
      {
        id: 'test-3',
        analyzerId: this.id,
        category: this.category,
        severity: Severity.critical,
        file: 'src/main.ts',
        line: 1,
        message: 'Missing return type',
        suggestion: 'Add return type annotation',
        rule: 'explicit-return-type',
      },
    ];
  }
}

class EmptyAnalyzer extends BaseAnalyzer {
  readonly id = 'empty-analyzer';
  readonly category = AnalysisCategory.security;

  protected async run(_config: BiuOptConfig): Promise<AnalysisResult[]> {
    return [];
  }
}

class ThrowingAnalyzer extends BaseAnalyzer {
  readonly id = 'crash-analyzer';
  readonly category = AnalysisCategory.complexity;

  protected async run(_config: BiuOptConfig): Promise<AnalysisResult[]> {
    throw new Error('Simulated analyzer crash');
  }
}

// ============================================================
// 辅助: 创建最小配置
// ============================================================
function createMockConfig(): BiuOptConfig {
  return {
    rootDir: '.',
    thresholds: {
      rollback: 0.05,
      lintErrors: 0.05,
      securityCritical: 0,
      securityHigh: 0,
      performanceDegradation: 0.05,
      complexityMax: 15,
      typeCoverageMin: 0.95,
      ciBuildTimeIncrease: 0.20,
    },
    analyzers: {
      'code-review': { enabled: true },
      'security-scan': { enabled: true },
      'dependency-check': { enabled: true },
    },
    autoFix: {
      enabled: true,
      createBranch: true,
      autoMergeLowRisk: false,
      maxFilesPerFix: 20,
    },
    nightly: {
      enabled: false,
      schedule: '02:00',
      autoCreatePR: false,
    },
    dashboard: {
      enabled: false,
      port: 4000,
    },
    reporting: {
      formats: ['cli', 'json'],
      outputDir: '.biu-opt/reports',
    },
    workspaces: ['shared', 'server', 'client'],
  };
}

// ============================================================
// 测试
// ============================================================
describe('BaseAnalyzer — 分析器抽象基类', () => {
  it('T48: analyze() 应返回有效的 AnalysisReport 结构', async () => {
    const analyzer = new SuccessAnalyzer();
    const config = createMockConfig();
    const report = await analyzer.analyze(config);

    // 验证顶层结构
    expect(report).toHaveProperty('timestamp');
    expect(report).toHaveProperty('durationMs');
    expect(report).toHaveProperty('summary');
    expect(report).toHaveProperty('results');

    // timestamp 应为有效 ISO 8601
    expect(() => new Date(report.timestamp)).not.toThrow();
    expect(new Date(report.timestamp).toISOString()).toBe(report.timestamp);

    // durationMs 应为非负数
    expect(report.durationMs).toBeGreaterThanOrEqual(0);

    // results 应为数组且包含预期数量
    expect(Array.isArray(report.results)).toBe(true);
    expect(report.results.length).toBe(3);
  });

  it('T49: analyze() 的 summary 应正确按 severity 和 category 分组', async () => {
    const analyzer = new SuccessAnalyzer();
    const config = createMockConfig();
    const report = await analyzer.analyze(config);

    // total
    expect(report.summary.total).toBe(3);

    // severity 分布
    expect(report.summary.bySeverity[Severity.critical]).toBe(1);
    expect(report.summary.bySeverity[Severity.high]).toBe(1);
    expect(report.summary.bySeverity[Severity.low]).toBe(1);
    expect(report.summary.bySeverity[Severity.moderate]).toBe(0);
    expect(report.summary.bySeverity[Severity.info]).toBe(0);

    // category 分布
    expect(report.summary.byCategory[AnalysisCategory['code-quality']]).toBe(3);
  });

  it('T50: analyze() 应将结果按 severity 降序排列', async () => {
    const analyzer = new SuccessAnalyzer();
    const config = createMockConfig();
    const report = await analyzer.analyze(config);

    const severities = report.results.map((r) => r.severity);
    const severityOrder = [Severity.critical, Severity.high, Severity.moderate, Severity.low, Severity.info];

    // 验证有序性
    for (let i = 1; i < severities.length; i++) {
      const prevIdx = severityOrder.indexOf(severities[i - 1]);
      const currIdx = severityOrder.indexOf(severities[i]);
      expect(prevIdx).toBeLessThanOrEqual(currIdx);
    }
  });

  it('T51: 空结果分析器应返回 total=0', async () => {
    const analyzer = new EmptyAnalyzer();
    const config = createMockConfig();
    const report = await analyzer.analyze(config);

    expect(report.summary.total).toBe(0);
    expect(report.results).toHaveLength(0);
    // 所有 severity 计数应为 0
    for (const sev of Object.values(Severity)) {
      expect(report.summary.bySeverity[sev]).toBe(0);
    }
  });

  it('T52: run() 抛出异常时不应崩溃，应返回空结果', async () => {
    const analyzer = new ThrowingAnalyzer();
    const config = createMockConfig();
    const report = await analyzer.analyze(config);

    // 不应崩溃
    expect(report.summary.total).toBe(0);
    expect(report.results).toHaveLength(0);
    expect(report).toHaveProperty('timestamp');
    expect(report).toHaveProperty('durationMs');
  });

  it('T53: analyze() 的 results 应包含所有 AnalysisResult 字段', async () => {
    const analyzer = new SuccessAnalyzer();
    const config = createMockConfig();
    const report = await analyzer.analyze(config);

    const firstResult = report.results[0];
    expect(firstResult).toHaveProperty('id');
    expect(firstResult).toHaveProperty('analyzerId');
    expect(firstResult).toHaveProperty('category');
    expect(firstResult).toHaveProperty('severity');
    expect(firstResult).toHaveProperty('message');

    // analyzerId 应匹配分析器 ID
    expect(firstResult.analyzerId).toBe('test-analyzer');
    // id 应为非空字符串
    expect(firstResult.id).toBeTruthy();
    expect(typeof firstResult.id).toBe('string');
  });
});
