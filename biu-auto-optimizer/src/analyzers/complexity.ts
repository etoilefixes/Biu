// ============================================================
// Biu Auto-Optimizer — R-08: 代码复杂度分析
// ============================================================

import { BaseAnalyzer } from './base.js';
import type { BiuOptConfig } from '../config/types.js';
import type { AnalysisResult } from '../types/analysis.js';
import { AnalysisCategory, Severity } from '../types/analysis.js';
import { debug } from '../utils/logger.js';
import fastGlob from 'fast-glob';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/**
 * 复杂度超标项
 */
interface ComplexityIssue {
  file: string;
  line: number;
  functionName: string;
  complexityScore: number;
  lineCount: number;
  paramCount: number;
  issueType: 'complexity' | 'function-length' | 'param-count';
}

/**
 * 提取的函数结构
 */
interface ExtractedFunction {
  name: string;
  startLine: number;
  endLine: number;
  params: number;
}

/**
 * ComplexityAnalyzer — 代码复杂度分析
 *
 * 检测三项超标：
 * 1. 圈复杂度 > thresholds.complexityMax (默认 15)
 * 2. 函数行数 > 80
 * 3. 参数数量 > 4
 */
export class ComplexityAnalyzer extends BaseAnalyzer {
  readonly id = 'complexity';
  readonly category = AnalysisCategory.complexity;

  private static readonly MAX_FUNCTION_LINES = 80;
  private static readonly MAX_PARAMS = 4;

  protected async run(config: BiuOptConfig): Promise<AnalysisResult[]> {
    const rootDir = resolve(config.rootDir);
    const complexityMax = config.thresholds.complexityMax;

    const files = await this.scanFiles(rootDir, config.workspaces);
    const allIssues: ComplexityIssue[] = [];

    for (const filePath of files) {
      try {
        const issues = await this.analyzeFile(filePath, complexityMax);
        allIssues.push(...issues);
      } catch {
        // 读取失败，跳过
      }
    }

    return this.toAnalysisResults(allIssues);
  }

  // ---- 文件扫描 ----

  private async scanFiles(
    rootDir: string,
    workspaces: string[],
  ): Promise<string[]> {
    const patterns: string[] = [];

    for (const ws of workspaces) {
      patterns.push(
        `${resolve(rootDir, ws)}/**/*.ts`,
        `${resolve(rootDir, ws)}/**/*.tsx`,
      );
    }

    // 也扫描根目录
    patterns.push(`${rootDir}/**/*.ts`, `${rootDir}/**/*.tsx`);

    patterns.push(
      '!**/node_modules/**',
      '!**/.biu-opt/**',
      '!**/*.test.ts',
      '!**/*.spec.ts',
      '!**/*.test.tsx',
      '!**/*.spec.tsx',
    );

    try {
      return await fastGlob(patterns, { absolute: true, onlyFiles: true });
    } catch {
      return [];
    }
  }

  // ---- 文件分析 ----

  private async analyzeFile(
    filePath: string,
    complexityMax: number,
  ): Promise<ComplexityIssue[]> {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const issues: ComplexityIssue[] = [];

    // 寻找函数定义并分析
    const functions = this.extractFunctions(lines);

    for (const fn of functions) {
      const complexity = this.computeComplexity(
        lines.slice(fn.startLine - 1, fn.endLine),
      );
      const lineCount = fn.endLine - fn.startLine + 1;

      // 圈复杂度检查
      if (complexity > complexityMax) {
        issues.push({
          file: filePath,
          line: fn.startLine,
          functionName: fn.name,
          complexityScore: complexity,
          lineCount,
          paramCount: fn.params,
          issueType: 'complexity',
        });
      }

      // 函数行数检查
      if (lineCount > ComplexityAnalyzer.MAX_FUNCTION_LINES) {
        issues.push({
          file: filePath,
          line: fn.startLine,
          functionName: fn.name,
          complexityScore: complexity,
          lineCount,
          paramCount: fn.params,
          issueType: 'function-length',
        });
      }

      // 参数数量检查
      if (fn.params > ComplexityAnalyzer.MAX_PARAMS) {
        issues.push({
          file: filePath,
          line: fn.startLine,
          functionName: fn.name,
          complexityScore: complexity,
          lineCount,
          paramCount: fn.params,
          issueType: 'param-count',
        });
      }
    }

    return issues;
  }

  // ---- 函数提取 ----

