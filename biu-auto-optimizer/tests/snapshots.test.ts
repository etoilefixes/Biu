// ============================================================
// 测试: 快照存储 & 回滚决策
// ============================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rm, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import type { MetricSnapshot, MetricsData } from '../src/types/snapshot.js';
import type { Thresholds } from '../src/config/types.js';

// ============================================================
// 辅助工厂函数
// ============================================================
function createSnapshot(overrides: Partial<MetricSnapshot> = {}): MetricSnapshot {
  const id = overrides.id ?? `snap-20250101-120000-abc1234`;
  const defaultMetrics: MetricsData = {
    lintErrors: 10,
    lintWarnings: 20,
    securityVulnerabilities: { critical: 0, high: 1, moderate: 3, low: 5 },
    outdatedDependencies: 4,
    buildTimeMs: 45000,
    bundleSizeBytes: 1024000,
    typeCoveragePercent: 0.95,
    performance: { p50LatencyMs: 20, p95LatencyMs: 100, p99LatencyMs: 200, throughputRps: 500 },
  };

  return {
    id,
    timestamp: overrides.timestamp ?? '2025-01-01T12:00:00.000Z',
    gitHash: overrides.gitHash ?? 'abc1234',
    gitBranch: overrides.gitBranch ?? 'main',
    metrics: overrides.metrics ?? defaultMetrics,
    analyzerIds: overrides.analyzerIds ?? ['code-review', 'security-scan'],
  };
}

function createDefaultThresholds(overrides: Partial<Thresholds> = {}): Thresholds {
  return {
    rollback: 0.05,
    lintErrors: 0.05,
    securityCritical: 0,
    securityHigh: 0,
    performanceDegradation: 0.05,
    complexityMax: 15,
    typeCoverageMin: 0.95,
    ciBuildTimeIncrease: 0.20,
    ...overrides,
  };
}

