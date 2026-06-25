// ============================================================
// Biu Auto-Optimizer — R-19: Monorepo 跨包依赖可视化
// ============================================================

import { BaseAnalyzer } from './base.js';
import type { BiuOptConfig } from '../config/types.js';
import type { AnalysisResult } from '../types/analysis.js';
import { AnalysisCategory, Severity } from '../types/analysis.js';
import { debug, warn } from '../utils/logger.js';
import { readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';

/**
 * 包信息
 */
interface PackageInfo {
  name: string;
  path: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

/**
 * 依赖边
 */
interface DepEdge {
  from: string;
  to: string;
  version: string;
  isDev: boolean;
}

/**
 * MonorepoDepsAnalyzer — Monorepo 跨包依赖可视化
 *
 * 扫描 shared/server/client 的 package.json
 * 构建依赖矩阵 + 检测违规 + 输出 Mermaid 图
 */
export class MonorepoDepsAnalyzer extends BaseAnalyzer {
  readonly id = 'monorepo-deps';
  readonly category = AnalysisCategory.dependencies;

  protected async run(config: BiuOptConfig): Promise<AnalysisResult[]> {
    const rootDir = resolve(config.rootDir);
    const workspaces = config.workspaces;

    if (workspaces.length < 2) {
      return [
        {
          id: 'md-single-ws',
          analyzerId: this.id,
          category: this.category,
          severity: Severity.info,
          message: 'Monorepo 工作区少于 2 个，跳过跨包依赖分析',
        },
      ];
    }

    // 1. 读取各包的 package.json
    const packages = await this.readPackages(rootDir, workspaces);
    if (packages.length === 0) return [];

    // 2. 构建依赖矩阵
    const edges = this.buildDependencyEdges(packages);

    // 3. 检测违规
    const results: AnalysisResult[] = [];
    let counter = 0;

    // 循环依赖检测
    const cycles = this.detectCycles(edges, packages);
    for (const cycle of cycles) {
      results.push({
        id: `md-${String(counter++).padStart(4, '0')}`,
        analyzerId: this.id,
        category: this.category,
        severity: Severity.high,
        message: `循环依赖: ${cycle.join(' → ')}`,
        suggestion: '重新设计包结构以消除循环依赖',
        rule: 'no-circular-deps',
        metadata: { cycle },
      });
    }

    // 违规检测：client 依赖 server 内部
    const clientPkg = packages.find(
      (p) => p.name === 'client' || p.path.includes('client'),
    );
    const serverPkg = packages.find(
      (p) => p.name === 'server' || p.path.includes('server'),
    );

    if (clientPkg && serverPkg) {
      const clientDeps = {
        ...clientPkg.dependencies,
        ...clientPkg.devDependencies,
      };

      if (
        clientDeps[serverPkg.name] ||
        Object.keys(clientDeps).some((d) =>
          d.startsWith(`${serverPkg.name}/`),
        )
      ) {
        results.push({
          id: `md-${String(counter++).padStart(4, '0')}`,
          analyzerId: this.id,
          category: this.category,
          severity: Severity.moderate,
          message: 'client 包直接依赖 server 包',
          suggestion:
            '考虑提取共享类型到 shared 包，避免 client 直接依赖 server',
          rule: 'no-client-server-deps',
          metadata: { client: clientPkg.name, server: serverPkg.name },
        });
      }
    }

    // 4. 生成 Mermaid 依赖图
    const mermaid = this.generateMermaid(packages, edges);
    results.push({
      id: `md-mermaid`,
      analyzerId: this.id,
      category: this.category,
      severity: Severity.info,
      message: `Monorepo 依赖图 (${packages.length} 个包, ${edges.length} 条依赖边)`,
      metadata: {
        packages: packages.map((p) => p.name),
        edges: edges.map((e) => ({
          from: e.from,
          to: e.to,
          dev: e.isDev,
        })),
        mermaidDiagram: mermaid,
      },
    });

    return results;
  }

  // ---- 包读取 ----

  private async readPackages(
    rootDir: string,
    workspaces: string[],
  ): Promise<PackageInfo[]> {
    const packages: PackageInfo[] = [];

    for (const ws of workspaces) {
      try {
        const pkgPath = resolve(rootDir, ws, 'package.json');
        const content = await readFile(pkgPath, 'utf-8');
        const pkg = JSON.parse(content) as {
          name?: string;
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        };

        packages.push({
          name: pkg.name ?? ws,
          path: ws,
          dependencies: pkg.dependencies ?? {},
          devDependencies: pkg.devDependencies ?? {},
        });
      } catch {
        debug(`[monorepo-deps] 跳过 ${ws}: 无 package.json`);
      }
    }

    return packages;
  }

  // ---- 依赖矩阵 ----

  private buildDependencyEdges(packages: PackageInfo[]): DepEdge[] {
    const edges: DepEdge[] = [];
    const pkgNames = new Set(packages.map((p) => p.name));

    for (const pkg of packages) {
      const allDeps: Array<[string, string, boolean]> = [
        ...Object.entries(pkg.dependencies).map(
          ([name, ver]) => [name, ver, false] as [string, string, boolean],
        ),
        ...Object.entries(pkg.devDependencies).map(
          ([name, ver]) => [name, ver, true] as [string, string, boolean],
        ),
      ];

      for (const [depName, version, isDev] of allDeps) {
        // 仅统计 monorepo 内部依赖
        if (pkgNames.has(depName)) {
          edges.push({ from: pkg.name, to: depName, version, isDev });
        }
      }
    }

    return edges;
  }

  // ---- 循环依赖检测 ----

  private detectCycles(
    edges: DepEdge[],
    packages: PackageInfo[],
  ): string[][] {
    const adj = new Map<string, string[]>();
    for (const pkg of packages) {
      adj.set(pkg.name, []);
    }
    for (const e of edges) {
      adj.get(e.from)?.push(e.to);
    }

    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    function dfs(node: string, path: string[]): void {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      for (const neighbor of adj.get(node) ?? []) {
        if (!visited.has(neighbor)) {
          dfs(neighbor, [...path]);
        } else if (recursionStack.has(neighbor)) {
          const cycleStart = path.indexOf(neighbor);
          if (cycleStart >= 0) {
            cycles.push([
              ...path.slice(cycleStart),
              neighbor,
            ]);
          }
        }
      }

      recursionStack.delete(node);
    }

    for (const pkg of packages) {
      if (!visited.has(pkg.name)) {
        dfs(pkg.name, []);
      }
    }

    return cycles;
  }

  // ---- Mermaid 生成 ----

  private generateMermaid(
    packages: PackageInfo[],
    edges: DepEdge[],
  ): string {
    const lines: string[] = ['graph TD'];

    for (const pkg of packages) {
      lines.push(`  ${this.sanitizeId(pkg.name)}[${pkg.name}]`);
    }

    for (const e of edges) {
      const style = e.isDev ? 'dotted' : 'solid';
      lines.push(
        `  ${this.sanitizeId(e.from)} -.- ${this.sanitizeId(e.to)}`,
      );
    }

    return lines.join('\n');
  }

  private sanitizeId(name: string): string {
    return name.replace(/[^a-zA-Z0-9]/g, '_');
  }
}
