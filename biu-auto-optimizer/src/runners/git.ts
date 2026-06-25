// ============================================================
// Biu Auto-Optimizer — Git 操作封装
// ============================================================

import { simpleGit, type SimpleGit } from 'simple-git';
import type { MetricSnapshot } from '../types/snapshot.js';
import { debug } from '../utils/logger.js';
import { getCurrentHash, getCurrentBranch } from '../utils/git.js';

/**
 * GitRunner — Git 操作封装
 *
 * 基于 simple-git，支持自定义 cwd
 */
export class GitRunner {
  private readonly git: SimpleGit;
  private readonly cwd: string;

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
    this.git = simpleGit({ baseDir: cwd });
  }

  /**
   * 基于当前 HEAD 创建分支
   * @param name - 分支名
   */
  async createBranch(name: string): Promise<void> {
    debug(`[git] 创建分支: ${name}`);
    await this.git.checkoutLocalBranch(name);
  }

  /**
   * 提交所有变更
   * @param message - 提交信息
   * @returns commit hash
   */
  async commit(message: string): Promise<string> {
    debug(`[git] 提交: ${message}`);
    await this.git.add('.');
    const result = await this.git.commit(message);
    return result.commit ?? '';
  }

  /**
   * 创建 Git tag
   * @param name - tag 名称
   */
  async createTag(name: string): Promise<void> {
    debug(`[git] 创建 tag: ${name}`);
    await this.git.addTag(name);
  }

  /**
   * 硬回滚到指定 ref
   * @param ref - Git ref (commit hash, branch, tag)
   */
  async resetHard(ref: string): Promise<void> {
    debug(`[git] 硬回滚到: ${ref}`);
    await this.git.reset(['--hard', ref]);
  }

  /**
   * 获取当前 HEAD hash
   */
  async getCurrentHash(): Promise<string> {
    return getCurrentHash(this.cwd);
  }

  /**
   * 获取当前分支名
   */
  async getCurrentBranch(): Promise<string> {
    return getCurrentBranch(this.cwd);
  }

  /**
   * Push 到 origin
   * @param branch - 分支名
   */
  async push(branch: string): Promise<void> {
    debug(`[git] push origin/${branch}`);
    await this.git.push('origin', branch);
  }

  /**
   * 删除本地分支
   * @param name - 分支名
   */
  async deleteBranch(name: string): Promise<void> {
    debug(`[git] 删除分支: ${name}`);
    await this.git.deleteLocalBranch(name);
  }

  /**
   * 切换到指定分支
   * @param name - 分支名
   */
  async checkout(name: string): Promise<void> {
    debug(`[git] 切换分支: ${name}`);
    await this.git.checkout(name);
  }

  /**
   * 获取 git log
   * @param options - simple-git log 选项
   */
  async log(options?: { from?: string; to?: string; maxCount?: number }): Promise<Array<{
    hash: string;
    date: string;
    message: string;
    author_name: string;
    author_email: string;
  }>> {
    const logOptions: Record<string, unknown> = {};
    if (options?.maxCount) logOptions.maxCount = options.maxCount;

    const range = options?.from && options?.to
      ? `${options.from}..${options.to}`
      : options?.from || undefined;

    const logResult = await this.git.log({ ...logOptions, from: range } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return logResult.all as any;
  }

  /**
   * 获取所有 tags
   */
  async getTags(): Promise<string[]> {
    const tags = await this.git.tags();
    return tags.all;
  }
}
