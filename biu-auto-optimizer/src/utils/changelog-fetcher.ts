// ============================================================
// Biu Auto-Optimizer — Changelog 抓取器
// ============================================================

import * as semver from 'semver';

/** Changelog 抓取结果 */
export interface ChangelogFetchResult {
  /** 是否包含 BREAKING CHANGE */
  breaking: boolean;
  /** 变更说明文本 */
  notes: string;
}

/**
 * 从 npm registry 获取包信息
 * @param packageName - npm 包名
 * @returns 包元数据
 */
async function fetchFromNpm(packageName: string): Promise<Record<string, unknown> | null> {
  try {
    const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * 从 GitHub releases 获取版本间变更
 * @param repo - GitHub 仓库（格式: owner/repo）
 * @param currentVersion - 当前版本
 * @param targetVersion - 目标版本
 * @returns 变更说明
 */
async function fetchFromGitHub(
  repo: string,
  currentVersion: string,
  targetVersion: string,
): Promise<string | null> {
  try {
    const url = `https://api.github.com/repos/${repo}/releases`;
    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'biu-auto-optimizer',
      },
    });

    if (!response.ok) {
      return null;
    }

    const releases = (await response.json()) as Array<{
      tag_name: string;
      body: string;
      prerelease: boolean;
    }>;

    if (!Array.isArray(releases)) {
      return null;
    }

    // 筛选 currentVersion < release <= targetVersion 的 release
    const relevantNotes: string[] = [];
    for (const release of releases) {
      if (release.prerelease) continue;

      const releaseVersion = release.tag_name.replace(/^v/, '');

      if (
        semver.gt(releaseVersion, currentVersion) &&
        semver.lte(releaseVersion, targetVersion)
      ) {
        relevantNotes.push(`## ${release.tag_name}\n\n${release.body}`);
      }
    }

    return relevantNotes.length > 0 ? relevantNotes.join('\n\n---\n\n') : null;
  } catch {
    return null;
  }
}

/**
 * 检测版本升级是否为 BREAKING CHANGE
 * 规则：主版本号变化（major bump）视为 breaking
 */
function isBreakingChange(currentVersion: string, targetVersion: string): boolean {
  const current = semver.parse(currentVersion);
  const target = semver.parse(targetVersion);

  if (!current || !target) {
    return false;
  }

  return target.major > current.major;
}

/**
 * 从 npm registry 提取仓库信息
 */
function extractRepoFromNpm(data: Record<string, unknown>): string | null {
  try {
    // 优先从 repository 字段提取
    const repo = data.repository as
      | { url?: string; type?: string }
      | string
      | undefined;

    if (typeof repo === 'string') {
      const match = repo.match(/github\.com[/:]([\w.-]+\/[\w.-]+)(?:\.git)?$/i);
      return match ? match[1] : null;
    }

    if (repo && typeof repo === 'object' && repo.url) {
      const match = repo.url.match(/github\.com[/:]([\w.-]+\/[\w.-]+)(?:\.git)?$/i);
      return match ? match[1] : null;
    }
  } catch {
    // 忽略提取失败
  }

  return null;
}

/**
 * 抓取包的 Changelog 信息
 *
 * 策略：
 * 1. 从 npm registry 获取包元数据
 * 2. 检测版本间是否为 BREAKING CHANGE
 * 3. 尝试从 GitHub releases 获取详细变更说明
 *
 * @param packageName - npm 包名
 * @param currentVersion - 当前安装版本
 * @param targetVersion - 可升级到的目标版本
 * @returns 包含 breaking 标志和变更说明的结果
 */
export async function fetchChangelog(
  packageName: string,
  currentVersion: string,
  targetVersion: string,
): Promise<ChangelogFetchResult> {
  const breaking = isBreakingChange(currentVersion, targetVersion);
  const notesParts: string[] = [];

  // 从 npm registry 获取基本信息
  const npmData = await fetchFromNpm(packageName);
  let repo: string | null = null;

  if (npmData) {
    repo = extractRepoFromNpm(npmData);

    // 尝试获取该版本的详细信息
    const versions = npmData.versions as Record<string, { description?: string }> | undefined;
    if (versions && versions[targetVersion]) {
      const targetInfo = versions[targetVersion];
      if (targetInfo.description) {
        notesParts.push(targetInfo.description);
      }
    }
  }

  // 从 GitHub releases 获取变更
  if (repo) {
    const githubNotes = await fetchFromGitHub(repo, currentVersion, targetVersion);
    if (githubNotes) {
      notesParts.push(githubNotes);
    }
  }

  if (breaking) {
    notesParts.unshift('⚠️ **BREAKING CHANGE** — 主版本号变更，可能包含不兼容的 API 修改。');
  }

  const notes = notesParts.length > 0
    ? notesParts.join('\n\n')
    : `无详细变更说明 (${currentVersion} → ${targetVersion})`;

  return { breaking, notes };
}
