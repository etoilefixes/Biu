// ============================================================
// Biu Auto-Optimizer — `biu-opt rollback` 命令
// ============================================================

import { loadConfig } from '../config/loader.js';
import { SnapshotStore } from '../snapshots/store.js';
import { GitRunner } from '../runners/git.js';
import { evaluateRollback } from '../snapshots/rollback.js';
import { info, warn } from '../utils/logger.js';
import { resolve } from 'node:path';

export interface RollbackOptions {
  to?: string;
  last?: boolean;
  list?: boolean;
  yes?: boolean;
}

export async function execute(options: RollbackOptions): Promise<void> {
  const config = await loadConfig();
  const rootDir = resolve(config.rootDir);
  const store = new SnapshotStore(rootDir);
  const git = new GitRunner(rootDir);

  // --list: 列出所有快照
  if (options.list) {
    const snapshots = await store.list(50);
    if (snapshots.length === 0) {
      info('没有可用的快照');
      return;
    }

    info(`找到 ${snapshots.length} 个快照:\n`);
    for (const snap of snapshots) {
      const date = new Date(snap.timestamp).toLocaleString();
      info(`  ${snap.id}  ${date}  (${snap.gitBranch}@${snap.gitHash})`);
    }
    return;
  }

  // --last: 回滚到最近一次快照
  if (options.last) {
    const latest = await store.getLatest();
    if (!latest) {
      info('没有可用的快照');
      return;
    }
    options.to = latest.id;
  }

  // --to <snapshot-id>: 手动回滚
  if (!options.to) {
    warn('请指定回滚目标: --to <snapshot-id> 或 --last');
    return;
  }

  const targetSnapshot = await store.load(options.to);

  // 显示对比数据
  info(`\n即将回滚到快照: ${targetSnapshot.id}`);
  info(`  时间: ${new Date(targetSnapshot.timestamp).toLocaleString()}`);
  info(`  分支: ${targetSnapshot.gitBranch}`);
  info(`  Commit: ${targetSnapshot.gitHash}`);
  info(`  Lint Errors: ${targetSnapshot.metrics.lintErrors}`);
  info(`  Security: critical=${targetSnapshot.metrics.securityVulnerabilities.critical}, high=${targetSnapshot.metrics.securityVulnerabilities.high}`);
  info(`  Outdated Deps: ${targetSnapshot.metrics.outdatedDependencies}`);

  // 尝试获取当前快照对比
  try {
    const latest = await store.getLatest();
    if (latest && latest.id !== targetSnapshot.id) {
      const comparison = await store.compare(targetSnapshot.id, latest.id);
      const rollbackResult = evaluateRollback(
        targetSnapshot,
        latest,
        config.thresholds,
      );

      if (rollbackResult.shouldRollback) {
        info(`\n⚠️  当前状态超出阈值: ${rollbackResult.exceeded.join(', ')}`);
      }
    }
  } catch {
    // 无法对比，继续
  }

  // 确认（非交互式）
  if (!options.yes) {
    info('\n⚠️  回滚将执行 git reset --hard，所有未提交更改将丢失！');
    info('添加 --yes 参数以确认回滚');
    return;
  }

  // 执行回滚
  try {
    info(`\n↩️  回滚到 ${targetSnapshot.gitHash}...`);
    await git.resetHard(targetSnapshot.gitHash);
    info('✅ 回滚完成');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    warn(`回滚失败: ${msg}`);
  }
}
