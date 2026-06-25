// ============================================================
// Biu Auto-Optimizer — JSON 报告器
// ============================================================

import type { IReporter } from './base.js';
import type { AnalysisReport } from '../types/analysis.js';
import { writeJSON } from '../utils/fs.js';
import { resolve } from 'node:path';

/**
 * JsonReporter — JSON 文件输出
 *
 * render(): JSON.stringify 美化
 * write(): 写入 .biu-opt/reports/ 目录
 */
export class JsonReporter implements IReporter {
  readonly name = 'json';

  async render(report: AnalysisReport): Promise<string> {
    return JSON.stringify(report, null, 2);
  }

  async write(report: AnalysisReport, outputPath: string): Promise<void> {
    const fullPath = resolve(outputPath);
    await writeJSON(fullPath, report, true);
  }
}