// ============================================================
// SnapshotStore 测试
// ============================================================
describe('SnapshotStore — 快照存储', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = resolve(tmpdir(), 'biu-opt-snap-' + randomUUID());
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true }).catch(() => {});
  });

  it('T32: save → load 应形成闭环', async () => {
    const { SnapshotStore } = await import('../src/snapshots/store.js');
    const store = new SnapshotStore(testDir);
    const snapshot = createSnapshot({ id: 'snap-test-001' });

    await store.save(snapshot);
    const loaded = await store.load('snap-test-001');

    expect(loaded.id).toBe(snapshot.id);
    expect(loaded.timestamp).toBe(snapshot.timestamp);
    expect(loaded.gitHash).toBe(snapshot.gitHash);
    expect(loaded.metrics.lintErrors).toBe(snapshot.metrics.lintErrors);
    expect(loaded.metrics.lintWarnings).toBe(snapshot.metrics.lintWarnings);
    expect(loaded.metrics.securityVulnerabilities.critical).toBe(
      snapshot.metrics.securityVulnerabilities.critical,
    );
  });

  it('T33: load 不存在的快照应抛出错误', async () => {
    const { SnapshotStore } = await import('../src/snapshots/store.js');
    const store = new SnapshotStore(testDir);

    await expect(store.load('non-existent-snapshot')).rejects.toThrow();
  });

  it('T34: list 应返回按时间排序的快照列表', async () => {
    const { SnapshotStore } = await import('../src/snapshots/store.js');
    const store = new SnapshotStore(testDir);

    // 保存三个时间不等的快照
    const snap1 = createSnapshot({
      id: 'snap-oldest',
      timestamp: '2025-01-01T10:00:00.000Z',
    });
    const snap2 = createSnapshot({
      id: 'snap-middle',
      timestamp: '2025-01-01T12:00:00.000Z',
    });
    const snap3 = createSnapshot({
      id: 'snap-newest',
      timestamp: '2025-01-01T14:00:00.000Z',
    });

    await store.save(snap1);
    await store.save(snap2);
    await store.save(snap3);

    const list = await store.list();

    expect(list.length).toBeGreaterThanOrEqual(3);

    // 应找到我们保存的快照
    const ids = list.map((s) => s.id);
    expect(ids).toContain('snap-oldest');
    expect(ids).toContain('snap-middle');
    expect(ids).toContain('snap-newest');

    // 最新的应排在前面
    const newestIdx = ids.indexOf('snap-newest');
    const oldestIdx = ids.indexOf('snap-oldest');
    expect(newestIdx).toBeLessThan(oldestIdx);
  });

  it('T35: getLatest 应返回最新快照', async () => {
    const { SnapshotStore } = await import('../src/snapshots/store.js');
    const store = new SnapshotStore(testDir);

    const snap1 = createSnapshot({
      id: 'snap-old',
      timestamp: '2025-01-01T10:00:00.000Z',
    });
    const snap2 = createSnapshot({
      id: 'snap-latest',
      timestamp: '2025-01-01T16:00:00.000Z',
    });

    await store.save(snap1);
    await store.save(snap2);

    const latest = await store.getLatest();

    expect(latest).not.toBeNull();
    expect(latest!.id).toBe('snap-latest');
  });

  it('T36: getLatest 无快照时应返回 null', async () => {
    const { SnapshotStore } = await import('../src/snapshots/store.js');
    const store = new SnapshotStore(testDir);

    const latest = await store.getLatest();

    expect(latest).toBeNull();
  });

  it('T37: compare 应正确计算增量', async () => {
    const { SnapshotStore } = await import('../src/snapshots/store.js');
    const store = new SnapshotStore(testDir);

    const before = createSnapshot({
      id: 'snap-before',
      metrics: {
        lintErrors: 10,
        lintWarnings: 20,
        securityVulnerabilities: { critical: 0, high: 0, moderate: 1, low: 2 },
        outdatedDependencies: 3,
        buildTimeMs: 40000,
        performance: { p50LatencyMs: 20, p95LatencyMs: 100, p99LatencyMs: 200, throughputRps: 500 },
      },
    });

    const after = createSnapshot({
      id: 'snap-after',
      metrics: {
        lintErrors: 15,   // +5
        lintWarnings: 25, // +5
        securityVulnerabilities: { critical: 1, high: 2, moderate: 1, low: 2 }, // critical +1, high +2
        outdatedDependencies: 5, // +2
        buildTimeMs: 48000, // +20%
        performance: { p50LatencyMs: 20, p95LatencyMs: 120, p99LatencyMs: 220, throughputRps: 500 }, // p95 +20%
      },
    });

    await store.save(before);
    await store.save(after);

    const comparison = await store.compare('snap-before', 'snap-after');

    // 验证 delta
    expect(comparison.delta.lintErrorsDelta).toBe(5);
    expect(comparison.delta.lintWarningsDelta).toBe(5);
    expect(comparison.delta.securityCriticalDelta).toBe(1);
    expect(comparison.delta.securityHighDelta).toBe(2);
    expect(comparison.delta.outdatedDepsDelta).toBe(2);
    expect(comparison.delta.buildTimeDeltaPercent).toBeCloseTo(0.20, 2);
    expect(comparison.delta.performanceDegradationPercent).toBeCloseTo(0.20, 2);

    // compare() 返回的结构应包含 before/after
    expect(comparison.before.id).toBe('snap-before');
    expect(comparison.after.id).toBe('snap-after');
  });

  it('T38: delete 应删除指定快照', async () => {
    const { SnapshotStore } = await import('../src/snapshots/store.js');
    const store = new SnapshotStore(testDir);

    const snapshot = createSnapshot({ id: 'snap-to-delete' });
    await store.save(snapshot);

    // 确认保存成功
    const loaded = await store.load('snap-to-delete');
    expect(loaded.id).toBe('snap-to-delete');

    // 删除
    await store.delete('snap-to-delete');

    // 再次加载应失败
    await expect(store.load('snap-to-delete')).rejects.toThrow();
  });
});

