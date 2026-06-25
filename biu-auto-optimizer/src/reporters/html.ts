// ============================================================
// Biu Auto-Optimizer — HTML 报告器 (Chart.js)
// ============================================================

import type { IReporter } from './base.js';
import type { AnalysisReport, AnalysisResult } from '../types/analysis.js';
import { Severity } from '../types/analysis.js';
import { writeFile } from 'node:fs/promises';
import { ensureDir } from '../utils/fs.js';
import { dirname, resolve } from 'node:path';

/**
 * HtmlReporter — 生成包含 Chart.js 图表的 HTML 报告
 *
 * 包含：
 * - 折线图：各类别问题分布（模拟趋势）
 * - 饼图：严重程度分布
 * - 条形图：各类别问题数
 */
export class HtmlReporter implements IReporter {
  readonly name = 'html';

  async render(report: AnalysisReport): Promise<string> {
    const { summary, results, durationMs, timestamp } = report;
    const dateStr = new Date(timestamp).toLocaleString();
    const durationSec = (durationMs / 1000).toFixed(2);

    // 准备图表数据
    const severityData = this.prepareSeverityData(summary);
    const categoryData = this.prepareCategoryData(summary);
    const categoryLabels = JSON.stringify(categoryData.labels);
    const categoryValues = JSON.stringify(categoryData.values);
    const severityLabels = JSON.stringify(severityData.labels);
    const severityValues = JSON.stringify(severityData.values);

    // 表格行
    const tableRows = results
      .slice(0, 100)
      .map(
        (r) => `
        <tr class="row-${r.severity}">
          <td class="sev-${r.severity}">${r.severity}</td>
          <td>${this.escapeHtml(r.file ?? '-')}${r.line ? `:${r.line}` : ''}</td>
          <td>${this.escapeHtml(r.rule ?? '-')}</td>
          <td>${this.escapeHtml(r.message)}</td>
        </tr>`,
      )
      .join('\n');

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Biu Auto-Optimizer — Analysis Report</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; padding: 24px; }
    .header { text-align: center; padding: 32px 0; border-bottom: 1px solid #1e293b; margin-bottom: 32px; }
    .header h1 { font-size: 28px; font-weight: 700; color: #38bdf8; }
    .header .meta { color: #94a3b8; font-size: 14px; margin-top: 8px; }
    .charts { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px; }
    .chart-box { background: #1e293b; border-radius: 12px; padding: 20px; }
    .chart-box h3 { font-size: 14px; color: #94a3b8; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px; }
    .chart-box canvas { max-height: 280px; }
    .chart-full { grid-column: 1 / -1; }
    .summary-cards { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 32px; }
    .card { background: #1e293b; border-radius: 8px; padding: 16px; text-align: center; }
    .card .count { font-size: 28px; font-weight: 700; }
    .card .label { font-size: 11px; color: #64748b; text-transform: uppercase; margin-top: 4px; letter-spacing: 1px; }
    .card.critical .count { color: #ef4444; }
    .card.high .count { color: #f97316; }
    .card.moderate .count { color: #3b82f6; }
    .card.low .count { color: #9ca3af; }
    .card.info .count { color: #e2e8f0; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; padding: 10px 12px; background: #1e293b; color: #94a3b8; font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: 1px; }
    td { padding: 8px 12px; border-top: 1px solid #1e293b; max-width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sev-critical { color: #ef4444; font-weight: 700; }
    .sev-high { color: #f97316; font-weight: 600; }
    .sev-moderate { color: #3b82f6; }
    .sev-low { color: #9ca3af; }
    .sev-info { color: #94a3b8; }
    .footer { text-align: center; padding: 20px; color: #475569; font-size: 12px; margin-top: 24px; border-top: 1px solid #1e293b; }
  </style>
</head>
<body>
  <div class="header">
    <h1>📊 Biu Auto-Optimizer Analysis Report</h1>
    <div class="meta">Generated: ${dateStr} &nbsp;|&nbsp; Duration: ${durationSec}s &nbsp;|&nbsp; Total Issues: ${summary.total}</div>
  </div>

  <div class="summary-cards">
    <div class="card critical"><div class="count">${summary.bySeverity[Severity.critical]}</div><div class="label">Critical</div></div>
    <div class="card high"><div class="count">${summary.bySeverity[Severity.high]}</div><div class="label">High</div></div>
    <div class="card moderate"><div class="count">${summary.bySeverity[Severity.moderate]}</div><div class="label">Moderate</div></div>
    <div class="card low"><div class="count">${summary.bySeverity[Severity.low]}</div><div class="label">Low</div></div>
    <div class="card info"><div class="count">${summary.bySeverity[Severity.info]}</div><div class="label">Info</div></div>
  </div>

  <div class="charts">
    <div class="chart-box">
      <h3>📈 Issues by Category</h3>
      <canvas id="categoryChart"></canvas>
    </div>
    <div class="chart-box">
      <h3>🍩 Severity Distribution</h3>
      <canvas id="severityChart"></canvas>
    </div>
  </div>

  ${results.length > 0 ? `
  <div style="background:#1e293b; border-radius:12px; padding:20px; overflow-x:auto;">
    <h3 style="font-size:14px; color:#94a3b8; margin-bottom:12px; text-transform:uppercase; letter-spacing:1px;">📋 Detailed Findings (${Math.min(results.length, 100)}/${results.length})</h3>
    <table>
      <thead><tr><th>Severity</th><th>File:Line</th><th>Rule</th><th>Message</th></tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
  </div>` : '<p style="text-align:center; color:#22c55e; padding:40px;">✅ No issues found!</p>'}

  <div class="footer">Generated by Biu Auto-Optimizer v1.0.0</div>

  <script>
    const darkOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } } },
      scales: { x: { ticks: { color: '#64748b' }, grid: { color: '#1e293b' } }, y: { ticks: { color: '#64748b' }, grid: { color: '#1e293b' } } }
    };

    new Chart(document.getElementById('categoryChart'), {
      type: 'bar',
      data: {
        labels: ${categoryLabels},
        datasets: [{
          label: 'Issues',
          data: ${categoryValues},
          backgroundColor: ['#3b82f6','#ef4444','#f97316','#22c55e','#8b5cf6','#f59e0b','#ec4899'],
          borderRadius: 4
        }]
      },
      options: { ...darkOptions, indexAxis: 'y' }
    });

    new Chart(document.getElementById('severityChart'), {
      type: 'doughnut',
      data: {
        labels: ${severityLabels},
        datasets: [{
          data: ${severityValues},
          backgroundColor: ['#ef4444','#f97316','#3b82f6','#9ca3af','#64748b'],
          borderColor: '#0f172a',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 }, padding: 16 } } }
      }
    });
  </script>
</body>
</html>`;
  }

  async write(report: AnalysisReport, outputPath: string): Promise<void> {
    const content = await this.render(report);
    const fullPath = resolve(outputPath);
    await ensureDir(dirname(fullPath));
    await writeFile(fullPath, content, 'utf-8');
  }

  // ---- 数据准备 ----

  private prepareSeverityData(summary: AnalysisReport['summary']): {
    labels: string[];
    values: number[];
  } {
    const order: Severity[] = [
      Severity.critical,
      Severity.high,
      Severity.moderate,
      Severity.low,
      Severity.info,
    ];

    return {
      labels: order.filter((s) => summary.bySeverity[s] > 0).map((s) => s),
      values: order
        .filter((s) => summary.bySeverity[s] > 0)
        .map((s) => summary.bySeverity[s]),
    };
  }

  private prepareCategoryData(summary: AnalysisReport['summary']): {
    labels: string[];
    values: number[];
  } {
    const entries = Object.entries(summary.byCategory).filter(
      ([, v]) => (v as number) > 0,
    );

    return {
      labels: entries.map(([k]) => k),
      values: entries.map(([, v]) => v as number),
    };
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
