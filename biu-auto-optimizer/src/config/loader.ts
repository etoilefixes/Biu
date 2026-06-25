// ============================================================
// Biu Auto-Optimizer — 配置加载器 (cosmiconfig + Zod)
// ============================================================

import { cosmiconfig } from 'cosmiconfig';
import { z } from 'zod';
import { DEFAULT_CONFIG } from './defaults.js';
import type { BiuOptConfig } from './types.js';

// ---- Zod Schemas ----

const thresholdsSchema = z.object({
  rollback: z.number().min(0).max(1).default(DEFAULT_CONFIG.thresholds.rollback),
  lintErrors: z.number().min(0).max(1).default(DEFAULT_CONFIG.thresholds.lintErrors),
  securityCritical: z.number().int().min(0).default(DEFAULT_CONFIG.thresholds.securityCritical),
  securityHigh: z.number().int().min(0).default(DEFAULT_CONFIG.thresholds.securityHigh),
  performanceDegradation: z.number().min(0).max(1).default(DEFAULT_CONFIG.thresholds.performanceDegradation),
  complexityMax: z.number().int().min(1).default(DEFAULT_CONFIG.thresholds.complexityMax),
  typeCoverageMin: z.number().min(0).max(1).default(DEFAULT_CONFIG.thresholds.typeCoverageMin),
  ciBuildTimeIncrease: z.number().min(0).default(DEFAULT_CONFIG.thresholds.ciBuildTimeIncrease),
});

const analyzerEntrySchema = z.object({
  enabled: z.boolean(),
  options: z.record(z.unknown()).optional(),
});

const analyzersConfigSchema = z.object({
  'code-review': analyzerEntrySchema,
  'security-scan': analyzerEntrySchema,
  'dependency-check': analyzerEntrySchema,
  performance: analyzerEntrySchema.optional(),
}).catchall(analyzerEntrySchema.optional());

const autoFixSchema = z.object({
  enabled: z.boolean().default(DEFAULT_CONFIG.autoFix.enabled),
  createBranch: z.boolean().default(DEFAULT_CONFIG.autoFix.createBranch),
  autoMergeLowRisk: z.boolean().default(DEFAULT_CONFIG.autoFix.autoMergeLowRisk),
  maxFilesPerFix: z.number().int().min(1).default(DEFAULT_CONFIG.autoFix.maxFilesPerFix),
});

const nightlySchema = z.object({
  enabled: z.boolean().default(DEFAULT_CONFIG.nightly.enabled),
  schedule: z.string().default(DEFAULT_CONFIG.nightly.schedule),
  autoCreatePR: z.boolean().default(DEFAULT_CONFIG.nightly.autoCreatePR),
});

const dashboardSchema = z.object({
  enabled: z.boolean().default(DEFAULT_CONFIG.dashboard.enabled),
  port: z.number().int().min(1).max(65535).default(DEFAULT_CONFIG.dashboard.port),
});

const reportingSchema = z.object({
  formats: z.array(z.string()).default(DEFAULT_CONFIG.reporting.formats),
  outputDir: z.string().default(DEFAULT_CONFIG.reporting.outputDir),
});

const biuOptConfigSchema = z.object({
  rootDir: z.string().default(DEFAULT_CONFIG.rootDir),
  thresholds: thresholdsSchema.default(DEFAULT_CONFIG.thresholds),
  analyzers: analyzersConfigSchema.default(DEFAULT_CONFIG.analyzers),
  autoFix: autoFixSchema.default(DEFAULT_CONFIG.autoFix),
  nightly: nightlySchema.default(DEFAULT_CONFIG.nightly),
  dashboard: dashboardSchema.default(DEFAULT_CONFIG.dashboard),
  reporting: reportingSchema.default(DEFAULT_CONFIG.reporting),
  workspaces: z.array(z.string()).default(DEFAULT_CONFIG.workspaces),
});

/**
 * 深度合并两个对象，右侧值覆盖左侧
 */
function deepMerge<T extends Record<string, unknown>>(base: T, overrides: Record<string, unknown>): T {
  const result: Record<string, unknown> = { ...base };

  for (const key of Object.keys(overrides)) {
    const baseVal = result[key];
    const overrideVal = overrides[key];

    if (
      overrideVal !== null &&
      typeof overrideVal === 'object' &&
      !Array.isArray(overrideVal) &&
      baseVal !== null &&
      typeof baseVal === 'object' &&
      !Array.isArray(baseVal)
    ) {
      result[key] = deepMerge(
        baseVal as Record<string, unknown>,
        overrideVal as Record<string, unknown>,
      );
    } else {
      result[key] = overrideVal;
    }
  }

  return result as T;
}

/**
 * 加载并校验 BiuOptConfig
 *
 * 搜索策略：
 * 1. 从 cwd 开始递归向上搜索 .biu-opt.json / .biu-opt.js / package.json#biuOpt
 * 2. 找到的配置与默认值深度合并
 * 3. Zod 校验最终结果
 *
 * @param cwd - 搜索起始目录，默认为 process.cwd()
 * @returns 校验通过的 BiuOptConfig
 * @throws {Error} 配置加载或校验失败时抛出
 */
export async function loadConfig(cwd?: string): Promise<BiuOptConfig> {
  const explorer = cosmiconfig('biu-opt', {
    searchPlaces: [
      '.biu-opt.json',
      '.biu-opt.yaml',
      '.biu-opt.yml',
      '.biu-opt.js',
      '.biu-opt.cjs',
      'package.json',
    ],
    stopDir: cwd ?? process.cwd(),
  });

  try {
    const result = await explorer.search(cwd);

    if (result && result.config) {
      const merged = deepMerge(
        DEFAULT_CONFIG as unknown as Record<string, unknown>,
        result.config as Record<string, unknown>,
      );
      const parsed = biuOptConfigSchema.parse(merged);
      return parsed as BiuOptConfig;
    }

    // 未找到配置文件，返回默认配置
    return DEFAULT_CONFIG;
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const issues = error.issues
        .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
        .join('\n');
      throw new Error(`配置校验失败:\n${issues}`);
    }

    if (error instanceof Error) {
      throw new Error(`配置加载失败: ${error.message}`);
    }

    throw new Error('配置加载失败: 未知错误');
  }
}
