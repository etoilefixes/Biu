// ============================================================
// Biu Auto-Optimizer — Markdown 报告器
// ============================================================

import type { IReporter } from './base.js';
import type { AnalysisReport } from '../types/analysis.js';
import { Severity } from '../types/analysis.js';
import { writeFile } from 'node:fs/promises';
import { ensureDir } from '../utils/fs.js';
import { dirname, resolve } from 'node:path';

/**
 * MarkdownReporter — 生成 Markdown 格式报告文件
 *
 * 输出结构：
 * # Analysis Report: {category}
 * - 时间戳 + 运行时长
 * - 按 severity 分组的表格
 * - summary 统计
 */
export class MarkdownReporter implements IReporter {
  readonly name = 'markdown';

  async render(report: AnalysisReport): Promise<string> {
    const lines: string[] = [];
    const { summary, results, durationMs, timestamp } = report;
    const durationSec = (durationMs / 1000).toFixed(2);

    // 标题
    lines.push(`# Analysis Report`);
    lines.push('');
    lines.push(`> **Generated:** ${new Date(timestamp).toLocaleString()}`);
    lines.push(`> **Duration:** ${durationSec}s`);
    lines.push(`> **Total Issues:** ${summary.total}`);
    lines.push('');

    if (results.length === 0) {
      lines.push('✅ **No issues found.**');
      lines.push('');
      return lines.join('\n');
    }

    // 按 severity 分组输出表格
    const severityOrder: Severity[] = [
      Severity.critical,
      Severity.high,
      Severity.moderate,
      Severity.low,
      Severity.info,
    ];

    for (const sev of severityOrder) {
      const sevResults = results.filter((r) => r.severity === sev);
      if (sevResults.length === 0) continue;

      const emoji = this.severityEmoji(sev);
      lines.push(`## ${emoji} ${sev.charAt(0).toUpperCase() + sev.slice(1)} (${sevResults.length})`);
      lines.push('');
      lines.push('| File | Line | Rule | Message |');
      lines.push('|------|------|------|---------|');

      for (const r of sevResults) {
        const file = r.file ? `\`${this.shortPath(r.file)}\`` : '-';
        const loc = r.line != null ? String(r.line) : '-';
        const rule = r.rule ? `\`${r.rule}\`` : '-';
        const msg = this.escapeMd(r.message);
        lines.push(`| ${file} | ${loc} | ${rule} | ${msg} |`);
      }

      lines.push('');
    }

    // Summary
    lines.push('## 📊 Summary');
    lines.push('');
    lines.push('| Severity | Count |');
    lines.push('|----------|-------|');

    for (const sev of severityOrder) {
      const count = summary.bySeverity[sev] ?? 0;
      if (count > 0 || sev === Severity.critical || sev === Severity.high) {
        const emoji = this.severityEmoji(sev);
        lines.push(`| ${emoji} ${sev} | ${count} |`);
      }
    }

    lines.push('');
    lines.push(`**Total:** ${summary.total}`);
    lines.push('');

    return lines.join('\n');
  }

  async write(report: AnalysisReport, outputPath: string): Promise<void> {
    const content = await this.render(report);
    const fullPath = resolve(outputPath);
    await ensureDir(dirname(fullPath));
    await writeFile(fullPath, content, 'utf-8');
  }

  // ---- 私有方法 ----

  private severityEmoji(severity: Severity): string {
    switch (severity) {
      case Severity.critical:
        return '🔴';
      case Severity.high:
        return '🟠';
      case Severity.moderate:
        return '🔵';
      case Severity.low:
        return '⚪';
      case Severity.info:
        return 'ℹ️';
      default:
        return '•';
    }
  }

  private escapeMd(text: string): string {
    return text
      .replace(/\|/g, '\\|')
      .replace(/\n/g, ' ')
      .trim();
  }

  private shortPath(filePath: string): string {
    // 截断为相对路径显示
    const parts = filePath.replace(/\\/g, '/').split('/');
    const idx = parts.findIndex((p) => p === 'src');
    if (idx >= 0) {
      return parts.slice(idx).join('/');
    }
    return parts.slice(-3).join('/');
  }
}
