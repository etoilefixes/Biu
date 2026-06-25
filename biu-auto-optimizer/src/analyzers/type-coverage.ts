// ============================================================
// Biu Auto-Optimizer — R-16: TypeScript 类型覆盖率
// ============================================================

import { BaseAnalyzer } from './base.js';
import type { BiuOptConfig } from '../config/types.js';
import type { AnalysisResult } from '../types/analysis.js';
import { AnalysisCategory, Severity } from '../types/analysis.js';
import { debug, warn } from '../utils/logger.js';
import fastGlob from 'fast-glob';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/**
 * TypeCoverageAnalyzer — TS 类型覆盖率分析
 *
 * 简化方案：统计代码中 any 类型、as 断言的使用频率
 * 覆盖率 = 1 - (anyCount / totalTypeAnnotations)
 *
 * 低于 thresholds.typeCoverageMin → 告警
 */
export class TypeCoverageAnalyzer extends BaseAnalyzer {
  readonly id = 'type-coverage';
  readonly category = AnalysisCategory['type-safety'];

  protected async run(config: BiuOptConfig): Promise<AnalysisResult[]> {
    const rootDir = resolve(config.rootDir);
    const threshold = config.thresholds.typeCoverageMin;

    // 1. 尝试使用 type-coverage CLI
    const cliResult = await this.tryTypeCoverageCLI(rootDir);
    if (cliResult !== null) {
      return cliResult;
    }

    // 2. 回退：手动扫描
    debug('[type-coverage] type-coverage CLI 不可用，使用手动扫描');
    return this.manualScan(rootDir, config.workspaces, threshold);
  }

  // ---- type-coverage CLI ----

  private async tryTypeCoverageCLI(
    rootDir: string,
  ): Promise<AnalysisResult[] | null> {
    try {
      const { exec } = await import('../utils/exec.js');
      const result = await exec(
        'npx',
        ['type-coverage', '--detail', '--json'],
        { cwd: rootDir, timeout: 60_000 },
      );

      if (!result.stdout) return null;

      const parsed = JSON.parse(result.stdout) as {
        correctCount?: number;
        totalCount?: number;
        anyCount?: number;
        percentage?: number;
        anys?: Array<{ file: string; line: number; text: string }>;
      };

      const coverage = parsed.percentage ?? 0;

      return [
        {
          id: 'tc-coverage',
          analyzerId: this.id,
          category: this.category,
          severity:
            coverage < 95 ? Severity.high : coverage < 98 ? Severity.moderate : Severity.info,
          message: `TypeScript 类型覆盖率: ${coverage.toFixed(1)}%`,
          suggestion:
            coverage < 95
              ? '减少 any 类型使用，为所有函数参数、返回值添加明确类型标注'
              : undefined,
          rule: 'type-coverage',
          metadata: {
            correctCount: parsed.correctCount,
            totalCount: parsed.totalCount,
            anyCount: parsed.anyCount,
            percentage: coverage,
          },
        },
      ];
    } catch {
      return null;
    }
  }

  // ---- 手动扫描 ----

  private async manualScan(
    rootDir: string,
    workspaces: string[],
    threshold: number,
  ): Promise<AnalysisResult[]> {
    const patterns: string[] = workspaces.flatMap((ws) => [
      `${resolve(rootDir, ws)}/**/*.ts`,
      `${resolve(rootDir, ws)}/**/*.tsx`,
    ]);

    patterns.push(
      '!**/node_modules/**',
      '!**/.biu-opt/**',
      '!**/*.test.ts',
      '!**/*.spec.ts',
      '!**/*.test.tsx',
      '!**/*.spec.tsx',
      '!**/*.d.ts',
    );

    let files: string[];
    try {
      files = await fastGlob(patterns, { absolute: true, onlyFiles: true });
    } catch {
      return [];
    }

    // 统计
    let anyCount = 0;
    let annotationCount = 0;
    const anyFiles: Array<{ file: string; count: number }> = [];

    for (const filePath of files.slice(0, 500)) {
      try {
        const content = await readFile(filePath, 'utf-8');

        // 统计 any 类型使用
        const anyMatches = content.match(/\b:\s*any\b/g);
        if (anyMatches) {
          anyCount += anyMatches.length;
          anyFiles.push({ file: filePath, count: anyMatches.length });
        }

        // 统计 as any / as unknown as
        const asAnyMatches = content.match(/\bas\s+any\b/g);
        if (asAnyMatches) {
          anyCount += asAnyMatches.length;
        }

        // 统计类型标注总数（粗略：函数参数类型 + 变量类型标注）
        const typeAnnotationMatches = content.match(/:\s*(?!any\b)(string|number|boolean|void|never|unknown|Record|Map|Set|Array|Promise)[\s<[{]/g);
        if (typeAnnotationMatches) {
          annotationCount += typeAnnotationMatches.length;
        }
      } catch {
        // skip
      }
    }

    const totalAnnotations = anyCount + annotationCount;
    const coverage = totalAnnotations > 0 ? 1 - anyCount / totalAnnotations : 1;
    const coveragePercent = coverage * 100;

    const results: AnalysisResult[] = [
      {
        id: 'tc-overall',
        analyzerId: this.id,
        category: this.category,
        severity:
          coveragePercent < threshold * 100 ? Severity.high : Severity.info,
        message: `类型覆盖率: ${coveragePercent.toFixed(1)}% (any: ${anyCount}, 标注: ${annotationCount + anyCount})`,
        suggestion:
          coveragePercent < threshold * 100
            ? '请减少 any 类型使用，为参数和返回值添加明确类型'
            : undefined,
        rule: 'type-coverage',
        metadata: {
          anyCount,
          typeAnnotationCount: annotationCount,
          totalAnnotations,
          coverage: coveragePercent,
          threshold: threshold * 100,
        },
      },
    ];

    // any 使用最多的文件 Top 5
    anyFiles.sort((a, b) => b.count - a.count);
    for (const item of anyFiles.slice(0, 5)) {
      results.push({
        id: `tc-file-${item.file.replace(/[^a-zA-Z0-9]/g, '-').slice(-20)}`,
        analyzerId: this.id,
        category: this.category,
        severity: Severity.moderate,
        file: item.file,
        message: `该文件使用了 ${item.count} 处 any 类型`,
        suggestion: '为这些位置添加明确的类型标注',
        rule: 'no-any',
        metadata: { anyCount: item.count },
      });
    }

    return results;
  }
}
