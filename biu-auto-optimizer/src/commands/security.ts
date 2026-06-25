// ============================================================
// Biu Auto-Optimizer — `biu-opt security` 命令
// ============================================================

import { loadConfig } from '../config/loader.js';
import { SecurityAnalyzer } from '../analyzers/security-scan.js';
import { CliReporter } from '../reporters/cli.js';
import { MarkdownReporter } from '../reporters/markdown.js';
import { JsonReporter } from '../reporters/json.js';
import { info } from '../utils/logger.js';
import { resolve } from 'node:path';

export interface SecurityOptions {
  format?: string;
}

export async function execute(options: SecurityOptions): Promise<void> {
  const config = await loadConfig();
  const format = options.format ?? 'cli';

  info('🛡️  运行安全扫描 (npm audit + .env 密钥扫描)...');

  const analyzer = new SecurityAnalyzer();
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
      const content = await reporter.render(report);
      console.log(content);
      break;
    }
    case 'md':
    case 'markdown': {
      const reporter = new MarkdownReporter();
      const outPath = resolve(rootDir, outputDir, `report-security-${ts}.md`);
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
