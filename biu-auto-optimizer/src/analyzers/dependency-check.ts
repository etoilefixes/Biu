// ============================================================
// Biu Auto-Optimizer — R-03: npm outdated + changelog 分析
// ============================================================

import { BaseAnalyzer } from './base.js';
import type { BiuOptConfig } from '../config/types.js';
import type { AnalysisResult } from '../types/analysis.js';
import { AnalysisCategory, Severity } from '../types/analysis.js';
import { exec } from '../utils/exec.js';
import { debug, warn } from '../utils/logger.js';
import { fetchChangelog } from '../utils/changelog-fetcher.js';
import { resolve } from 'node:path';

/**
 * npm outdated --json 输出结构
 * key 是包名，value 是版本信息
 */
interface NpmOutdatedEntry {
  current: string;
  wanted: string;
  latest: string;
  dependent: string;
  location: string;
  type: string; // 'dependencies' | 'devDependencies'
}

type NpmOutdatedOutput = Record<string, NpmOutdatedEntry>;

/**
 * DependencyCheckAnalyzer
 *
 * 检查 outdated 依赖并分析 changelog 风险
 * 仅扫描 production dependencies（排除 devDependencies）
 */
export class DependencyCheckAnalyzer extends BaseAnalyzer {
  readonly id = 'dependency-check';
  readonly category = AnalysisCategory.dependencies;

  protected async run(config: BiuOptConfig): Promise<AnalysisResult[]> {
    const rootDir = resolve(config.rootDir);
    const outdatedDeps = await this.getOutdatedDependencies(rootDir);

    if (outdatedDeps.length === 0) {
      debug('[dependency-check] 无过期依赖');
      return [];
    }

    // 逐个分析 changelog（串行以避免 API 限流）
    const results: AnalysisResult[] = [];
    for (let i = 0; i < outdatedDeps.length; i++) {
      const dep = outdatedDeps[i];
      const result = await this.analyzeDependency(dep, i);
      results.push(result);
    }

    return results;
  }

  // ---- 获取过期依赖 ----

  private async getOutdatedDependencies(rootDir: string): Promise<NpmOutdatedEntry[]> {
    try {
      const result = await exec('npm', ['outdated', '--json'], {
        cwd: rootDir,
        timeout: 60_000,
      });

      if (!result.stdout) {
        return [];
      }

      const outdated = JSON.parse(result.stdout) as NpmOutdatedOutput;
      if (!outdated || typeof outdated !== 'object') {
        return [];
      }

      // 仅保留 production dependencies
      return Object.values(outdated).filter(
        (dep) => dep.type === 'dependencies',
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      warn(`[dependency-check] npm outdated 执行失败: ${msg}`);
      return [];
    }
  }

  // ---- 分析单个依赖 ----

  private async analyzeDependency(
    dep: NpmOutdatedEntry,
    index: number,
  ): Promise<AnalysisResult> {
    const packageName = dep.dependent;
    const currentVersion = dep.current;
    const wantedVersion = dep.wanted;
    const latestVersion = dep.latest;

    let changelogNotes = '';
    let isBreaking = false;

    // 检查 wanted 版本 (minor/patch) 和 latest 版本 (major)
    try {
      if (currentVersion !== latestVersion) {
        const result = await fetchChangelog(packageName, currentVersion, latestVersion);
        changelogNotes = result.notes;
        isBreaking = result.breaking;
      } else if (currentVersion !== wantedVersion) {
        const result = await fetchChangelog(packageName, currentVersion, wantedVersion);
        changelogNotes = result.notes;
        isBreaking = result.breaking;
      }
    } catch {
      warn(`[dependency-check] 无法获取 ${packageName} 的 changelog`);
    }

    // 判断严重程度
    const severity = this.determineSeverity(dep, isBreaking, changelogNotes);

    // 构建建议
    const suggestion = this.buildSuggestion(dep, isBreaking, changelogNotes);

    return {
      id: `dep-${String(index).padStart(4, '0')}`,
      analyzerId: this.id,
      category: this.category,
      severity,
      message: `${packageName}: ${currentVersion} → ${latestVersion}${isBreaking ? ' (BREAKING)' : ''}`,
      suggestion,
      metadata: {
        package: packageName,
        current: currentVersion,
        wanted: wantedVersion,
        latest: latestVersion,
        breaking: isBreaking,
        changelog: changelogNotes,
        dependencyType: dep.type,
        location: dep.location,
      },
    };
  }

  // ---- 严重程度判断 ----

  private determineSeverity(
    dep: NpmOutdatedEntry,
    isBreaking: boolean,
    changelogNotes: string,
  ): Severity {
    if (isBreaking) {
      // BREAKING CHANGE 且涉及安全
      if (
        changelogNotes.toLowerCase().includes('security') ||
        changelogNotes.toLowerCase().includes('vulnerability') ||
        changelogNotes.toLowerCase().includes('cve')
      ) {
        return Severity.critical;
      }
      return Severity.high;
    }

    // 非 breaking 但涉及安全
    if (
      changelogNotes.toLowerCase().includes('security') ||
      changelogNotes.toLowerCase().includes('vulnerability') ||
      changelogNotes.toLowerCase().includes('cve')
    ) {
      return Severity.high;
    }

    // 主版本落后
    const currentMajor = parseInt(dep.current.split('.')[0] ?? '0', 10);
    const latestMajor = parseInt(dep.latest.split('.')[0] ?? '0', 10);
    if (currentMajor < latestMajor - 1) {
      return Severity.moderate;
    }

    return Severity.low;
  }

  // ---- 建议生成 ----

  private buildSuggestion(
    dep: NpmOutdatedEntry,
    isBreaking: boolean,
    changelogNotes: string,
  ): string {
    const pkg = dep.dependent;
    const latest = dep.latest;
    const wanted = dep.wanted;

    if (isBreaking) {
      if (latest !== wanted && wanted !== dep.current) {
        return `建议先升级到 ${wanted}（非 breaking），阅读 changelog 后再升级到 ${latest}`;
      }
      return `BREAKING CHANGE: 请仔细阅读 ${pkg}@${latest} 的 changelog，评估影响后手动升级`;
    }

    if (latest !== wanted) {
      return `建议执行 \`npm install ${pkg}@${wanted}\` 获取兼容更新，${latest} 为最新版本`;
    }

    return `建议执行 \`npm install ${pkg}@${latest}\` 更新`;
  }
}