// ============================================================
// evaluateRollback 测试
// ============================================================
describe('evaluateRollback — 回滚决策', () => {
  let evaluateRollback: (typeof import('../src/snapshots/rollback.js'))['evaluateRollback'];

  beforeAll(async () => {
    const mod = await import('../src/snapshots/rollback.js');
    evaluateRollback = mod.evaluateRollback;
  });

  it('T39: 正常情况 — 无劣化应不需回滚', () => {
    const before = createSnapshot({ id: 'snap-1' });
    const after = createSnapshot({ id: 'snap-2' }); // 完全相同的指标
    const thresholds = createDefaultThresholds();

    const result = evaluateRollback(before, after, thresholds);

    expect(result.shouldRollback).toBe(false);
    expect(result.exceeded).toHaveLength(0);
  });

  it('T40: Lint 错误增长超阈值应触发回滚', () => {
    const before = createSnapshot({
      id: 'snap-before',
      metrics: {
        lintErrors: 10,
        lintWarnings: 20,
        securityVulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0 },
        outdatedDependencies: 0,
      },
    });
    const after = createSnapshot({
      id: 'snap-after',
      metrics: {
        lintErrors: 20, // +100% > 5% threshold
        lintWarnings: 20,
        securityVulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0 },
        outdatedDependencies: 0,
      },
    });
    const thresholds = createDefaultThresholds({ lintErrors: 0.05 });

    const result = evaluateRollback(before, after, thresholds);

    expect(result.shouldRollback).toBe(true);
    expect(result.exceeded).toContain('lintErrors');
  });

  it('T41: Lint 错误小幅增长未超阈值应不需回滚', () => {
    const before = createSnapshot({
      id: 'snap-before',
      metrics: {
        lintErrors: 100,
        lintWarnings: 0,
        securityVulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0 },
        outdatedDependencies: 0,
      },
    });
    const after = createSnapshot({
      id: 'snap-after',
      metrics: {
        lintErrors: 102, // +2% < 5% threshold
        lintWarnings: 0,
        securityVulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0 },
        outdatedDependencies: 0,
      },
    });
    const thresholds = createDefaultThresholds({ lintErrors: 0.05 });

    const result = evaluateRollback(before, after, thresholds);

    expect(result.shouldRollback).toBe(false);
  });

  it('T42: 安全严重漏洞新增应触发回滚 (securityCritical > 0)', () => {
    const before = createSnapshot({
      id: 'snap-before',
      metrics: {
        lintErrors: 0,
        lintWarnings: 0,
        securityVulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0 },
        outdatedDependencies: 0,
      },
    });
    const after = createSnapshot({
      id: 'snap-after',
      metrics: {
        lintErrors: 0,
        lintWarnings: 0,
        securityVulnerabilities: { critical: 1, high: 0, moderate: 0, low: 0 },
        outdatedDependencies: 0,
      },
    });
    const thresholds = createDefaultThresholds({ securityCritical: 0 });

    const result = evaluateRollback(before, after, thresholds);

    expect(result.shouldRollback).toBe(true);
    expect(result.exceeded).toContain('securityCritical');
  });

  it('T43: 边界情况 — 从 0 个 lint 错误新增少量不应回滚', () => {
    const before = createSnapshot({
      id: 'snap-before',
      metrics: {
        lintErrors: 0,
        lintWarnings: 0,
        securityVulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0 },
        outdatedDependencies: 0,
      },
    });
    const after = createSnapshot({
      id: 'snap-after',
      metrics: {
        lintErrors: 3, // <= 5，不应触发回滚
        lintWarnings: 0,
        securityVulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0 },
        outdatedDependencies: 0,
      },
    });
    const thresholds = createDefaultThresholds();

    const result = evaluateRollback(before, after, thresholds);

    expect(result.shouldRollback).toBe(false);
  });

  it('T44: 边界情况 — 从 0 个 lint 错误新增超过 5 个应回滚', () => {
    const before = createSnapshot({
      id: 'snap-before',
      metrics: {
        lintErrors: 0,
        lintWarnings: 0,
        securityVulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0 },
        outdatedDependencies: 0,
      },
    });
    const after = createSnapshot({
      id: 'snap-after',
      metrics: {
        lintErrors: 6, // > 5，应触发回滚
        lintWarnings: 0,
        securityVulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0 },
        outdatedDependencies: 0,
      },
    });
    const thresholds = createDefaultThresholds();

    const result = evaluateRollback(before, after, thresholds);

    expect(result.shouldRollback).toBe(true);
    expect(result.exceeded).toContain('lintErrors');
  });

  it('T45: 性能劣化超阈值应触发回滚', () => {
    const before = createSnapshot({
      id: 'snap-before',
      metrics: {
        lintErrors: 0,
        lintWarnings: 0,
        securityVulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0 },
        outdatedDependencies: 0,
        performance: { p50LatencyMs: 20, p95LatencyMs: 100, p99LatencyMs: 200, throughputRps: 500 },
      },
    });
    const after = createSnapshot({
      id: 'snap-after',
      metrics: {
        lintErrors: 0,
        lintWarnings: 0,
        securityVulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0 },
        outdatedDependencies: 0,
        performance: { p50LatencyMs: 20, p95LatencyMs: 200, p99LatencyMs: 300, throughputRps: 400 }, // p95 +100%
      },
    });
    const thresholds = createDefaultThresholds({ performanceDegradation: 0.05 });

    const result = evaluateRollback(before, after, thresholds);

    expect(result.shouldRollback).toBe(true);
    expect(result.exceeded).toContain('performanceDegradation');
  });

  it('T46: 多个指标同时超标应在 exceeded 列出全部', () => {
    const before = createSnapshot({
      id: 'snap-before',
      metrics: {
        lintErrors: 10,
        lintWarnings: 20,
        securityVulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0 },
        outdatedDependencies: 4,
      },
    });
    const after = createSnapshot({
      id: 'snap-after',
      metrics: {
        lintErrors: 20,    // +100% > 5%
        lintWarnings: 20,
        securityVulnerabilities: { critical: 1, high: 2, moderate: 0, low: 0 }, // critical +1, high +2
        outdatedDependencies: 10, // 150% > 5%
      },
    });
    const thresholds = createDefaultThresholds();

    const result = evaluateRollback(before, after, thresholds);

    expect(result.shouldRollback).toBe(true);
    // 至少包含 lintErrors, securityCritical, securityHigh, outdatedDependencies
    expect(result.exceeded.length).toBeGreaterThanOrEqual(3);
    expect(result.exceeded).toContain('lintErrors');
    expect(result.exceeded).toContain('securityCritical');
    expect(result.exceeded).toContain('securityHigh');
  });

  it('T47: 构建时间增长超阈值应触发回滚', () => {
    const before = createSnapshot({
      id: 'snap-before',
      metrics: {
        lintErrors: 0,
        lintWarnings: 0,
        securityVulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0 },
        outdatedDependencies: 0,
        buildTimeMs: 40000,
      },
    });
    const after = createSnapshot({
      id: 'snap-after',
      metrics: {
        lintErrors: 0,
        lintWarnings: 0,
        securityVulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0 },
        outdatedDependencies: 0,
        buildTimeMs: 52000, // +30% > 20% threshold
      },
    });
    const thresholds = createDefaultThresholds({ ciBuildTimeIncrease: 0.20 });

    const result = evaluateRollback(before, after, thresholds);

    expect(result.shouldRollback).toBe(true);
    expect(result.exceeded).toContain('ciBuildTimeIncrease');
  });
});
