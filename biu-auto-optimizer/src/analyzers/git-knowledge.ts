// ============================================================
// Biu Auto-Optimizer — R-13: Git 知识地图
// ============================================================

import { BaseAnalyzer } from './base.js';
import type { BiuOptConfig } from '../config/types.js';
import type { AnalysisResult } from '../types/analysis.js';
import { AnalysisCategory, Severity } from '../types/analysis.js';
import { debug, warn } from '../utils/logger.js';
import { GitRunner } from '../runners/git.js';
import { resolve, relative } from 'node:path';

/**
 * 文件 Git 信息
 */
interface FileGitInfo {
  file: string;
  contributor: string;
  lastModified: string;
  commitCount: number;
  lastHash: string;
}

/**
 * GitKnowledgeAnalyzer — Git 知识地图
 *
 * 使用 simple-git log 获取每个文件的：
 * - 主要贡献者
 * - 最后修改时间
 * - 修改频率（近 90 天提交数）
 */
export class GitKnowledgeAnalyzer extends BaseAnalyzer {
  readonly id = 'git-knowledge';
  readonly category = AnalysisCategory['code-quality'];

  protected async run(config: BiuOptConfig): Promise<AnalysisResult[]> {
    const rootDir = resolve(config.rootDir);

    try {
      const git = new GitRunner(rootDir);

      // 按文件获取 log
      const logEntries = await git.log({
        maxCount: 200,
      });

      // 聚合每个文件的提交信息
      const fileStats = new Map<
        string,
        {
          contributors: Map<string, number>;
          lastModified: string;
          commitCount: number;
          lastHash: string;
        }
      >();

      const now = Date.now();
      const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;

      for (const entry of logEntries) {
        const commitDate = new Date(entry.date);
        const isRecent = now - commitDate.getTime() < ninetyDaysMs;

        // simple-git log 的 diff 可能不可用，这里用文件级别的近似
        // 实际通过 git log --name-only 获取每个提交的文件列表
        if (!isRecent) continue;
      }

      // 方案：使用 git log 整体，然后按每个文件聚合
      // 简化实现：获取最近 90 天的所有提交
      const since = new Date(now - ninetyDaysMs).toISOString();

      // 按文件获取 log（逐文件）
      const tsFiles = Object.keys(
        await this.getTrackedFiles(rootDir),
      ).filter(
        (f) =>
          (f.endsWith('.ts') || f.endsWith('.tsx')) &&
          !f.includes('node_modules') &&
          !f.includes('.biu-opt'),
      );

      for (const file of tsFiles.slice(0, 200)) {
        try {
          // 对每个文件执行 git log
          const { exec } = await import('../utils/exec.js');
          const logResult = await exec(
            'git',
            [
              'log',
              '--format=%H|%an|%aI',
              '--since',
              since,
              '--',
              file,
            ],
            { cwd: rootDir, timeout: 15_000 },
          );

          const commits = logResult.stdout
            .split('\n')
            .filter(Boolean)
            .map((line) => {
              const [hash, author, date] = line.split('|');
              return { hash: hash ?? '', author: author ?? '', date: date ?? '' };
            });

          if (commits.length > 0) {
            const contributors = new Map<string, number>();
            for (const c of commits) {
              contributors.set(
                c.author,
                (contributors.get(c.author) ?? 0) + 1,
              );
            }

            // 找到主要贡献者
            let topContributor = '';
            let topCount = 0;
            for (const [author, count] of contributors) {
              if (count > topCount) {
                topContributor = author;
                topCount = count;
              }
            }

            const topEntry = commits[0]!;
            fileStats.set(file, {
              contributors,
              lastModified: topEntry.date,
              commitCount: commits.length,
              lastHash: topEntry.hash,
            });
          }
        } catch {
          // 单文件失败不影响整体
        }
      }

      // 构建结果
      const results: AnalysisResult[] = [];
      let counter = 0;

      // 按修改频率排序
      const sorted = [...fileStats.entries()]
        .sort(([, a], [, b]) => b.commitCount - a.commitCount);

      for (const [file, stats] of sorted) {
        const relativePath = relative(rootDir, file);

        results.push({
          id: `gk-${String(counter++).padStart(4, '0')}`,
          analyzerId: this.id,
          category: this.category,
          severity: Severity.info,
          file: relativePath,
          message: `${relativePath} — 主要贡献者: ${this.getTopContributor(stats.contributors)}, 近90天 ${stats.commitCount} 次提交`,
          metadata: {
            contributor: this.getTopContributor(stats.contributors),
            lastModified: stats.lastModified,
            commitCount: stats.commitCount,
            contributors: Object.fromEntries(stats.contributors),
          },
        });
      }

      debug(`[git-knowledge] 分析了 ${results.length} 个文件`);
      return results;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      warn(`[git-knowledge] 分析失败: ${msg}`);
      return [];
    }
  }

  private async getTrackedFiles(rootDir: string): Promise<Record<string, string>> {
    try {
      const { exec } = await import('../utils/exec.js');
      const result = await exec(
        'git',
        ['ls-files', '--full-name'],
        { cwd: rootDir, timeout: 10_000 },
      );

      const files: Record<string, string> = {};
      for (const line of result.stdout.split('\n').filter(Boolean)) {
        files[resolve(rootDir, line.trim())] = line.trim();
      }
      return files;
    } catch {
      return {};
    }
  }

  private getTopContributor(
    contributors: Map<string, number>,
  ): string {
    let top = '';
    let max = 0;
    for (const [name, count] of contributors) {
      if (count > max) {
        top = name;
        max = count;
      }
    }
    return top;
  }
}
