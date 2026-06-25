// ============================================================
// Biu Auto-Optimizer — Changelog 类型定义
// ============================================================

/**
 * 单条 Changelog 条目
 * 基于 Conventional Commits 规范解析
 */
export interface ChangelogEntry {
  /** Git commit hash */
  hash: string;
  /** 提交类型（feat, fix, chore, docs, style, refactor, perf, test, build, ci, revert） */
  type: string;
  /** 影响范围（可选） */
  scope?: string;
  /** 变更描述 */
  description: string;
  /** 作者 */
  author: string;
  /** 提交日期（ISO 8601） */
  date: string;
  /** 是否为 BREAKING CHANGE */
  breaking: boolean;
}

/**
 * 按类别分组的 Changelog 条目
 */
export interface GroupedEntries {
  /** BREAKING CHANGE 条目 */
  breaking: ChangelogEntry[];
  /** 新功能（feat） */
  features: ChangelogEntry[];
  /** Bug 修复（fix） */
  fixes: ChangelogEntry[];
  /** 安全相关修复 */
  security: ChangelogEntry[];
  /** 杂项（chore, build, ci, docs, style, refactor, test） */
  chores: ChangelogEntry[];
  /** 其他未分类条目 */
  other: ChangelogEntry[];
}

/**
 * Changelog 报告
 * 版本范围的完整变更记录
 */
export interface ChangelogReport {
  /** 版本号 */
  version: string;
  /** 报告生成日期（ISO 8601） */
  date: string;
  /** 所有 Changelog 条目 */
  entries: ChangelogEntry[];
  /** 按类别分组 */
  grouped: GroupedEntries;
}
