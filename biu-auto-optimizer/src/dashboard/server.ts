// ============================================================
// Biu Auto-Optimizer — Dashboard Express 服务器
// ============================================================

import express, { type Express } from 'express';
import type { BiuOptConfig } from '../config/types.js';
import { registerRoutes } from './routes.js';
import { info, debug } from '../utils/logger.js';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Server } from 'node:http';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * DashboardServer — Express 看板服务器
 *
 * 服务静态 HTML + API 路由
 */
export class DashboardServer {
  private readonly app: Express;
  private readonly config: BiuOptConfig;
  private readonly port: number;
  private server: Server | null = null;

  constructor(config: BiuOptConfig, port?: number) {
    this.config = config;
    this.port = port ?? config.dashboard.port;
    this.app = express();

    this.setup();
  }

  private setup(): void {
    // 静态文件
    const publicDir = resolve(__dirname, 'public');
    this.app.use(express.static(publicDir));

    // JSON 解析
    this.app.use(express.json());

    // API 路由
    registerRoutes(this.app, this.config);

    debug(`[dashboard] 静态文件目录: ${publicDir}`);
  }

  async start(): Promise<void> {
    return new Promise((resolvePromise, reject) => {
      this.server = this.app.listen(this.port, () => {
        info(`📊 Dashboard 运行于 http://localhost:${this.port}`);
        resolvePromise();
      });

      this.server.on('error', (err: Error) => {
        reject(err);
      });
    });
  }

  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}
