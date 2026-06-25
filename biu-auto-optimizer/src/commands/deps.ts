// ============================================================
// Biu Auto-Optimizer — `biu-opt deps` 命令
// ============================================================

import { loadConfig } from '../config/loader.js';
import { DependencyCheckAnalyzer } from '../analyzers/dependency-check.js';
import { CliReporter } from '../reporters/cli.js';
import { MarkdownReporter } from '../reporters/markdown.js';
import { JsonReporter } from '../reporters/json.js';
import { NpmRunner } from '../runners/npm.js';
import { GitRunner } from '../runners/git.js';
import { info, warn } from '../utils/logger.js';
import { resolve } from 'node:path';

export interface DepsOptions {
  check?: boolean;
  update?: boolean;
  dryRun?: boolean;
  format?: string;
  subCommand?: string;
}

export async function execute(options: DepsOptions): Promise<void> {
  const config = await loadConfig();
  const format = options.format ?? 'cli';
  const rootDir = resolve(config.rootDir);

  if (options.check || options.subCommand === 'check') {
    await runCheck(config, format, rootDir);
  } else if (options.update || options.subCommand === 'update') {
    await runUpdate(config, options.dryRun ?? false, rootDir);
  } else {
    // 默认 = check
    await runCheck(config, format, rootDir);
  }
}

async function runCheck(
  config: import('../config/types.js').BiuOptConfig,
  format: string,
  rootDir: string,
): Promise<void> {
  info('📦 运行依赖检查 (npm outdated + changelog 分析)...');

  const analyzer = new DependencyCheckAnalyzer();
  const report = await analyzer.analyze(config);

  await outputReport(report, format, rootDir, config.reporting.outputDir, 'deps');
}

async function runUpdate(
  config: import('../config/types.js').BiuOptConfig,
  dryRun: boolean,
  rootDir: string,
): Promise<void> {
  info('📦 运行依赖更新...');

  const analyzer = new DependencyCheckAnalyzer();
  const report = await analyzer.analyze(config);

  // 筛选非破坏性更新
  const nonBreakingDeps: string[] = [];
  for (const r of report.results) {
    const md = r.metadata as Record<string, unknown> | undefined;
    if (md && !md.breaking) {
      const pkg = md.package as string | undefined;
      if (pkg) nonBreakingDeps.push(pkg);
    }
  }

  if (nonBreakingDeps.length === 0) {
    info('没有可安全更新的依赖');
    return;
  }

  info(`可安全更新的依赖: ${nonBreakingDeps.join(', ')}`);

  if (dryRun) {
    info('[dry-run] 不会执行实际更新');
    return;
  }

  // 创建分支
  const git = new GitRunner(rootDir);
  const npm = new NpmRunner(rootDir);
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const branchName = `biu-opt/deps-update-${ts}`;

  try {
    await git.createBranch(branchName);
    await npm.update(nonBreakingDeps);
    await git.commit('chore(biu-opt): update non-breaking dependencies');
    info(`✅ 依赖已更新，分支: ${branchName}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    warn(`依赖更新失败: ${msg}`);
  }
}

async function outputReport(
  report: import('../types/analysis.js').AnalysisReport,
  format: string,
  rootDir: string,
  outputDir: string,
  label: string,
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
      const outPath = resolve(rootDir, outputDir, `report-${label}-${ts}.md`);
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
