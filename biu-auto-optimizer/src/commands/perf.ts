// ============================================================
// Biu Auto-Optimizer — `biu-opt perf` 命令
// ============================================================

import { loadConfig } from '../config/loader.js';
import { PerformanceAnalyzer } from '../analyzers/performance.js';
import { CliReporter } from '../reporters/cli.js';
import { MarkdownReporter } from '../reporters/markdown.js';
import { JsonReporter } from '../reporters/json.js';
import { info } from '../utils/logger.js';
import { resolve } from 'node:path';

export interface PerfOptions {
  endpoints?: string;
  format?: string;
}

export async function execute(options: PerfOptions): Promise<void> {
  const config = await loadConfig();
  const format = options.format ?? 'cli';

  // 如果命令行指定了 endpoints，临时覆盖配置
  if (options.endpoints) {
    const endpoints = options.endpoints.split(',').map((s) => s.trim()).filter(Boolean);
    config.analyzers['performance'] = {
      enabled: true,
      options: { endpoints },
    };
  }

  // 确保 performance analyzer 启用
  const perfCfg = config.analyzers['performance'];
  if (!perfCfg) {
    config.analyzers['performance'] = {
      enabled: true,
      options: { endpoints: ['http://localhost:3000/api/health'] },
    };
  }

  info('⚡ 运行性能基准测试 (autocannon)...');

  const analyzer = new PerformanceAnalyzer();
  const report = await analyzer.analyze(config);

  await outputReport(report, format, config.rootDir, config.reporting.outputDir);
}

async function outputReport(
  report: import('../types/analysis.js').AnalysisReport,
  format: string,
  rootDir: string,
  outputDir: string,
): Promise<void> {
  const ts = report.timestamp.replace(/[:.]/g, '-').slice(0, 19);

  switch (format) {
    case 'json': {
      const reporter = new JsonReporter();
      console.log(await reporter.render(report));
      break;
    }
    case 'md':
    case 'markdown': {
      const reporter = new MarkdownReporter();
      const outPath = resolve(rootDir, outputDir, `report-performance-${ts}.md`);
      await reporter.write(report, outPath);
      info(`📄 报告已写入: ${outPath}`);
      break;
    }
    default: {
      const reporter = new CliReporter();
      await reporter.write(report, '');
      break;
    }
  }
}
