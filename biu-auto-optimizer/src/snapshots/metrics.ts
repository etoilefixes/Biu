// ============================================================
// Biu Auto-Optimizer — 指标采集
// ============================================================

import type { MetricsData, VulnerabilityCount, PerformanceMetrics } from '../types/snapshot.js';
import { exec } from '../utils/exec.js';
import { debug, warn } from '../utils/logger.js';

/**
 * 收集当前项目的指标数据
 *
 * @param analyzerIds - 参与采集的分析器 ID 列表
 * @param rootDir - 项目根目录，默认为 process.cwd()
 * @returns MetricsData
 */
export async function collectMetrics(
  analyzerIds: string[],
  rootDir: string = process.cwd(),
): Promise<MetricsData> {
  debug('[metrics] 开始采集指标...');

  const [lintStats, securityVulnerabilities, outdatedDeps] =
    await Promise.all([
      collectLintStats(rootDir),
      collectVulnerabilityCount(rootDir),
      collectOutdatedCount(rootDir),
    ]);

  // 可选指标（失败不阻塞）
  const [buildTimeMs, bundleSizeBytes, typeCoveragePercent, performance] =
    await Promise.allSettled([
      collectBuildTime(rootDir),
      collectBundleSize(rootDir),
      collectTypeCoverage(rootDir),
      collectPerformance(rootDir),
    ]);

  const metrics: MetricsData = {
    lintErrors: lintStats.errors,
    lintWarnings: lintStats.warnings,
    securityVulnerabilities,
    outdatedDependencies: outdatedDeps,
    buildTimeMs: buildTimeMs.status === 'fulfilled' ? buildTimeMs.value : undefined,
    bundleSizeBytes: bundleSizeBytes.status === 'fulfilled' ? bundleSizeBytes.value : undefined,
    typeCoveragePercent: typeCoveragePercent.status === 'fulfilled' ? typeCoveragePercent.value : undefined,
    performance: performance.status === 'fulfilled' ? performance.value : undefined,
  };

  debug(`[metrics] 采集完成: ${metrics.lintErrors} lint errors, ${metrics.securityVulnerabilities.critical} critical vulns, ${metrics.outdatedDependencies} outdated deps`);
  return metrics;
}

// ---- Lint 统计 ----

interface LintStats {
  errors: number;
  warnings: number;
}

async function collectLintStats(rootDir: string): Promise<LintStats> {
  try {
    const result = await exec('npx', ['eslint', '.', '--format', 'json'], {
      cwd: rootDir,
      timeout: 60_000,
    });

    if (!result.stdout) {
      return { errors: 0, warnings: 0 };
    }

    const eslintOutput = JSON.parse(result.stdout) as Array<{
      errorCount: number;
      warningCount: number;
    }>;

    if (!Array.isArray(eslintOutput)) {
      return { errors: 0, warnings: 0 };
    }

    const errors = eslintOutput.reduce((sum, f) => sum + (f.errorCount || 0), 0);
    const warnings = eslintOutput.reduce((sum, f) => sum + (f.warningCount || 0), 0);

    return { errors, warnings };
  } catch {
    warn('[metrics] ESLint 统计失败，返回 0');
    return { errors: 0, warnings: 0 };
  }
}

// ---- 漏洞统计 ----

async function collectVulnerabilityCount(rootDir: string): Promise<VulnerabilityCount> {
  try {
    const result = await exec('npm', ['audit', '--json'], {
      cwd: rootDir,
      timeout: 120_000,
    });

    if (!result.stdout) {
      return { critical: 0, high: 0, moderate: 0, low: 0 };
    }

    const auditOutput = JSON.parse(result.stdout) as {
      metadata?: {
        vulnerabilities?: {
          critical?: number;
          high?: number;
          moderate?: number;
          low?: number;
        };
      };
    };

    const vulns = auditOutput.metadata?.vulnerabilities ?? {};
    return {
      critical: vulns.critical ?? 0,
      high: vulns.high ?? 0,
      moderate: vulns.moderate ?? 0,
      low: vulns.low ?? 0,
    };
  } catch {
    warn('[metrics] npm audit 统计失败，返回 0');
    return { critical: 0, high: 0, moderate: 0, low: 0 };
  }
}

// ---- 过期依赖统计 ----

async function collectOutdatedCount(rootDir: string): Promise<number> {
  try {
    const result = await exec('npm', ['outdated', '--json'], {
      cwd: rootDir,
      timeout: 60_000,
    });

    if (!result.stdout) {
      return 0;
    }

    const outdated = JSON.parse(result.stdout) as Record<string, unknown>;
    return Object.keys(outdated).length;
  } catch {
    warn('[metrics] npm outdated 统计失败，返回 0');
    return 0;
  }
}

// ---- 可选指标 ----

async function collectBuildTime(_rootDir: string): Promise<number | undefined> {
  try {
    // 尝试通过 npm run build 计时（可能很慢，这里做轻量采集）
    // 实际使用时由构建系统注入
    return undefined;
  } catch {
    return undefined;
  }
}

async function collectBundleSize(rootDir: string): Promise<number | undefined> {
  try {
    // 尝试统计 dist/ 目录大小
    const { readdir, stat } = await import('node:fs/promises');
    const { resolve, join } = await import('node:path');

    const distDir = resolve(rootDir, 'dist');
    let totalSize = 0;

    async function walkDir(dir: string): Promise<void> {
      try {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          if (entry.isDirectory()) {
            await walkDir(fullPath);
          } else if (entry.isFile()) {
            const s = await stat(fullPath);
            totalSize += s.size;
          }
        }
      } catch {
        // 目录不存在
      }
    }

    await walkDir(distDir);
    return totalSize > 0 ? totalSize : undefined;
  } catch {
    return undefined;
  }
}

async function collectTypeCoverage(rootDir: string): Promise<number | undefined> {
  try {
    // 尝试用 tsc 统计类型标注比例
    // 方法：统计 .ts/.tsx 文件中显式类型标注的变量/参数比例
    // 这是一个估算，完整实现需要 ts-morph 等工具
    const { default: fastGlob } = await import('fast-glob');
    const { readFile } = await import('node:fs/promises');

    const files = await fastGlob(['**/*.ts', '**/*.tsx', '!**/node_modules/**', '!**/.biu-opt/**'], {
      cwd: rootDir,
      absolute: true,
      onlyFiles: true,
    });

    if (files.length === 0) return undefined;

    let totalDeclarations = 0;
    let typedDeclarations = 0;

    // 粗略统计：匹配变量/函数声明是否有类型标注
    const typedPattern = /:\s*(string|number|boolean|void|never|any|unknown|Record|Map|Set|Array|Promise)[\s<[{]/g;
    const untypedPattern = /\b(let|const|var)\s+\w+\s*=/g;

    for (const file of files.slice(0, 500)) {
      try {
        const content = await readFile(file, 'utf-8');
        const typedMatches = content.match(typedPattern);
        if (typedMatches) typedDeclarations += typedMatches.length;

        const allMatches = content.match(untypedPattern);
        if (allMatches) totalDeclarations += allMatches.length;
      } catch {
        // skip
      }
    }

    if (totalDeclarations + typedDeclarations === 0) return undefined;

    return typedDeclarations / (totalDeclarations + typedDeclarations);
  } catch {
    return undefined;
  }
}

async function collectPerformance(_rootDir: string): Promise<PerformanceMetrics | undefined> {
  // 性能指标需要应用运行时采集（autocannon 等），这里返回 undefined
  return undefined;
}