  private extractFunctions(lines: string[]): ExtractedFunction[] {
    const functions: ExtractedFunction[] = [];
    const funcPatterns = [
      // function name(params)
      /^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/,
      // const/let name = (params) => {
      /^\s*(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*(?::\s*[\w<>[\],\s|&]+)?\s*=>\s*\{/,
      // const/let name = async function(params)
      /^\s*(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s+)?function\s*\(([^)]*)\)/,
      // method in class: name(params) {
      /^\s*(?:public\s+|private\s+|protected\s+|static\s+)?(?:async\s+)?(\w+)\s*\(([^)]*)\)\s*(?::\s*[\w<>[\],\s|&]+)?\s*\{/,
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const trimmed = line.trim();

      // 跳过注释
      if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
        continue;
      }

      // 跳过箭头函数简化形式（无花括号）
      if (trimmed.includes('=>') && !trimmed.endsWith('{') && !trimmed.endsWith('({')) {
        continue;
      }

      for (const pattern of funcPatterns) {
        const match = line.match(pattern);
        if (!match) continue;

        const name = match[1] ?? '';
        const paramsStr = match[2] ?? '';

        // 跳过常见的非函数匹配
        if (name === 'if' || name === 'for' || name === 'while' || name === 'switch' || name === 'catch') {
          continue;
        }

        const params = paramsStr.trim() === '' ? 0 : paramsStr.split(',').length;

        // 简化：找函数体的结束（通过大括号匹配）
        let depth = 0;
        let started = false;
        let endLine = i + 1;

        for (let j = i; j < lines.length; j++) {
          const l = lines[j]!;

          for (const ch of l) {
            if (ch === '{') {
              depth++;
              started = true;
            } else if (ch === '}') {
              depth--;
            }
          }

          if (started && depth === 0) {
            endLine = j + 1;
            break;
          }
        }

        functions.push({
          name,
          startLine: i + 1,
          endLine,
          params,
        });

        break;
      }
    }

    return functions;
  }

  // ---- 圈复杂度计算 ----

  private computeComplexity(lines: string[]): number {
    let complexity = 1; // 基础复杂度

    for (const line of lines) {
      const trimmed = line.trim();

      // 跳过注释
      if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
        continue;
      }

      // 分支关键字
      const branchKeywords = [
        /\bif\s*\(/g,
        /\bwhile\s*\(/g,
        /\bfor\s*\(/g,
        /\bswitch\s*\(/g,
        /\bcase\b/g,
        /\bcatch\s*\(/g,
        /\?\s*.*\s*:/g, // 三元运算符
        /\&\&/g,
        /\|\|/g,
        /\belse\s+if\b/g,
      ];

      for (const pattern of branchKeywords) {
        const matches = trimmed.match(pattern);
        if (matches) {
          complexity += matches.length;
        }
      }

      // 对于 case，减去 switch 自身计入的 1（避免重复计数）
      if (trimmed.match(/\bcase\b/g)) {
        complexity += 0; // switch 已计入
      }
    }

    return complexity;
  }

  // ---- 结果转换 ----

  private toAnalysisResults(issues: ComplexityIssue[]): AnalysisResult[] {
    const results: AnalysisResult[] = [];

    for (const issue of issues) {
      switch (issue.issueType) {
        case 'complexity':
          results.push({
            id: `cx-${issue.file.replace(/[^a-zA-Z0-9]/g, '-').slice(-20)}-${issue.line}-comp`,
            analyzerId: this.id,
            category: this.category,
            severity:
              issue.complexityScore > 30
                ? Severity.high
                : Severity.moderate,
            file: issue.file,
            line: issue.line,
            message: `函数 ${issue.functionName}() 圈复杂度为 ${issue.complexityScore}，超过阈值`,
            suggestion: `将 ${issue.functionName}() 拆分为更小的函数，提取条件逻辑为独立方法`,
            rule: 'complexity',
            metadata: {
              functionName: issue.functionName,
              complexity: issue.complexityScore,
              lines: issue.lineCount,
            },
          });
          break;

        case 'function-length':
          results.push({
            id: `cx-${issue.file.replace(/[^a-zA-Z0-9]/g, '-').slice(-20)}-${issue.line}-len`,
            analyzerId: this.id,
            category: this.category,
            severity: Severity.moderate,
            file: issue.file,
            line: issue.line,
            message: `函数 ${issue.functionName}() 行数 ${issue.lineCount} 超过 80 行`,
            suggestion: `建议将 ${issue.functionName}() 拆分为多个职责单一的小函数`,
            rule: 'max-function-lines',
            metadata: {
              functionName: issue.functionName,
              lines: issue.lineCount,
            },
          });
          break;

        case 'param-count':
          results.push({
            id: `cx-${issue.file.replace(/[^a-zA-Z0-9]/g, '-').slice(-20)}-${issue.line}-param`,
            analyzerId: this.id,
            category: this.category,
            severity: Severity.low,
            file: issue.file,
            line: issue.line,
            message: `函数 ${issue.functionName}() 参数过多 (${issue.paramCount})`,
            suggestion: `考虑将参数封装为对象参数或使用 Builder 模式`,
            rule: 'max-params',
            metadata: {
              functionName: issue.functionName,
              paramCount: issue.paramCount,
            },
          });
          break;
      }
    }

    return results;
  }
}
