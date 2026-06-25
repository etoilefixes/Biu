// ============================================================
// Biu Auto-Optimizer — R-11: 重复代码检测
// ============================================================

import { BaseAnalyzer } from './base.js';
import type { BiuOptConfig } from '../config/types.js';
import type { AnalysisResult } from '../types/analysis.js';
import { AnalysisCategory, Severity } from '../types/analysis.js';
import { debug } from '../utils/logger.js';
import fastGlob from 'fast-glob';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, relative } from 'node:path';

/**
 * DuplicateCodeAnalyzer — 重复代码检测
 *
 * 文件级别 hash 对比 + 行级相似度检测
 * 算法：每非空行 trim → MD5 → 构建行hash集合 → 对比文件间hash交集
 * 相似度 > 80% → 报告
 */
export class DuplicateCodeAnalyzer extends BaseAnalyzer {
  readonly id = 'duplicate-code';
  readonly category = AnalysisCategory.duplication;

  private static readonly SIMILARITY_THRESHOLD = 0.80;

  protected async run(config: BiuOptConfig): Promise<AnalysisResult[]> {
    const rootDir = resolve(config.rootDir);
    const files = await this.scanFiles(rootDir, config.workspaces);

    if (files.length < 2) return [];

    // 计算每个文件的 hash set
    const fileHashes = await this.computeFileHashes(files);
    const results: AnalysisResult[] = [];
    let counter = 0;

    // 两两对比（优化：仅对比 size 接近的文件）
    const entries = Object.entries(fileHashes);
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const [fileA, hashesA] = entries[i]!;
        const [fileB, hashesB] = entries[j]!;

        if (hashesA.size === 0 || hashesB.size === 0) continue;

        const similarity = this.computeSimilarity(hashesA, hashesB);

        if (similarity >= DuplicateCodeAnalyzer.SIMILARITY_THRESHOLD) {
          results.push({
            id: `dup-${String(counter++).padStart(4, '0')}`,
            analyzerId: this.id,
            category: this.category,
            severity:
              similarity > 0.95
                ? Severity.high
                : similarity > 0.85
                  ? Severity.moderate
                  : Severity.low,
            file: fileA,
            message: `与 ${relative(rootDir, fileB)} 代码重复度 ${(similarity * 100).toFixed(1)}%`,
            suggestion:
              '考虑将重复代码抽取为共享模块或工具函数',
            rule: 'code-duplication',
            metadata: {
              fileA,
              fileB,
              similarityPercent: Math.round(similarity * 100),
              hashCountA: hashesA.size,
              hashCountB: hashesB.size,
            },
          });
        }
      }
    }

    debug(`[duplicate-code] 发现 ${results.length} 对重复代码`);
    return results;
  }

  private async scanFiles(
    rootDir: string,
    workspaces: string[],
  ): Promise<string[]> {
    const wsPatterns = workspaces.length > 0
      ? workspaces.map((ws) => `${resolve(rootDir, ws)}/**/*.ts`)
      : [`${rootDir}/**/*.ts`];

    wsPatterns.push(`${rootDir}/**/*.tsx`);
    wsPatterns.push(
      '!**/node_modules/**',
      '!**/.biu-opt/**',
      '!**/*.test.ts',
      '!**/*.spec.ts',
      '!**/*.d.ts',
    );

    try {
      return await fastGlob(wsPatterns, { absolute: true, onlyFiles: true });
    } catch {
      return [];
    }
  }

  private async computeFileHashes(
    files: string[],
  ): Promise<Record<string, Set<string>>> {
    const result: Record<string, Set<string>> = {};

    for (const filePath of files) {
      try {
        const content = await readFile(filePath, 'utf-8');
        const lines = content.split('\n');
        const hashSet = new Set<string>();

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed === '' || trimmed.startsWith('//') || trimmed.startsWith('import ') || trimmed.startsWith('export ') && trimmed.includes('from')) {
            continue;
          }
          const hash = createHash('md5').update(trimmed).digest('hex');
          hashSet.add(hash);
        }

        if (hashSet.size > 0) {
          result[filePath] = hashSet;
        }
      } catch {
        // skip unreadable
      }
    }

    return result;
  }

  private computeSimilarity(a: Set<string>, b: Set<string>): number {
    const intersection = new Set([...a].filter((h) => b.has(h)));
    const union = new Set([...a, ...b]);
    return union.size > 0 ? intersection.size / union.size : 0;
  }
}
