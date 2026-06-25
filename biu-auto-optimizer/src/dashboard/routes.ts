// ============================================================
// Biu Auto-Optimizer — Dashboard API 路由
// ============================================================

import type { Express, Request, Response } from 'express';
import type { BiuOptConfig } from '../config/types.js';
import { SnapshotStore } from '../snapshots/store.js';
import { resolve } from 'node:path';
import { readdir } from 'node:fs/promises';

/**
 * 注册 Dashboard API 路由
 *
 * GET /api/trends?range=7|30|90 — 趋势数据
 * GET /api/summary — 最新快照摘要
 * GET /api/reports — 最近报告列表
 */
export function registerRoutes(app: Express, config: BiuOptConfig): void {
  const rootDir = resolve(config.rootDir);

  // ---- 趋势数据 ----
  app.get('/api/trends', async (req: Request, res: Response) => {
    try {
      const range = parseInt((req.query.range as string) ?? '7', 10);
      const store = new SnapshotStore(rootDir);
      const snapshots = await store.list(range);

      // 构建趋势数据
      const trends = snapshots.map((snap) => ({
        id: snap.id,
        timestamp: snap.timestamp,
        lintErrors: snap.metrics.lintErrors,
        lintWarnings: snap.metrics.lintWarnings,
        securityCritical: snap.metrics.securityVulnerabilities.critical,
        securityHigh: snap.metrics.securityVulnerabilities.high,
        securityModerate: snap.metrics.securityVulnerabilities.moderate,
        outdatedDeps: snap.metrics.outdatedDependencies,
        buildTimeMs: snap.metrics.buildTimeMs,
        typeCoveragePercent: snap.metrics.typeCoveragePercent,
      }));

      res.json({ trends, count: trends.length, range });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  // ---- 摘要 ----
  app.get('/api/summary', async (_req: Request, res: Response) => {
    try {
      const store = new SnapshotStore(rootDir);
      const latest = await store.getLatest();

      if (!latest) {
        res.json({ available: false, message: '暂无快照数据' });
        return;
      }

      // 获取第二个快照用于对比
      const allSnapshots = await store.list(2);
      const previous = allSnapshots.length > 1 ? allSnapshots[1] : null;

      const summary = {
        available: true,
        current: {
          id: latest.id,
          timestamp: latest.timestamp,
          gitHash: latest.gitHash,
          gitBranch: latest.gitBranch,
          metrics: latest.metrics,
        },
        previous: previous
          ? {
              id: previous.id,
              timestamp: previous.timestamp,
              metrics: previous.metrics,
            }
          : null,
        delta: previous
          ? {
              lintErrors: latest.metrics.lintErrors - previous.metrics.lintErrors,
              lintWarnings:
                latest.metrics.lintWarnings - previous.metrics.lintWarnings,
              securityCritical:
                latest.metrics.securityVulnerabilities.critical -
                previous.metrics.securityVulnerabilities.critical,
              securityHigh:
                latest.metrics.securityVulnerabilities.high -
                previous.metrics.securityVulnerabilities.high,
              outdatedDeps:
                latest.metrics.outdatedDependencies -
                previous.metrics.outdatedDependencies,
            }
          : null,
      };

      res.json(summary);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  // ---- 报告列表 ----
  app.get('/api/reports', async (req: Request, res: Response) => {
    try {
      const reportsDir = resolve(rootDir, config.reporting.outputDir);
      const files = await readdir(reportsDir).catch(() => [] as string[]);

      const reports = files
        .filter((f) => f.endsWith('.json'))
        .sort()
        .reverse()
        .slice(0, 20)
        .map((f) => ({
          name: f,
          path: `${config.reporting.outputDir}/${f}`,
          timestamp: f.match(/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/)?.[0] ?? '',
        }));

      res.json({ reports });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  // ---- 健康检查 ----
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
}
