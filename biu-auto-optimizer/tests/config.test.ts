// ============================================================
// 测试: 配置加载器 & 默认配置
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock cosmiconfig before importing loader
vi.mock('cosmiconfig', () => ({
  cosmiconfig: vi.fn(),
}));

import { cosmiconfig } from 'cosmiconfig';
import { DEFAULT_CONFIG, DEFAULT_THRESHOLDS, DEFAULT_ANALYZERS, DEFAULT_AUTO_FIX, DEFAULT_NIGHTLY, DEFAULT_DASHBOARD, DEFAULT_REPORTING, DEFAULT_WORKSPACES } from '../src/config/defaults.js';
import type { BiuOptConfig } from '../src/config/types.js';
import { loadConfig } from '../src/config/loader.js';
import { z } from 'zod';

// ---- 辅助: 创建 mock explorer ----
function createMockExplorer(searchResult: { config: unknown } | null) {
  return {
    search: vi.fn().mockResolvedValue(searchResult),
  };
}

// ============================================================
// 测试用例 1: 默认配置完整性
// ============================================================
describe('DEFAULT_CONFIG — 默认配置完整性', () => {
  it('T01: 应包含所有顶层字段', () => {
    const requiredKeys = [
      'rootDir', 'thresholds', 'analyzers', 'autoFix',
      'nightly', 'dashboard', 'reporting', 'workspaces',
    ];
    for (const key of requiredKeys) {
      expect(DEFAULT_CONFIG).toHaveProperty(key);
    }
  });

  it('T02: 默认阈值应在有效范围内', () => {
    const t = DEFAULT_THRESHOLDS;
    // 百分比阈值应在 0~1 之间
    expect(t.rollback).toBeGreaterThanOrEqual(0);
    expect(t.rollback).toBeLessThanOrEqual(1);
    expect(t.lintErrors).toBeGreaterThanOrEqual(0);
    expect(t.lintErrors).toBeLessThanOrEqual(1);
    expect(t.performanceDegradation).toBeGreaterThanOrEqual(0);
    expect(t.performanceDegradation).toBeLessThanOrEqual(1);
    // 复杂度阈值应为正整数
    expect(t.complexityMax).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(t.complexityMax)).toBe(true);
    // 类型覆盖率应在 0~1
    expect(t.typeCoverageMin).toBeGreaterThanOrEqual(0);
    expect(t.typeCoverageMin).toBeLessThanOrEqual(1);
    // 安全阈值应 >= 0
    expect(t.securityCritical).toBeGreaterThanOrEqual(0);
    expect(t.securityHigh).toBeGreaterThanOrEqual(0);
    // CI 构建时间阈值 >= 0
    expect(t.ciBuildTimeIncrease).toBeGreaterThanOrEqual(0);
  });

  it('T03: 应包含三个核心分析器 (code-review, security-scan, dependency-check)', () => {
    const analyzerKeys = Object.keys(DEFAULT_ANALYZERS);
    expect(analyzerKeys).toContain('code-review');
    expect(analyzerKeys).toContain('security-scan');
    expect(analyzerKeys).toContain('dependency-check');
    // 所有核心分析器默认启用
    expect(DEFAULT_ANALYZERS['code-review'].enabled).toBe(true);
    expect(DEFAULT_ANALYZERS['security-scan'].enabled).toBe(true);
    expect(DEFAULT_ANALYZERS['dependency-check'].enabled).toBe(true);
  });

  it('T04: 默认工作区列表应非空', () => {
    expect(DEFAULT_WORKSPACES.length).toBeGreaterThan(0);
    expect(Array.isArray(DEFAULT_WORKSPACES)).toBe(true);
  });

  it('T05: 默认 autoFix、nightly、dashboard、reporting 应结构完整', () => {
    // autoFix
    expect(DEFAULT_AUTO_FIX).toHaveProperty('enabled');
    expect(DEFAULT_AUTO_FIX).toHaveProperty('createBranch');
    expect(DEFAULT_AUTO_FIX).toHaveProperty('autoMergeLowRisk');
    expect(DEFAULT_AUTO_FIX).toHaveProperty('maxFilesPerFix');
    // nightly
    expect(DEFAULT_NIGHTLY).toHaveProperty('enabled');
    expect(DEFAULT_NIGHTLY).toHaveProperty('schedule');
    expect(DEFAULT_NIGHTLY).toHaveProperty('autoCreatePR');
    // dashboard
    expect(DEFAULT_DASHBOARD).toHaveProperty('enabled');
    expect(DEFAULT_DASHBOARD).toHaveProperty('port');
    // reporting
    expect(DEFAULT_REPORTING).toHaveProperty('formats');
    expect(DEFAULT_REPORTING).toHaveProperty('outputDir');
  });

  it('T06: DEFAULT_CONFIG 的 analyzers 应包含所有核心分析器并启用', () => {
    const analyzers = DEFAULT_CONFIG.analyzers;
    expect(analyzers['code-review']?.enabled).toBe(true);
    expect(analyzers['security-scan']?.enabled).toBe(true);
    expect(analyzers['dependency-check']?.enabled).toBe(true);
  });
});

