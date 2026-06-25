// ============================================================
// Biu Auto-Optimizer — CLI 终端报告器 (chalk + cli-table3)
// ============================================================

import type { IReporter } from './base.js';
import type { AnalysisReport, AnalysisResult } from '../types/analysis.js';
import { Severity } from '../types/analysis.js';
import chalk from 'chalk';

/**
 * CliReporter — 终端颜色表格输出
 *
 * 输出格式：
 * ┌──────────┬──────────────────────┬──────────────┬────────────────────────┐
 * │ Severity │ File:Line            │ Rule         │ Message                │
 * ├──────────┼──────────────────────┼──────────────┼────────────────────────┤
 * │ critical │ src/foo.ts:42:10     │ TS2322       │ Type 'string' not...   │
 * └──────────┴──────────────────────┴──────────────┴────────────────────────┘
 *
 * 底部 summary: 按 severity 分组计数 + 总数
 */
export class CliReporter implements IReporter {
  readonly name = 'cli';

  async render(report: AnalysisReport): Promise<string> {
    const lines: string[] = [];
    const { summary, results, durationMs, timestamp } = report;

    // 头部
    const durationSec = (durationMs / 1000).toFixed(2);
    lines.push(chalk.bold.cyan('═══════════════════════════════════════════'));
    lines.push(chalk.bold.white(`  Analysis Report — ${new Date(timestamp).toLocaleString()}`));
    lines.push(chalk.gray(`  Duration: ${durationSec}s  |  Total Issues: ${summary.total}`));
    lines.push(chalk.bold.cyan('═══════════════════════════════════════════'));
    lines.push('');

    if (results.length === 0) {
      lines.push(chalk.green('  ✓ No issues found.'));
      lines.push('');
      return lines.join('\n');
    }

    // 表格
    const table = this.buildTable(results);
    lines.push(table);
    lines.push('');

    // 底部 summary
    lines.push(chalk.bold.white('Summary:'));
    const severityOrder: Severity[] = [
      Severity.critical,
      Severity.high,
      Severity.moderate,
      Severity.low,
      Severity.info,
    ];

    for (const sev of severityOrder) {
      const count = summary.bySeverity[sev] ?? 0;
      if (count > 0) {
        lines.push(`  ${this.colorize(sev, `${sev.padEnd(9)} ${count}`)}`);
      }
    }

    lines.push(chalk.bold(`  ─────────────────────────`));
    lines.push(chalk.bold(`  Total:               ${summary.total}`));
    lines.push('');

    return lines.join('\n');
  }

  async write(report: AnalysisReport, _outputPath: string): Promise<void> {
    const output = await this.render(report);
    console.log(output);
  }

  // ---- 私有方法 ----

  private buildTable(results: AnalysisResult[]): string {
    // 列宽计算
    const sevWidth = 8;
    const ruleWidth = Math.min(
      Math.max(12, ...results.map((r) => (r.rule ?? '-').length)),
      24,
    );
    const locationWidth = Math.min(
      Math.max(18, ...results.map((r) => this.formatLocation(r).length)),
      40,
    );
    const msgWidth = Math.max(20, 80 - sevWidth - locationWidth - ruleWidth - 7);

    const sep = chalk.gray('│');
    const header = [
      chalk.bold.white('Severity'.padEnd(sevWidth)),
      sep,
      chalk.bold.white('File:Line'.padEnd(locationWidth)),
      sep,
      chalk.bold.white('Rule'.padEnd(ruleWidth)),
      sep,
      chalk.bold.white('Message'),
    ].join(' ');

    const divider = chalk.gray('─'.repeat(header.replace(/\x1B\[[0-9;]*m/g, '').length));

    const rows: string[] = [header, divider];

    for (const r of results) {
      const sevCol = this.colorize(r.severity, r.severity.padEnd(sevWidth));
      const locCol = this.truncate(this.formatLocation(r), locationWidth).padEnd(locationWidth);
      const ruleCol = this.truncate(r.rule ?? '-', ruleWidth).padEnd(ruleWidth);
      const msgCol = this.truncate(r.message, msgWidth);

      rows.push(`${sevCol} ${sep} ${locCol} ${sep} ${ruleCol} ${sep} ${msgCol}`);
    }

    return rows.join('\n');
  }

  private formatLocation(r: AnalysisResult): string {
    if (!r.file) return '-';
    const parts: string[] = [r.file];
    if (r.line != null) parts.push(String(r.line));
    if (r.column != null) parts.push(String(r.column));
    return parts.join(':');
  }

  private colorize(severity: Severity, text: string): string {
    switch (severity) {
      case Severity.critical:
        return chalk.red.bold(text);
      case Severity.high:
        return chalk.yellow(text);
      case Severity.moderate:
        return chalk.blue(text);
      case Severity.low:
        return chalk.gray(text);
      case Severity.info:
        return chalk.white(text);
      default:
        return text;
    }
  }

  private truncate(text: string, maxLen: number): string {
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen - 3) + '...';
  }
}
