// ============================================================
// Biu Auto-Optimizer — `biu-opt nightly` 命令
// ============================================================

import { loadConfig } from '../config/loader.js';
import { OptimizerRunner } from '../runners/optimizer.js';
import { GitRunner } from '../runners/git.js';
import { NpmRunner } from '../runners/npm.js';
import { info, warn } from '../utils/logger.js';
import { resolve } from 'node:path';

export interface NightlyOptions {
  once?: boolean;
  schedule?: string;
}

export async function execute(options: NightlyOptions): Promise<void> {
  const config = await loadConfig();
  const rootDir = resolve(config.rootDir);

  if (options.once) {
    await runOnce(config, rootDir);
  } else if (options.schedule) {
    await runScheduled(config, rootDir, options.schedule);
  } else if (config.nightly.enabled && config.nightly.schedule) {
    await runScheduled(config, rootDir, config.nightly.schedule);
  } else {
    // 默认：运行一次
    await runOnce(config, rootDir);
  }
}

// ---- once 模式 ----

async function runOnce(
  config: import('../config/types.js').BiuOptConfig,
  rootDir: string,
): Promise<void> {
  info('🌙 夜间优化窗口 — 单次执行');

  const runner = new OptimizerRunner(config);
  const result = await runner.runFullCycle();

  info('');
  info('═══════════════════════════════════════════');
  info(`  夜间优化结果: ${result.wasRolledBack ? '↩️ 已回滚' : '✅ 成功'}`);
  info(`  发现问题: ${result.reports.reduce((s, r) => s + r.summary.total, 0)}`);

  if (result.fixes) {
    info(`  自动修复: ${result.fixes.auditFixed} 漏洞已修复`);
  }

  // 运行测试
  if (!result.wasRolledBack && !config.autoFix.autoMergeLowRisk) {
    const git = new GitRunner(rootDir);
    const npm = new NpmRunner(rootDir);

    try {
      info('🧪 运行测试...');
      const { exec } = await import('../utils/exec.js');
      const testResult = await exec('npm', ['test'], {
        cwd: rootDir,
        timeout: 120_000,
      });

      if (testResult.exitCode === 0) {
        info('✅ 测试通过');

        if (config.nightly.autoCreatePR) {
          try {
            const branch = await git.getCurrentBranch();
            if (branch.startsWith('biu-opt/')) {
              await git.push(branch);
              info(`📤 分支 ${branch} 已推送，请手动创建 PR`);
            }
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            warn(`推送失败: ${msg}`);
          }
        }
      } else {
        warn('❌ 测试失败，清理优化分支...');
        try {
          const mainBranch = await git.getCurrentBranch();
          await git.checkout('main');
          await git.deleteBranch(mainBranch);
        } catch {
          warn('清理分支失败');
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      warn(`测试执行失败: ${msg}`);
    }
  }

  info('═══════════════════════════════════════════');
}

// ---- schedule 模式 ----

async function runScheduled(
  config: import('../config/types.js').BiuOptConfig,
  rootDir: string,
  schedule: string,
): Promise<void> {
  // 动态导入 node-cron
  let cron: {
    schedule: (
      expression: string,
      callback: () => void,
    ) => { stop: () => void };
  };

  try {
    cron = (await import('node-cron')) as unknown as typeof cron;
  } catch {
    warn('node-cron 未安装，无法使用调度模式。请运行 npm install node-cron');
    info('将改为单次执行模式');
    await runOnce(config, rootDir);
    return;
  }

  const [hour, minute] = schedule.split(':');

  if (!hour || !minute) {
    warn(`无效的调度时间: ${schedule}，应为 HH:mm 格式`);
    return;
  }

  const cronExpression = `${parseInt(minute)} ${parseInt(hour)} * * *`;

  info(`🌙 夜间优化窗口已调度: 每天 ${schedule}`);
  info(`   Cron 表达式: ${cronExpression}`);
  info(`   按 Ctrl+C 停止`);

  const task = cron.schedule(cronExpression, async () => {
    info(`⏰ 夜间优化窗口触发 — ${new Date().toLocaleString()}`);
    await runOnce(config, rootDir);
  });

  // 显示下次执行时间
  const now = new Date();
  const nextRun = new Date(now);
  nextRun.setHours(parseInt(hour), parseInt(minute), 0, 0);
  if (nextRun <= now) {
    nextRun.setDate(nextRun.getDate() + 1);
  }
  info(`   下次执行: ${nextRun.toLocaleString()}`);

  // 保持运行
  await new Promise<void>((resolve) => {
    const onSigint = () => {
      info('\n🛑 夜间窗口已停止');
      task.stop();
      process.off('SIGINT', onSigint);
      resolve();
    };
    process.on('SIGINT', onSigint);
  });
}