// ============================================================
// 测试用例 2: 配置加载器
// ============================================================
describe('loadConfig — 配置加载与校验', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('T07: 无配置文件时应返回默认配置', async () => {
    const mockExplorer = createMockExplorer(null);
    vi.mocked(cosmiconfig).mockReturnValue(mockExplorer as any);

    const config = await loadConfig('/fake/path');

    // 应返回与默认配置相同的结构
    expect(config.rootDir).toBe(DEFAULT_CONFIG.rootDir);
    expect(config.thresholds.rollback).toBe(DEFAULT_CONFIG.thresholds.rollback);
    expect(config.thresholds.lintErrors).toBe(DEFAULT_CONFIG.thresholds.lintErrors);
    expect(config.workspaces).toEqual(DEFAULT_CONFIG.workspaces);
    // 顶层字段应完整
    expect(config).toHaveProperty('thresholds');
    expect(config).toHaveProperty('analyzers');
    expect(config).toHaveProperty('autoFix');
    expect(config).toHaveProperty('nightly');
    expect(config).toHaveProperty('dashboard');
    expect(config).toHaveProperty('reporting');
  });

  it('T08: 有配置文件时应深度合并', async () => {
    const userConfig = {
      rootDir: './my-project',
      thresholds: { rollback: 0.10 },
    };
    const mockExplorer = createMockExplorer({ config: userConfig });
    vi.mocked(cosmiconfig).mockReturnValue(mockExplorer as any);

    const config = await loadConfig('/fake/path');

    // 覆盖的值
    expect(config.rootDir).toBe('./my-project');
    expect(config.thresholds.rollback).toBe(0.10);
    // 未覆盖的阈值保持默认
    expect(config.thresholds.lintErrors).toBe(DEFAULT_CONFIG.thresholds.lintErrors);
    expect(config.thresholds.securityCritical).toBe(DEFAULT_CONFIG.thresholds.securityCritical);
  });

  it('T09: 配置校验应捕获无效的阈值 (rollback > 1)', async () => {
    const invalidConfig = {
      thresholds: { rollback: 1.5 }, // 超出 [0,1] 范围
    };
    const mockExplorer = createMockExplorer({ config: invalidConfig });
    vi.mocked(cosmiconfig).mockReturnValue(mockExplorer as any);

    await expect(loadConfig('/fake/path')).rejects.toThrow('配置校验失败');
  });

  it('T10: 配置校验应捕获无效的阈值 (负值)', async () => {
    const invalidConfig = {
      thresholds: { complexityMax: -1 }, // 必须 >= 1
    };
    const mockExplorer = createMockExplorer({ config: invalidConfig });
    vi.mocked(cosmiconfig).mockReturnValue(mockExplorer as any);

    await expect(loadConfig('/fake/path')).rejects.toThrow('配置校验失败');
  });

  it('T11: 配置校验应捕获无效的端口号', async () => {
    const invalidConfig = {
      dashboard: { port: 99999 }, // 超出 65535
    };
    const mockExplorer = createMockExplorer({ config: invalidConfig });
    vi.mocked(cosmiconfig).mockReturnValue(mockExplorer as any);

    await expect(loadConfig('/fake/path')).rejects.toThrow('配置校验失败');
  });

  it('T12: 合法用户配置应通过校验', async () => {
    const validConfig: Partial<BiuOptConfig> = {
      rootDir: './valid-project',
      thresholds: {
        rollback: 0.03,
        lintErrors: 0.03,
        securityCritical: 0,
        securityHigh: 0,
        performanceDegradation: 0.03,
        complexityMax: 12,
        typeCoverageMin: 0.90,
        ciBuildTimeIncrease: 0.15,
      },
      analyzers: {
        'code-review': { enabled: true },
        'security-scan': { enabled: true },
        'dependency-check': { enabled: false },
      },
      autoFix: {
        enabled: true,
        createBranch: true,
        autoMergeLowRisk: false,
        maxFilesPerFix: 30,
      },
      nightly: {
        enabled: true,
        schedule: '03:00',
        autoCreatePR: false,
      },
      dashboard: {
        enabled: true,
        port: 5000,
      },
      reporting: {
        formats: ['cli', 'json', 'markdown'],
        outputDir: './custom-reports',
      },
      workspaces: ['pkg1', 'pkg2'],
    };

    const mockExplorer = createMockExplorer({ config: validConfig });
    vi.mocked(cosmiconfig).mockReturnValue(mockExplorer as any);

    const config = await loadConfig('/fake/path');

    expect(config.rootDir).toBe('./valid-project');
    expect(config.thresholds.rollback).toBe(0.03);
    expect(config.dashboard.port).toBe(5000);
    expect(config.nightly.schedule).toBe('03:00');
    expect(config.workspaces).toEqual(['pkg1', 'pkg2']);
  });

  it('T13: cosmiconfig 错误应包装为友好消息', async () => {
    const mockExplorer = {
      search: vi.fn().mockRejectedValue(new Error('ENOENT: no such file')),
    };
    vi.mocked(cosmiconfig).mockReturnValue(mockExplorer as any);

    await expect(loadConfig('/fake/path')).rejects.toThrow('配置加载失败');
  });
});
