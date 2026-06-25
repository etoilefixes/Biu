// ============================================================
// Biu Auto-Optimizer — Changelog 生成器 (Conventional Commits)
// ============================================================

import type { ChangelogEntry, ChangelogReport, GroupedEntries } from '../types/changelog.js';
import { GitRunner } from '../runners/git.js';
import { debug, warn } from '../utils/logger.js';
import semver from 'semver';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/**
 * 生成 Changelog 报告
 *
 * 基于 git log 解析 Conventional Commits 格式
 * 支持格式：
 *   type(scope): description
 *   type: description
 *   type!: description (BREAKING CHANGE)
 *
 * 支持类型：feat, fix, docs, style, refactor, perf, test, chore, ci, build, security
 *
 * @param fromTag - 起始 tag（可选，默认最近一个 tag 或首次提交）
 * @param rootDir - Git 仓库根目录
 * @returns ChangelogReport
 */
export async function generate(
  fromTag?: string,
  rootDir: string = process.cwd(),
): Promise<ChangelogReport> {
  const git = new GitRunner(rootDir);

  // 确定起始位置
  let from: string | undefined = fromTag;
  if (!from) {
    const tags = await git.getTags();
    if (tags.length > 0) {
      from = tags[tags.length - 1]!;
      debug(`[changelog] 从最近 tag 开始: ${from}`);
    }
  }

  // 获取 git log
  const logEntries = await git.log({ from, maxCount: 500 });

  // 解析 Conventional Commits
  const entries: ChangelogEntry[] = [];

  for (const commit of logEntries) {
    const parsed = parseConventionalCommit(
      commit.hash,
      commit.message,
      commit.author_name,
      commit.date,
    );

    if (parsed) {
      entries.push(parsed);
    }
  }

  debug(`[changelog] 解析了 ${entries.length} 条 Conventional Commits`);

  // 分组
  const grouped = groupEntries(entries);

  // 确定版本号
  const version = determineVersion(from, entries);

  return {
    version,
    date: new Date().toISOString(),
    entries,
    grouped,
  };
}

/**
 * 将 Changelog 报告写入文件
 * @param report - ChangelogReport
 * @param outputPath - 输出路径
 * @param append - true = 追加到文件末尾, false = 覆盖
 */
export async function writeToFile(
  report: ChangelogReport,
  outputPath: string,
  append: boolean = false,
): Promise<void> {
  const content = renderMarkdown(report);
  const fullPath = resolve(outputPath);

  if (append) {
    const { readFile } = await import('node:fs/promises');
    let existing = '';
    try {
      existing = await readFile(fullPath, 'utf-8');
      existing = existing.replace(/\n*$/, '\n\n');
    } catch {
      // 文件不存在
    }
    await writeFile(fullPath, existing + content, 'utf-8');
  } else {
    await writeFile(fullPath, content, 'utf-8');
  }

  debug(`[changelog] 已写入: ${fullPath}`);
}

// ---- 内部函数 ----

/**
 * 解析单条 Conventional Commit
 */
function parseConventionalCommit(
  hash: string,
  message: string,
  author: string,
  date: string,
): ChangelogEntry | null {
  // Conventional Commits 模式
  // type(scope)!: description
  // type!: description
  // type: description
  // 支持 BREAKING CHANGE: footer
  const pattern =
    /^(?<type>feat|fix|docs|style|refactor|perf|test|chore|ci|build|security|revert)(?:\((?<scope>[^)]+)\))?(?<breaking>!)?:\s+(?<description>.+)$/m;

  const match = message.match(pattern);

  if (!match) return null;

  const groups = match.groups!;

  // 检查 footer 中的 BREAKING CHANGE
  const hasBreakingFooter = /BREAKING\s+CHANGE:/i.test(message);
  const breaking = !!(groups.breaking || hasBreakingFooter);

  // 提取描述（只取第一行，避免 footer 混入）
  let description = (groups.description ?? '').trim();
  // 移除可能混入的 BREAKING CHANGE footer
  const breakingIdx = description.indexOf('BREAKING CHANGE:');
  if (breakingIdx > 0) {
    description = description.slice(0, breakingIdx).trim();
  }

  return {
    hash: hash.slice(0, 7),
    type: groups.type ?? 'chore',
    scope: groups.scope || undefined,
    description,
    author,
    date,
    breaking,
  };
}

