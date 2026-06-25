// ============================================================
// Biu Auto-Optimizer — 默认配置常量
// ============================================================

import type { BiuOptConfig } from './types.js';

/** 默认阈值配置 */
export const DEFAULT_THRESHOLDS = {
  rollback: 0.05,
  lintErrors: 0.05,
  securityCritical: 0,
  securityHigh: 0,
  performanceDegradation: 0.05,
  complexityMax: 15,
  typeCoverageMin: 0.95,
  ciBuildTimeIncrease: 0.20,
} as const;

/** 默认分析器配置 */
export const DEFAULT_ANALYZERS = {
  'code-review': { enabled: true },
  'security-scan': { enabled: true },
  'dependency-check': { enabled: true },
} as const;

/** 默认自动修复配置 */
export const DEFAULT_AUTO_FIX = {
  enabled: true,
  createBranch: true,
  autoMergeLowRisk: false,
  maxFilesPerFix: 20,
} as const;

/** 默认夜间窗口配置 */
export const DEFAULT_NIGHTLY = {
  enabled: false,
  schedule: '02:00',
  autoCreatePR: false,
} as const;

/** 默认 Dashboard 配置 */
export const DEFAULT_DASHBOARD = {
  enabled: false,
  port: 4000,
} as const;

/** 默认报告配置 */
export const DEFAULT_REPORTING = {
  formats: ['cli', 'json'] as string[],
  outputDir: '.biu-opt/reports',
} as const;

/** 默认工作区列表 */
export const DEFAULT_WORKSPACES = ['shared', 'server', 'client'] as string[];

/** 完整默认配置 */
export const DEFAULT_CONFIG: BiuOptConfig = {
  rootDir: '.',
  thresholds: { ...DEFAULT_THRESHOLDS },
  analyzers: {
    'code-review': { enabled: true },
    'security-scan': { enabled: true },
    'dependency-check': { enabled: true },
  },
  autoFix: { ...DEFAULT_AUTO_FIX },
  nightly: { ...DEFAULT_NIGHTLY },
  dashboard: { ...DEFAULT_DASHBOARD },
  reporting: { ...DEFAULT_REPORTING },
  workspaces: [...DEFAULT_WORKSPACES],
};
