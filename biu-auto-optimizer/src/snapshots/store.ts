// ============================================================
// Biu Auto-Optimizer — 快照持久化存储
// ============================================================

import type {
  MetricSnapshot,
  MetricsDelta,
  SnapshotComparison,
} from '../types/snapshot.js';
import { ensureDir, readJSON, writeJSON } from '../utils/fs.js';
import { debug, warn } from '../utils/logger.js';
import { resolve } from 'node:path';
import { readdir, unlink } from 'node:fs/promises';

/** 快照存储目录 */
const SNAPSHOT_DIR = '.biu-opt/snapshots';

/**
 * 获取快照文件路径
 */
function snapshotPath(id: string, rootDir: string = process.cwd()): string {
  return resolve(rootDir, SNAPSHOT_DIR, `${id}.json`);
}

/**
 * 确保快照目录存在
 */
async function ensureSnapshotDir(rootDir: string): Promise<void> {
  await ensureDir(resolve(rootDir, SNAPSHOT_DIR));
}

/**
 * SnapshotStore — 快照读写服务
 */
export class SnapshotStore {
  private readonly rootDir: string;

  constructor(rootDir: string = process.cwd()) {
    this.rootDir = rootDir;
  }

  /**
   * 保存快照到磁盘
   * @param snapshot - 要保存的 MetricSnapshot
   */
  async save(snapshot: MetricSnapshot): Promise<void> {
    await ensureSnapshotDir(this.rootDir);
    const filePath = snapshotPath(snapshot.id, this.rootDir);
    await writeJSON(filePath, snapshot);
    debug(`[snapshot] 已保存: ${snapshot.id}`);
  }

  /**
   * 加载指定快照
   * @param id - 快照 ID
   * @returns MetricSnapshot
   * @throws {Error} 快照不存在
   */
  async load(id: string): Promise<MetricSnapshot> {
    const filePath = snapshotPath(id, this.rootDir);
    const snapshot = await readJSON<MetricSnapshot>(filePath);

    // 确保返回的是完整 MetricSnapshot（JSON 解析可能丢失类型）
    if (!snapshot.id || !snapshot.timestamp || !snapshot.metrics) {
      throw new Error(`快照数据不完整: ${id}`);
    }

    return snapshot;
  }

  /**
   * 列出最近 N 个快照（按时间倒序）
   * @param limit - 返回数量上限，默认 20
   * @returns 快照数组
   */
  async list(limit: number = 20): Promise<MetricSnapshot[]> {
    await ensureSnapshotDir(this.rootDir);
    const dirPath = resolve(this.rootDir, SNAPSHOT_DIR);

    try {
      const files = await readdir(dirPath);
      const jsonFiles = files
        .filter((f) => f.endsWith('.json'))
        .sort()
        .reverse();

      // 先加载全部快照文件
      const snapshots: MetricSnapshot[] = [];
      for (const file of jsonFiles) {
        try {
          const snap = await readJSON<MetricSnapshot>(resolve(dirPath, file));
          if (snap.id && snap.timestamp && snap.metrics) {
            snapshots.push(snap);
          }
        } catch {
          warn(`[snapshot] 跳过损坏的快照文件: ${file}`);
        }
      }

      // 按 timestamp 降序排列
      snapshots.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );

      // 截取 limit
      return snapshots.slice(0, limit);
    } catch {
      return [];
    }
  }

  /**
   * 获取最新快照
   * @returns 最新 MetricSnapshot，无快照时返回 null
   */
  async getLatest(): Promise<MetricSnapshot | null> {
    const snapshots = await this.list(1);
    return snapshots.length > 0 ? snapshots[0] : null;
  }

  /**
   * 对比两个快照，生成 SnapshotComparison
   * @param beforeId - 优化前快照 ID
   * @param afterId - 优化后快照 ID
   * @returns SnapshotComparison（含 delta 和回滚建议）
   */
  async compare(beforeId: string, afterId: string): Promise<SnapshotComparison> {
    const before = await this.load(beforeId);
    const after = await this.load(afterId);

    const delta = this.computeDelta(before, after);
    // 先默认 shouldRollback = false，由 evaluateRollback() 做最终判断
    const shouldRollback = false;
    const exceededThresholds: string[] = [];

    return {
      before,
      after,
      delta,
      shouldRollback,
      exceededThresholds,
    };
  }

  /**
   * 计算两个快照之间的指标差值
   */
  private computeDelta(before: MetricSnapshot, after: MetricSnapshot): MetricsDelta {
    const bm = before.metrics;
    const am = after.metrics;

    const delta: MetricsDelta = {
      lintErrorsDelta: am.lintErrors - bm.lintErrors,
      lintWarningsDelta: am.lintWarnings - bm.lintWarnings,
      securityCriticalDelta: am.securityVulnerabilities.critical - bm.securityVulnerabilities.critical,
      securityHighDelta: am.securityVulnerabilities.high - bm.securityVulnerabilities.high,
      outdatedDepsDelta: am.outdatedDependencies - bm.outdatedDependencies,
    };

    // 可选指标
    if (bm.buildTimeMs != null && am.buildTimeMs != null && bm.buildTimeMs > 0) {
      delta.buildTimeDeltaPercent = (am.buildTimeMs - bm.buildTimeMs) / bm.buildTimeMs;
    }

    if (bm.performance && am.performance) {
      const p95Before = bm.performance.p95LatencyMs;
      const p95After = am.performance.p95LatencyMs;
      if (p95Before > 0) {
        delta.performanceDegradationPercent = (p95After - p95Before) / p95Before;
      }
    }

    return delta;
  }

  /**
   * 删除指定快照
   * @param id - 快照 ID
   */
  async delete(id: string): Promise<void> {
    const filePath = snapshotPath(id, this.rootDir);
    try {
      await unlink(filePath);
      debug(`[snapshot] 已删除: ${id}`);
    } catch {
      warn(`[snapshot] 删除失败: ${id}`);
    }
  }
}
