// ============================================================
// Biu Auto-Optimizer — R-07: Prisma N+1 查询检测
// ============================================================

import { BaseAnalyzer } from './base.js';
import type { BiuOptConfig } from '../config/types.js';
import type { AnalysisResult } from '../types/analysis.js';
import { AnalysisCategory, Severity } from '../types/analysis.js';
import { debug, warn } from '../utils/logger.js';
import fastGlob from 'fast-glob';
import { readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';

/**
 * NPlusOneAnalyzer — Prisma N+1 查询检测
 *
 * 扫描 server/src/ 下的 .ts 文件，检测：
 * 1. 循环内出现 prisma.*.findFirst/findUnique/findMany
 * 2. 是否已有 include 优化
 */
export class NPlusOneAnalyzer extends BaseAnalyzer {
  readonly id = 'n-plus-one';
  readonly category = AnalysisCategory.performance;

  // Prisma 查询方法特征
  private static readonly PRISMA_METHODS = [
    'findFirst',
    'findUnique',
    'findMany',
    'findFirstOrThrow',
    'findUniqueOrThrow',
    'count',
  ];

  // 循环关键词
  private static readonly LOOP_KEYWORDS = [
    'for',
    'while',
    'forEach',
    'map',
    'filter',
    'reduce',
    'flatMap',
    'every',
    'some',
    'find',
  ];

  protected async run(config: BiuOptConfig): Promise<AnalysisResult[]> {
    const results: AnalysisResult[] = [];

    // 从 workspaces 中找 server 目录
    const serverDirs = this.findServerDirs(config);

    if (serverDirs.length === 0) {
      debug('[n-plus-one] 未找到 server workspace，跳过扫描');
      return results;
    }

    const tsFiles = await this.scanTsFiles(serverDirs);

    let counter = 0;
    for (const filePath of tsFiles) {
      try {
        const findings = await this.analyzeFile(filePath);
        for (const finding of findings) {
          results.push({
            ...finding,
            id: `n1-${String(counter++).padStart(4, '0')}`,
          });
        }
      } catch {
        // 读取失败，跳过
      }
    }

    return results;
  }

  // ---- 辅助方法 ----

  private findServerDirs(config: BiuOptConfig): string[] {
    const rootDir = resolve(config.rootDir);
    return config.workspaces
      .filter((ws) => ws.toLowerCase().includes('server'))
      .map((ws) => resolve(rootDir, ws));
  }

  private async scanTsFiles(dirs: string[]): Promise<string[]> {
    const patterns = dirs.flatMap((dir) => [
      `${dir}/**/*.ts`,
      `${dir}/**/*.tsx`,
    ]);
    patterns.push('!**/node_modules/**', '!**/.biu-opt/**', '!**/*.test.ts', '!**/*.spec.ts');

    try {
      return await fastGlob(patterns, { absolute: true, onlyFiles: true });
    } catch {
      return [];
    }
  }

  private async analyzeFile(filePath: string): Promise<Omit<AnalysisResult, 'id'>[]> {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const results: Omit<AnalysisResult, 'id'>[] = [];

    // 逐行检测：在循环范围内查找 Prisma 查询
    let inLoop = false;
    let loopStart = 0;
    let loopDepth = 0;
    let hasIncludeInScope = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const trimmed = line.trim();

      // 跳过注释行
      if (
        trimmed.startsWith('//') ||
        trimmed.startsWith('/*') ||
        trimmed.startsWith('*')
      ) {
        continue;
      }

      // 检测循环开始
      const loopMatch = this.matchLoopStart(trimmed);
      if (loopMatch) {
        if (!inLoop) {
          inLoop = true;
          loopStart = i + 1;
          loopDepth = 1;
          hasIncludeInScope = false;
        } else {
          loopDepth++;
        }
        continue;
      }

      // 检测循环结束（简化：通过缩进推断）
      if (inLoop && trimmed.startsWith('}')) {
        loopDepth--;
        if (loopDepth <= 0) {
          inLoop = false;
          loopDepth = 0;
        }
        continue;
      }

      // 在循环内检测 Prisma 查询
      if (inLoop) {
        // 检测 include
        if (trimmed.includes('include:') || trimmed.includes('include :')) {
          hasIncludeInScope = true;
        }

        // 检测 Prisma 查询方法
        const prismaMatch = trimmed.match(
          /\bprisma\s*\.\s*\w+\s*\.\s*(findFirst|findUnique|findMany|findFirstOrThrow|findUniqueOrThrow|count)\s*\(/,
        );

        if (prismaMatch) {
          const method = prismaMatch[1]!;
          const hasInclude = hasIncludeInScope || trimmed.includes('include');

          results.push({
            analyzerId: this.id,
            category: this.category,
            severity: hasInclude ? Severity.low : Severity.high,
            file: filePath,
            line: i + 1,
            message: `循环内 Prisma.${method}() 调用可能导致 N+1 查询问题${hasInclude ? '（已使用 include）' : ''}`,
            suggestion: hasInclude
              ? '已使用 include 优化，请确认关联数据已正确预加载'
              : `建议使用 include 预加载关联数据，或改用 findMany + where in 批量查询替代循环内逐条查询`,
            rule: 'n-plus-one',
            metadata: {
              method,
              hasInclude,
              loopLine: loopStart,
            },
          });
        }
      }
    }

    return results;
  }

  private matchLoopStart(line: string): boolean {
    const loopPatterns = [
      /\bfor\s*\(/,
      /\bwhile\s*\(/,
      /\.forEach\s*\(/,
      /\.map\s*\(/,
      /\.filter\s*\(/,
      /\.flatMap\s*\(/,
      /\bevery\s*\(/,
      /\bsome\s*\(/,
    ];

    // 排除 .filter 后跟的回调等（仅检查 Prisma 方法不在同一行的情况）
    return loopPatterns.some((p) => p.test(line));
  }
}
