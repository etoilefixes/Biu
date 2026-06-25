// ============================================================
// Biu Auto-Optimizer — CLI 入口 (Commander)
// ============================================================

import { Command } from 'commander';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string; description: string };

const program = new Command();

program
  .name('biu-opt')
  .description(pkg.description || 'Biu 项目自迭代自动化优化工具')
  .version(pkg.version || '1.0.0');

// ---- lint ----
program
  .command('lint')
  .description('运行代码审查 (ESLint + TypeScript strict)')
  .option('--fix', '自动修复可修复的问题')
  .option('--format <format>', '输出格式 (cli|json|md)', 'cli')
  .action(async (options) => {
    const { execute } = await import('./commands/lint.js');
    await execute(options);
  });

// ---- security ----
program
  .command('security')
  .description('安全漏洞扫描 (npm audit + .env 密钥扫描)')
  .option('--format <format>', '输出格式 (cli|json|md)', 'cli')
  .action(async (options) => {
    const { execute } = await import('./commands/security.js');
    await execute(options);
  });

// ---- deps:check ----
program
  .command('deps:check')
  .description('依赖检查 (npm outdated + changelog 分析)')
  .option('--format <format>', '输出格式 (cli|json|md)', 'cli')
  .action(async (options) => {
    const { execute } = await import('./commands/deps.js');
    await execute({ ...options, subCommand: 'check' });
  });

// ---- deps:update ----
program
  .command('deps:update')
  .description('自动更新非破坏性依赖')
  .option('--dry-run', '仅预览，不执行实际更新')
  .action(async (options) => {
    const { execute } = await import('./commands/deps.js');
    await execute({ ...options, subCommand: 'update' });
  });

// ---- changelog ----
program
  .command('changelog')
  .description('生成变更日志 (基于 Conventional Commits)')
  .option('--from <tag>', '起始 tag')
  .option('--output <path>', '输出文件路径', 'CHANGELOG.md')
  .option('--append', '追加到现有文件', false)
  .action(async (options) => {
    const { execute } = await import('./commands/changelog.js');
    await execute(options);
  });

// ---- run ----
program
  .command('run')
  .description('全量扫描与自动优化')
  .option('--dry-run', '仅分析不修复')
  .option('--analyzers <ids>', '限定分析器（逗号分隔）')
  .action(async (options) => {
    const { execute } = await import('./commands/run.js');
    await execute(options);
  });

// ---- rollback ----
program
  .command('rollback')
  .description('回滚到指定快照')
  .option('--to <snapshot-id>', '目标快照 ID')
  .option('--last', '回滚到最近一次快照')
  .option('--list', '列出所有可用快照')
  .option('--yes', '跳过确认，直接执行')
  .action(async (options) => {
    const { execute } = await import('./commands/rollback.js');
    await execute(options);
  });

// ---- perf ----
program
  .command('perf')
  .description('性能基准测试 (autocannon)')
  .option('--endpoints <urls>', '目标 API 端点（逗号分隔）')
  .option('--format <format>', '输出格式 (cli|json|md)', 'cli')
  .action(async (options) => {
    const { execute } = await import('./commands/perf.js');
    await execute(options);
  });

// ---- dashboard ----
program
  .command('dashboard')
  .description('启动 Dashboard Web 界面')
  .option('--port <port>', '监听端口', '4000')
  .action(async (options) => {
    const { execute } = await import('./commands/dashboard.js');
    await execute(options);
  });

// ---- 占位命令（后续版本实现） ----

// ---- nightly ----
program
  .command('nightly')
  .description('夜间自动优化窗口')
  .option('--once', '仅运行一次（供 CI 调用）')
  .option('--schedule <time>', '调度时间 (HH:mm)')
  .action(async (options) => {
    const { execute } = await import('./commands/nightly.js');
    await execute(options);
  });

export { program };

// 仅在直接运行时解析 CLI 参数
const isDirectRun =
  process.argv[1]?.endsWith('cli.ts') ||
  process.argv[1]?.endsWith('cli.js') ||
  process.argv[1]?.includes('tsx');

if (isDirectRun) {
  program.parse();
}
