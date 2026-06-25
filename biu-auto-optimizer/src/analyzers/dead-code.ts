// ============================================================
// Biu Auto-Optimizer — R-18: Dead Code 检测
// ============================================================

import { BaseAnalyzer } from './base.js';
import type { BiuOptConfig } from '../config/types.js';
import type { AnalysisResult } from '../types/analysis.js';
import { AnalysisCategory, Severity } from '../types/analysis.js';
import { debug, warn } from '../utils/logger.js';
import { exec } from '../utils/exec.js';
import fastGlob from 'fast-glob';
import { readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';

/**
 * 导出符号信息
 */
interface ExportedSymbol {
  name: string;
  file: string;
  line: number;
  type: 'class' | 'function' | 'const' | 'interface' | 'type' | 'enum';
}

/**
 * DeadCodeAnalyzer — Dead Code 检测
 *
 * 尝试 ts-prune CLI，失败则手动扫描
 * 手动方案：解析所有 export → 全文搜索引用 → 未引用标记
 */
export class DeadCodeAnalyzer extends BaseAnalyzer {
  readonly id = 'dead-code';
  readonly category = AnalysisCategory['code-quality'];

  protected async run(config: BiuOptConfig): Promise<AnalysisResult[]> {
    const rootDir = resolve(config.rootDir);

    // 尝试 ts-prune
    const tsPruneResults = await this.tryTsPrune(rootDir);
    if (tsPruneResults !== null) {
      return tsPruneResults;
    }

    // 手动扫描
    debug('[dead-code] ts-prune 不可用，使用手动扫描');
    return this.manualScan(rootDir, config.workspaces);
  }

  // ---- ts-prune ----

  private async tryTsPrune(rootDir: string): Promise<AnalysisResult[] | null> {
    try {
      const result = await exec(
        'npx',
        ['ts-prune', '--error', '--skip'],
        { cwd: rootDir, timeout: 60_000 },
      );

      if (!result.stdout && !result.stderr) return null;

      const output = result.stdout || result.stderr || '';
      const lines = output.split('\n').filter(Boolean);

      const results: AnalysisResult[] = [];
      let counter = 0;

      for (const line of lines) {
        // ts-prune format: file.ts:line - name
        const match = line.match(/^(.+?):(\d+)\s*-\s*(.+)$/);
        if (!match) continue;

        const [, file, lineStr, name] = match;

        results.push({
          id: `dc-${String(counter++).padStart(4, '0')}`,
          analyzerId: this.id,
          category: this.category,
          severity: Severity.moderate,
          file: file!.trim(),
          line: parseInt(lineStr!, 10),
          message: `未使用的导出: ${name!.trim()}`,
          suggestion: '移除未使用的导出或在导出前添加 // @ts-expect-keep 注释',
          rule: 'no-dead-code',
          metadata: { symbolName: name!.trim() },
        });
      }

      return results;
    } catch {
      return null;
    }
  }

  // ---- 手动扫描 ----

  private async manualScan(
    rootDir: string,
    workspaces: string[],
  ): Promise<AnalysisResult[]> {
    const files = await this.scanTsFiles(rootDir, workspaces);
    if (files.length === 0) return [];

    // 收集所有导出
    const allExports: ExportedSymbol[] = [];
    const allContents: Map<string, string> = new Map();

    for (const filePath of files) {
      try {
        const content = await readFile(filePath, 'utf-8');
        allContents.set(filePath, content);

        // 解析导出
        const exports_ = this.extractExports(content, filePath);
        allExports.push(...exports_);
      } catch {
        // skip
      }
    }

    // 排除 barrel exports (index.ts)
    const nonBarrelExports = allExports.filter(
      (e) => !relative(rootDir, e.file).includes('/index.'),
    );

    // 在全文件中搜索每个导出的引用
    const results: AnalysisResult[] = [];
    let counter = 0;

    for (const exp of nonBarrelExports) {
      if (exp.name === 'default') continue;

      // 在除自身外的所有文件中搜索引用
      let found = false;
      for (const [filePath, content] of allContents) {
        if (filePath === exp.file) continue;

        // 搜索符号引用（排除 import 自身）
        const importPattern = new RegExp(
          `import\\s+.*\\b${exp.name}\\b`,
          'm',
        );
        const usagePattern = new RegExp(
          `\\b${exp.name}\\b`,
          'g',
        );

        if (importPattern.test(content)) {
          found = true;
          break;
        }

        // 检查非 import 行中的使用
        const lines = content.split('\n');
        for (const line of lines) {
          if (line.trim().startsWith('import')) continue;
          if (usagePattern.test(line)) {
            found = true;
            break;
          }
        }

        if (found) break;
      }

      if (!found) {
        results.push({
          id: `dc-${String(counter++).padStart(4, '0')}`,
          analyzerId: this.id,
          category: this.category,
          severity: Severity.moderate,
          file: relative(rootDir, exp.file),
          line: exp.line,
          message: `可能未使用的导出: ${exp.type} ${exp.name}`,
          suggestion:
            '检查此导出是否确实未被使用，考虑移除或标记为公开 API',
          rule: 'no-dead-code',
          metadata: {
            symbolName: exp.name,
            symbolType: exp.type,
          },
        });
      }
    }

    debug(`[dead-code] 手动扫描发现 ${results.length} 个可能未使用导出`);
    return results;
  }

  private async scanTsFiles(
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

  private extractExports(
    content: string,
    filePath: string,
  ): ExportedSymbol[] {
    const lines = content.split('\n');
    const results: ExportedSymbol[] = [];

    const patterns: Array<{
      regex: RegExp;
      type: ExportedSymbol['type'];
    }> = [
      { regex: /export\s+class\s+(\w+)/g, type: 'class' },
      {
        regex: /export\s+(?:async\s+)?function\s+(\w+)/g,
        type: 'function',
      },
      {
        regex: /export\s+const\s+(\w+)/g,
        type: 'const',
      },
      {
        regex: /export\s+(?:interface|type)\s+(\w+)/g,
        type: 'interface',
      },
      { regex: /export\s+enum\s+(\w+)/g, type: 'enum' },
    ];

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum]!;

      for (const { regex, type } of patterns) {
        regex.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = regex.exec(line)) !== null) {
          results.push({
            name: match[1]!,
            file: filePath,
            line: lineNum + 1,
            type,
          });
        }
      }
    }

    return results;
  }
}
