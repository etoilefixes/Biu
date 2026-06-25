// ============================================================
// Biu Auto-Optimizer — Git 工具函数
// ============================================================

import { simpleGit, type SimpleGit } from 'simple-git';

/**
 * 获取 SimpleGit 实例
 * 默认使用 process.cwd() 作为工作目录
 */
function getGit(cwd?: string): SimpleGit {
  return simpleGit({ baseDir: cwd ?? process.cwd() });
}

/**
 * 获取当前 HEAD 的完整 hash（前 7 位短 hash）
 * @param cwd - Git 仓库路径，默认为 process.cwd()
 * @returns 7 位短 commit hash
 * @throws {Error} 如果不在 Git 仓库中
 */
export async function getCurrentHash(cwd?: string): Promise<string> {
  try {
    const git = getGit(cwd);
    const log = await git.log({ maxCount: 1 });
    if (!log.latest) {
      throw new Error('无法获取当前 commit');
    }
    return log.latest.hash.slice(0, 7);
  } catch (err: unknown) {
    if (err instanceof Error) {
      throw new Error(`Git 获取当前 hash 失败: ${err.message}`);
    }
    throw err;
  }
}

/**
 * 获取当前分支名
 * @param cwd - Git 仓库路径，默认为 process.cwd()
 * @returns 当前分支名（如 'main', 'feature/xxx'）
 * @throws {Error} 如果不在 Git 仓库中或处于 detached HEAD
 */
export async function getCurrentBranch(cwd?: string): Promise<string> {
  try {
    const git = getGit(cwd);
    const branch = await git.revparse(['--abbrev-ref', 'HEAD']);
    return branch.trim();
  } catch (err: unknown) {
    if (err instanceof Error) {
      throw new Error(`Git 获取当前分支失败: ${err.message}`);
    }
    throw err;
  }
}

/**
 * 检查工作区是否有未提交的变更（包括 unstaged 和 staged）
 * @param cwd - Git 仓库路径，默认为 process.cwd()
 * @returns true 表示有未提交变更
 */
export async function hasChanges(cwd?: string): Promise<boolean> {
  try {
    const git = getGit(cwd);
    const status = await git.status();
    return !status.isClean();
  } catch (err: unknown) {
    if (err instanceof Error) {
      throw new Error(`Git 检查变更失败: ${err.message}`);
    }
    throw err;
  }
}

/**
 * 获取最近的 Git tag
 * @param cwd - Git 仓库路径，默认为 process.cwd()
 * @returns 最近 tag 名称，如果没有则返回 null
 */
export async function getLastTag(cwd?: string): Promise<string | null> {
  try {
    const git = getGit(cwd);
    const tags = await git.tags();
    if (tags.all.length === 0) {
      return null;
    }
    // simple-git 按时间排序返回，取最后一个
    return tags.latest ?? tags.all[tags.all.length - 1] ?? null;
  } catch {
    return null;
  }
}
