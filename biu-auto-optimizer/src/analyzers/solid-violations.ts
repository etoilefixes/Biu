// ============================================================
// Biu Auto-Optimizer — R-12: SOLID 违规检测
// ============================================================

import { BaseAnalyzer } from './base.js';
import type { BiuOptConfig } from '../config/types.js';
import type { AnalysisResult } from '../types/analysis.js';
import { AnalysisCategory, Severity } from '../types/analysis.js';
import { debug } from '../utils/logger.js';
import fastGlob from 'fast-glob';
import { readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';

/**
 * SolidViolationsAnalyzer — SOLID 原则违规检测
 *
 * 检测 3 种违规：
 * 1. SRP 违规：文件内 export 数量 > 5 → high
 * 2. 接口过大：interface/type 成员 > 10 → moderate
 * 3. 深度继承：extends 链深度 > 3 → moderate
 */
export class SolidViolationsAnalyzer extends BaseAnalyzer {
  readonly id = 'solid-violations';
  readonly category = AnalysisCategory['code-quality'];

  private static readonly SRP_THRESHOLD = 5;
  private static readonly INTERFACE_MEMBER_THRESHOLD = 10;
  private static readonly INHERITANCE_DEPTH_THRESHOLD = 3;

  protected async run(config: BiuOptConfig): Promise<AnalysisResult[]> {
    const rootDir = resolve(config.rootDir);
    const files = await this.scanFiles(rootDir, config.workspaces);

    const results: AnalysisResult[] = [];
    let counter = 0;

    for (const filePath of files) {
      try {
        const content = await readFile(filePath, 'utf-8');
        const relativePath = relative(rootDir, filePath);

        // SRP: 统计导出数量
        const srpIssues = this.checkSRP(content, relativePath);
        results.push(
          ...srpIssues.map((issue) => ({
            ...issue,
            id: `solid-${String(counter++).padStart(4, '0')}`,
          })),
        );

        // 接口大小
        const interfaceIssues = this.checkInterfaceSize(content, relativePath);
        results.push(
          ...interfaceIssues.map((issue) => ({
            ...issue,
            id: `solid-${String(counter++).padStart(4, '0')}`,
          })),
        );

        // 深度继承
        const inheritanceIssues = this.checkDeepInheritance(
          content,
          relativePath,
        );
        results.push(
          ...inheritanceIssues.map((issue) => ({
            ...issue,
            id: `solid-${String(counter++).padStart(4, '0')}`,
          })),
        );
      } catch {
        // skip
      }
    }

    debug(`[solid-violations] 发现 ${results.length} 个违规`);
    return results;
  }

  private async scanFiles(
    rootDir: string,
    workspaces: string[],
  ): Promise<string[]> {
    const patterns = workspaces.flatMap((ws) => [
      `${resolve(rootDir, ws)}/**/*.ts`,
      `${resolve(rootDir, ws)}/**/*.tsx`,
    ]);
    patterns.push(
      '!**/node_modules/**',
      '!**/.biu-opt/**',
      '!**/*.test.ts',
      '!**/*.spec.ts',
      '!**/*.d.ts',
    );

    try {
      return await fastGlob(patterns, { absolute: true, onlyFiles: true });
    } catch {
      return [];
    }
  }

  // ---- SRP 检测 ----

  private checkSRP(
    content: string,
    filePath: string,
  ): Omit<AnalysisResult, 'id'>[] {
    const results: Omit<AnalysisResult, 'id'>[] = [];

    // 统计 export 的 class/function/const
    const exportPattern = /export\s+(class|function|const|let|interface|type|enum)\s+(\w+)/g;
    const matches = [...content.matchAll(exportPattern)];

    // 按类型去重
    const exportedNames = new Set(matches.map((m) => m[2]));

    if (
      exportedNames.size >
      SolidViolationsAnalyzer.SRP_THRESHOLD
    ) {
      results.push({
        analyzerId: this.id,
        category: this.category,
        severity: Severity.high,
        file: filePath,
        message: `SRP 违规: 文件导出了 ${exportedNames.size} 个符号 (阈值 ${SolidViolationsAnalyzer.SRP_THRESHOLD})`,
        suggestion:
          '考虑按功能拆分为多个文件，每个文件只负责单一职责',
        rule: 'solid-srp',
        metadata: {
          exportedCount: exportedNames.size,
          exportedNames: [...exportedNames].slice(0, 10),
        },
      });
    }

    return results;
  }

  // ---- 接口大小 ----

  private checkInterfaceSize(
    content: string,
    filePath: string,
  ): Omit<AnalysisResult, 'id'>[] {
    const results: Omit<AnalysisResult, 'id'>[] = [];

    // 匹配 interface/type 定义
    const ifacePattern =
      /(?:export\s+)?(?:interface|type)\s+(\w+)\s*(?:extends\s+[^{]+)?\s*\{([^}]*)\}/gs;

    let match: RegExpExecArray | null;
    while ((match = ifacePattern.exec(content)) !== null) {
      const name = match[1]!;
      const body = match[2]!;

      // 统计成员（行数近似）
      const memberLines = body
        .split('\n')
        .filter((l) => l.trim() && !l.trim().startsWith('//')).length;

      if (memberLines > SolidViolationsAnalyzer.INTERFACE_MEMBER_THRESHOLD) {
        results.push({
          analyzerId: this.id,
          category: this.category,
          severity: Severity.moderate,
          file: filePath,
          message: `接口过大: ${name} 有 ${memberLines} 个成员 (阈值 ${SolidViolationsAnalyzer.INTERFACE_MEMBER_THRESHOLD})`,
          suggestion:
            '考虑将接口拆分为多个更小的接口，遵循 ISP 接口隔离原则',
          rule: 'solid-isp',
          metadata: {
            interfaceName: name,
            memberCount: memberLines,
          },
        });
      }
    }

    return results;
  }

  // ---- 深度继承 ----

  private checkDeepInheritance(
    content: string,
    filePath: string,
  ): Omit<AnalysisResult, 'id'>[] {
    const results: Omit<AnalysisResult, 'id'>[] = [];

    // 匹配 extends 链
    // class A extends B extends C ... 的模式在多级继承中
    // 简化检测：查找 extends 关键词后的类名，检查是否有已知的继承关系
    const classPattern =
      /class\s+(\w+)(?:\s*<[^>]+>)?\s+extends\s+(\w+)/g;

    let match: RegExpExecArray | null;
    while ((match = classPattern.exec(content)) !== null) {
      const className = match[1]!;
      const parentName = match[2]!;

      // 尝试检查继承深度：在全文件中查找 parentName 是否也 extends
      const parentExtendsPattern = new RegExp(
        `class\\s+${parentName}\\s+extends\\s+(\\w+)`,
      );
      const parentMatch = content.match(parentExtendsPattern);

      if (parentMatch) {
        // 父类也继承了，检查祖类是否也继承
        const grandParent = parentMatch[1]!;
        const grandExtendsPattern = new RegExp(
          `class\\s+${grandParent}\\s+extends\\s+(\\w+)`,
        );
        const grandMatch = content.match(grandExtendsPattern);

        const depth = grandMatch ? 3 : 2;

        if (
          depth >=
          SolidViolationsAnalyzer.INHERITANCE_DEPTH_THRESHOLD
        ) {
          results.push({
            analyzerId: this.id,
            category: this.category,
            severity: Severity.moderate,
            file: filePath,
            message: `深度继承: ${className} 继承链深度 ${depth} (阈值 ${SolidViolationsAnalyzer.INHERITANCE_DEPTH_THRESHOLD})`,
            suggestion:
              '考虑使用组合模式替代深层继承，遵循组合优于继承原则',
            rule: 'solid-dip',
            metadata: {
              className,
              inheritanceChain: grandMatch
                ? `${className} → ${parentName} → ${grandParent}`
                : `${className} → ${parentName}`,
              depth,
            },
          });
        }
      }
    }

    return results;
  }
}