/**
 * 按类别分组
 */
function groupEntries(entries: ChangelogEntry[]): GroupedEntries {
  const grouped: GroupedEntries = {
    breaking: [],
    features: [],
    fixes: [],
    security: [],
    chores: [],
    other: [],
  };

  for (const entry of entries) {
    if (entry.breaking) {
      grouped.breaking.push(entry);
      continue;
    }

    switch (entry.type) {
      case 'feat':
        grouped.features.push(entry);
        break;
      case 'fix':
        grouped.fixes.push(entry);
        break;
      case 'security':
        grouped.security.push(entry);
        break;
      case 'chore':
      case 'build':
      case 'ci':
      case 'docs':
      case 'style':
      case 'refactor':
      case 'test':
      case 'revert':
        grouped.chores.push(entry);
        break;
      default:
        grouped.other.push(entry);
        break;
    }
  }

  return grouped;
}

/**
 * 根据变更确定版本号
 */
function determineVersion(fromTag: string | undefined, entries: ChangelogEntry[]): string {
  let baseVersion = '1.0.0';

  if (fromTag && semver.valid(fromTag)) {
    baseVersion = fromTag;
  }

  if (entries.length === 0) {
    return baseVersion;
  }

  // BREAKING CHANGE → major
  if (entries.some((e) => e.breaking)) {
    return semver.inc(baseVersion, 'major') ?? baseVersion;
  }

  // feat → minor
  if (entries.some((e) => e.type === 'feat')) {
    return semver.inc(baseVersion, 'minor') ?? baseVersion;
  }

  // others → patch
  return semver.inc(baseVersion, 'patch') ?? baseVersion;
}

/**
 * 渲染 Markdown 格式
 */
function renderMarkdown(report: ChangelogReport): string {
  const lines: string[] = [];

  lines.push(`# Changelog — ${report.version}`);
  lines.push('');
  lines.push(`> Generated: ${new Date(report.date).toLocaleDateString()}`);
  lines.push('');

  // BREAKING CHANGES
  if (report.grouped.breaking.length > 0) {
    lines.push('## ⚠️ BREAKING CHANGES');
    lines.push('');
    for (const entry of report.grouped.breaking) {
      lines.push(`- **${entry.scope ? `${entry.scope}: ` : ''}${entry.description}** (${entry.hash})`);
    }
    lines.push('');
  }

  // Features
  if (report.grouped.features.length > 0) {
    lines.push('## ✨ Features');
    lines.push('');
    for (const entry of report.grouped.features) {
      lines.push(`- ${entry.scope ? `**${entry.scope}**: ` : ''}${entry.description} (${entry.hash})`);
    }
    lines.push('');
  }

  // Bug Fixes
  if (report.grouped.fixes.length > 0) {
    lines.push('## 🐛 Bug Fixes');
    lines.push('');
    for (const entry of report.grouped.fixes) {
      lines.push(`- ${entry.scope ? `**${entry.scope}**: ` : ''}${entry.description} (${entry.hash})`);
    }
    lines.push('');
  }

  // Security
  if (report.grouped.security.length > 0) {
    lines.push('## 🔒 Security');
    lines.push('');
    for (const entry of report.grouped.security) {
      lines.push(`- ${entry.description} (${entry.hash})`);
    }
    lines.push('');
  }

  // Chores
  if (report.grouped.chores.length > 0) {
    lines.push('## 🔧 Maintenance');
    lines.push('');
    for (const entry of report.grouped.chores) {
      lines.push(`- ${entry.scope ? `**${entry.scope}**: ` : ''}${entry.description} (${entry.hash})`);
    }
    lines.push('');
  }

  // Other
  if (report.grouped.other.length > 0) {
    lines.push('## 📦 Other');
    lines.push('');
    for (const entry of report.grouped.other) {
      lines.push(`- ${entry.description} (${entry.hash})`);
    }
    lines.push('');
  }

  if (report.entries.length === 0) {
    lines.push('_No entries found._');
    lines.push('');
  }

  return lines.join('\n');
}
