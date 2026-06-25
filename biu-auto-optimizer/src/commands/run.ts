// ============================================================
// Biu Auto-Optimizer — `biu-opt run` 命令
// ============================================================

import { loadConfig } from '../config/loader.js';
import { OptimizerRunner } from '../runners/optimizer.js';
import { info, warn } from '../utils/logger.js';

export interface RunOptions {
  dryRun?: boolean;
  analyzers?: string;
  all?: boolean;
  fix?: boolean;
  format?: string;
}

export async function execute(options: RunOptions): Promise<void> {
  const config = await loadConfig();

  if (options.dryRun) {
    info('🧪 Dry Run 模式 — 不会提交或回滚');
    // 临时覆盖配置
    config.autoFix = {
      ...config.autoFix,
      enabled: false,
    };
  }

  // 解析 --analyzers 选项
  const selectedAnalyzers = options.analyzers
    ? options.analyzers.split(',').map((s) => s.trim()).filter(Boolean)
    : undefined;

  if (selectedAnalyzers) {
    info(`🎯 限定分析器: ${selectedAnalyzers.join(', ')}`);

    // 临时启用选中的分析器
    for (const id of selectedAnalyzers) {
      if (config.analyzers[id]) {
        config.analyzers[id].enabled = true;
      } else {
        warn(`未知分析器: ${id}`);
      }
    }
  }

  info('🚀 启动全量优化周期...');

  const runner = new OptimizerRunner(config);
  const result = await runner.runFullCycle(selectedAnalyzers);

  info('');
  info('═══════════════════════════════════════════');
  info(`  结果: ${result.wasRolledBack ? '↩️ 已回滚' : '✅ 成功'}`);
  info(`  前置快照: ${result.beforeSnapshot.id}`);
  if (result.afterSnapshot) {
    info(`  后置快照: ${result.afterSnapshot.id}`);
  }
  if (result.comparison?.exceededThresholds.length) {
    info(`  超阈值: ${result.comparison.exceededThresholds.join(', ')}`);
  }
  info(`  发现问题: ${result.reports.reduce((s, r) => s + r.summary.total, 0)}`);
  if (result.fixes) {
    info(`  自动修复: ${result.fixes.auditFixed} 漏洞已修复, ${result.fixes.auditRemained} 剩余`);
  }
  info('═══════════════════════════════════════════');
}
