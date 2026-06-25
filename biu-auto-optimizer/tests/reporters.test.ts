// ============================================================
// 测试: Reporter 层 (CLI + JSON)
// ============================================================

import { describe, it, expect } from 'vitest';
import { CliReporter } from '../src/reporters/cli.js';
import { JsonReporter } from '../src/reporters/json.js';
import { Severity, AnalysisCategory } from '../src/types/analysis.js';
import type { AnalysisReport } from '../src/types/analysis.js';

// ============================================================
// 辅助: 创建测试报告
// ============================================================
function createEmptyReport(): AnalysisReport {
  return {
    timestamp: '2025-01-01T12:00:00.000Z',
    durationMs: 150,
    summary: {
      total: 0,
      bySeverity: {
        [Severity.critical]: 0,
        [Severity.high]: 0,
        [Severity.moderate]: 0,
        [Severity.low]: 0,
        [Severity.info]: 0,
      },
      byCategory: {
        [AnalysisCategory['code-quality']]: 0,
        [AnalysisCategory.security]: 0,
        [AnalysisCategory.dependencies]: 0,
        [AnalysisCategory.performance]: 0,
        [AnalysisCategory.complexity]: 0,
        [AnalysisCategory['type-safety']]: 0,
        [AnalysisCategory.duplication]: 0,
      },
    },
    results: [],
  };
}

function createReportWithIssues(): AnalysisReport {
  return {
    timestamp: '2025-01-01T12:00:00.000Z',
    durationMs: 2500,
    summary: {
      total: 3,
      bySeverity: {
        [Severity.critical]: 1,
        [Severity.high]: 1,
        [Severity.moderate]: 0,
        [Severity.low]: 1,
        [Severity.info]: 0,
      },
      byCategory: {
        [AnalysisCategory['code-quality']]: 2,
        [AnalysisCategory.security]: 1,
        [AnalysisCategory.dependencies]: 0,
        [AnalysisCategory.performance]: 0,
        [AnalysisCategory.complexity]: 0,
        [AnalysisCategory['type-safety']]: 0,
        [AnalysisCategory.duplication]: 0,
      },
    },
    results: [
      {
        id: 'code-review-crit1',
        analyzerId: 'code-review',
        category: AnalysisCategory['code-quality'],
        severity: Severity.critical,
        file: 'src/main.ts',
        line: 42,
        column: 10,
        message: 'Type string is not assignable to type number',
        suggestion: 'Use parseInt() to convert',
        rule: 'TS2322',
      },
      {
        id: 'security-high1',
        analyzerId: 'security-scan',
        category: AnalysisCategory.security,
        severity: Severity.high,
        file: '.env',
        line: 3,
        message: 'Hardcoded API key detected',
        suggestion: 'Use environment variables',
        rule: 'no-hardcoded-secrets',
      },
      {
        id: 'code-review-low1',
        analyzerId: 'code-review',
        category: AnalysisCategory['code-quality'],
        severity: Severity.low,
        file: 'src/utils.ts',
        message: 'Unused import',
        rule: 'no-unused-imports',
      },
    ],
  };
}

// ============================================================
// CliReporter 测试
// ============================================================
describe('CliReporter — 终端报告', () => {
  const reporter = new CliReporter();

  it('T54: name 应为 "cli"', () => {
    expect(reporter.name).toBe('cli');
  });

  it('T55: render 对空结果应显示 "No issues found"', async () => {
    const report = createEmptyReport();
    const output = await reporter.render(report);

    expect(output).toContain('No issues found');
    expect(output).toContain('Analysis Report');
    expect(output).toContain('Duration:');
    expect(output).toContain('Total Issues: 0');
  });

  it('T56: render 应对有问题的报告生成表格', async () => {
    const report = createReportWithIssues();
    const output = await reporter.render(report);

    // 应包含 severity 标记
    expect(output).toContain('critical');
    expect(output).toContain('high');
    expect(output).toContain('low');

    // 应包含文件路径
    expect(output).toContain('src/main.ts');
    expect(output).toContain('.env');

    // 应包含规则
    expect(output).toContain('TS2322');
    expect(output).toContain('no-hardcoded-secrets');

    // 应包含 summary
    expect(output).toContain('Summary:');
    expect(output).toContain('Total:');
    expect(output).toContain('3');
  });

  it('T57: render 应包含 Duration 和 Total Issues', async () => {
    const report = createReportWithIssues();
    const output = await reporter.render(report);

    expect(output).toContain('2.50s');
    expect(output).toContain('Total Issues: 3');
  });

  it('T58: write 应调用 console.log', async () => {
    const report = createEmptyReport();
    // write() 调用 console.log，这里只验证不抛异常
    await expect(reporter.write(report, '')).resolves.toBeUndefined();
  });
});

// ============================================================
// JsonReporter 测试
// ============================================================
describe('JsonReporter — JSON 序列化', () => {
  const reporter = new JsonReporter();

  it('T59: name 应为 "json"', () => {
    expect(reporter.name).toBe('json');
  });

  it('T60: render 应返回有效的 JSON 字符串', async () => {
    const report = createReportWithIssues();
    const output = await reporter.render(report);

    // 应可被 JSON.parse 解析
    expect(() => JSON.parse(output)).not.toThrow();

    const parsed = JSON.parse(output);
    expect(parsed.timestamp).toBe(report.timestamp);
    expect(parsed.durationMs).toBe(report.durationMs);
    expect(parsed.summary.total).toBe(report.summary.total);
  });

  it('T61: render 输出 JSON 应包含所有顶层字段', async () => {
    const report = createReportWithIssues();
    const output = await reporter.render(report);
    const parsed = JSON.parse(output);

    expect(parsed).toHaveProperty('timestamp');
    expect(parsed).toHaveProperty('durationMs');
    expect(parsed).toHaveProperty('summary');
    expect(parsed).toHaveProperty('results');

    // summary 应有子字段
    expect(parsed.summary).toHaveProperty('total');
    expect(parsed.summary).toHaveProperty('bySeverity');
    expect(parsed.summary).toHaveProperty('byCategory');
  });

  it('T62: render 输出 JSON 应包含 results 数组详情', async () => {
    const report = createReportWithIssues();
    const output = await reporter.render(report);
    const parsed = JSON.parse(output);

    expect(Array.isArray(parsed.results)).toBe(true);
    expect(parsed.results.length).toBe(3);

    const first = parsed.results[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('analyzerId');
    expect(first).toHaveProperty('severity');
    expect(first).toHaveProperty('message');
  });

  it('T63: render 产生的 JSON 跨报告应结构一致', async () => {
    const empty = JSON.parse(await reporter.render(createEmptyReport()));
    const withIssues = JSON.parse(await reporter.render(createReportWithIssues()));

    // 两个报告应有一致的顶层键
    const emptyKeys = Object.keys(empty).sort();
    const issueKeys = Object.keys(withIssues).sort();
    expect(emptyKeys).toEqual(issueKeys);

    // summary 子键也应一致
    const emptySummaryKeys = Object.keys(empty.summary).sort();
    const issueSummaryKeys = Object.keys(withIssues.summary).sort();
    expect(emptySummaryKeys).toEqual(issueSummaryKeys);
  });
});
