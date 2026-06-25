// ============================================================
// Biu Auto-Optimizer — `biu-opt dashboard` 命令
// ============================================================

import { loadConfig } from '../config/loader.js';
import { info, warn } from '../utils/logger.js';

export interface DashboardOptions {
  port?: string;
}

export async function execute(options: DashboardOptions): Promise<void> {
  const config = await loadConfig();

  const port = parseInt(options.port ?? String(config.dashboard.port), 10);

  info(`📊 启动 Dashboard 看板: http://localhost:${port}`);

  try {
    const { DashboardServer } = await import('../dashboard/server.js');
    const server = new DashboardServer(config, port);
    await server.start();

    info(`✅ Dashboard 已启动，按 Ctrl+C 停止`);

    // 保持运行
    await new Promise<void>((resolve) => {
      const onSigint = () => {
        info('\n🛑 Dashboard 已停止');
        server.stop();
        process.off('SIGINT', onSigint);
        resolve();
      };
      process.on('SIGINT', onSigint);
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    warn(`Dashboard 启动失败: ${msg}`);
  }
}
