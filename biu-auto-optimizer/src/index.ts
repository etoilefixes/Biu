// ============================================================
// Biu Auto-Optimizer — 主入口
// ============================================================

import type { BiuOptConfig } from './config/types.js';
import { loadConfig } from './config/loader.js';
import * as logger from './utils/logger.js';

/**
 * 运行结果信息
 */
export interface RunResult {
  /** 是否成功 */
  success: boolean;
  /** 退出码 */
  exitCode: number;
  /** 错误信息（如有） */
  error?: string;
}

/**
 * 执行自动优化流程的主函数
 *
 * 流程：加载配置 → 运行分析器 → 生成报告
 * 完整优化闭环（快照→分析→修复→对比→回滚）在后续 T03 中由 OptimizerRunner 实现
 *
 * @param configOverride - 可选的配置覆盖项
 * @returns 运行结果，包含退出码
 */
export async function run(configOverride?: Partial<BiuOptConfig>): Promise<RunResult> {
  try {
    logger.info('Biu Auto-Optimizer 启动中...');

    // 加载配置
    const config = await loadConfig();
    const finalConfig = configOverride
      ? { ...config, ...configOverride }
      : config;

    logger.debug(`配置加载完成: rootDir=${finalConfig.rootDir}`);
    logger.debug(`启用分析器: ${Object.entries(finalConfig.analyzers)
      .filter(([, v]) => v?.enabled)
      .map(([k]) => k)
      .join(', ')}`);

    // TODO: T03 实现完整的分析器调度和报告生成流程
    logger.info('分析器和 Runner 将在 T02/T03 中实现');

    return { success: true, exitCode: 0 };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '未知错误';
    logger.error(`运行失败: ${message}`);
    return { success: false, exitCode: 1, error: message };
  }
}
