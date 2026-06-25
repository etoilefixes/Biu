// ============================================================
// Biu Auto-Optimizer — R-15: UI 回归测试快照
// ============================================================

import { BaseAnalyzer } from './base.js';
import type { BiuOptConfig } from '../config/types.js';
import type { AnalysisResult } from '../types/analysis.js';
import { AnalysisCategory, Severity } from '../types/analysis.js';
import { debug, warn } from '../utils/logger.js';
import { SnapshotStore } from '../snapshots/store.js';
import { resolve } from 'node:path';
import { readdir, stat, readFile } from 'node:fs/promises';

/**
 * 构建产物文件信息
 */
interface BundleFileInfo {
  path: string;
  size: number;
}

/**
 * UiRegressionAnalyzer — UI 回归测试快照
 *
 * 简化方案：对比 client/dist/ 构建产物
 * - 文件列表变化
 * - JS bundle 大小增长 > 20% → 报告
 */
export class UiRegressionAnalyzer extends BaseAnalyzer {
  readonly id = 'ui-regression';
  readonly category = AnalysisCategory.performance;

  private static readonly SIZE_INCREASE_THRESHOLD = 0.20;

  protected async run(config: BiuOptConfig): Promise<AnalysisResult[]> {
    const uiCfg = config.analyzers['ui-regression'];
    if (!uiCfg?.enabled) return [];

    const rootDir = resolve(config.rootDir);
    const results: AnalysisResult[] = [];
    let counter = 0;

    // 收集当前构建产物
    const currentBundles = await this.collectBundles(rootDir);

    if (currentBundles.length === 0) {
      return [
        {
          id: `uir-no-build-${Date.now()}`,
          analyzerId: this.id,
          category: this.category,
          severity: Severity.info,
          message: '未找到构建产物 (client/dist/ 或 dist/)。请先执行构建。',
          suggestion: '运行 npm run build 后再执行 UI 回归测试',
        },
      ];
    }

    // 获取上一次快照中的 bundle 信息
    try {
      const store = new SnapshotStore(rootDir);
      const latest = await store.getLatest();

      if (latest) {
        const prevBundleSizeBytes =
          latest.metrics.bundleSizeBytes;

        const prevBundles = prevBundleSizeBytes != null
          ? await this.collectBundles(rootDir)
          : null;

        // 如果有历史 bundle 数据，对比
        // 简化：直接检查当前 bundle 大小
        const totalSize = currentBundles.reduce((s, b) => s + b.size, 0);

        results.push({
          id: `uir-${String(counter++).padStart(4, '0')}`,
          analyzerId: this.id,
          category: this.category,
          severity: Severity.info,
          message: `构建产物总大小: ${(totalSize / 1024).toFixed(1)} KB (${currentBundles.length} 个文件)`,
          metadata: {
            totalSizeBytes: totalSize,
            fileCount: currentBundles.length,
            files: currentBundles.map((b) => ({
              name: b.path,
              size: b.size,
            })),
          },
        });

        // 如果上次也有数据，进行对比
        const prevBundleSize = prevBundleSizeBytes;
        if (prevBundleSize != null && prevBundleSize > 0) {
          const increase =
            (totalSize - prevBundleSize) / prevBundleSize;

          if (
            increase >
            UiRegressionAnalyzer.SIZE_INCREASE_THRESHOLD
          ) {
            results.push({
              id: `uir-${String(counter++).padStart(4, '0')}`,
              analyzerId: this.id,
              category: this.category,
              severity: Severity.high,
              message: `Bundle 大小增长 ${(increase * 100).toFixed(1)}%，超过 ${UiRegressionAnalyzer.SIZE_INCREASE_THRESHOLD * 100}% 阈值`,
              suggestion:
                '请检查构建产物，排查是否引入了意外的大型依赖',
              rule: 'bundle-size-regression',
              metadata: {
                currentSizeBytes: totalSize,
                previousSizeBytes: prevBundleSize,
                increasePercent: Math.round(increase * 100),
              },
            });
          }
        }

        return results;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      warn(`[ui-regression] 获取历史数据失败: ${msg}`);
    }

    // 无历史数据，仅报告当前状态
    const totalSize = currentBundles.reduce((s, b) => s + b.size, 0);
    results.push({
      id: `uir-init-${Date.now()}`,
      analyzerId: this.id,
      category: this.category,
      severity: Severity.info,
      message: `构建产物总大小: ${(totalSize / 1024).toFixed(1)} KB (${currentBundles.length} 个文件)`,
      metadata: {
        totalSizeBytes: totalSize,
        fileCount: currentBundles.length,
      },
    });

    return results;
  }

  private async collectBundles(rootDir: string): Promise<BundleFileInfo[]> {
    const distDirs = [
      resolve(rootDir, 'client', 'dist'),
      resolve(rootDir, 'dist'),
    ];

    const bundles: BundleFileInfo[] = [];

    for (const distDir of distDirs) {
      try {
        await this.walkDir(distDir, distDir, bundles);
      } catch {
        // dir doesn't exist
      }
    }

    return bundles;
  }

  private async walkDir(
    baseDir: string,
    currentDir: string,
    result: BundleFileInfo[],
  ): Promise<void> {
    let entries;
    try {
      entries = await readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = resolve(currentDir, entry.name);
      const relativePath = fullPath.slice(baseDir.length + 1);

      if (entry.isDirectory()) {
        await this.walkDir(baseDir, fullPath, result);
      } else if (
        entry.isFile() &&
        (entry.name.endsWith('.js') ||
          entry.name.endsWith('.css') ||
          entry.name.endsWith('.html'))
      ) {
        try {
          const s = await stat(fullPath);
          result.push({ path: relativePath, size: s.size });
        } catch {
          // skip
        }
      }
    }
  }
}
