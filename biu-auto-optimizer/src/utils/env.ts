// ============================================================
// Biu Auto-Optimizer — 环境变量解析工具
// ============================================================

import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';

/**
 * 解析 .env 文件内容为键值对
 * 忽略空行和注释行（以 # 开头）
 */
function parseEnvContent(content: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();

    // 跳过空行和注释
    if (trimmed === '' || trimmed.startsWith('#')) {
      continue;
    }

    // 跳过没有等号的行
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    // 移除引号包裹
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key) {
      result[key] = value;
    }
  }

  return result;
}

/**
 * 从指定目录加载 .env 或 .env.local 文件的环境变量
 * @param workspacePath - 工作区目录路径
 * @returns 环境变量键值对
 */
async function loadEnvFromDir(workspacePath: string): Promise<Record<string, string>> {
  const envFiles = ['.env', '.env.local'];
  const result: Record<string, string> = {};

  for (const filename of envFiles) {
    const filePath = resolve(workspacePath, filename);
    try {
      await access(filePath);
      const content = await readFile(filePath, 'utf-8');
      const vars = parseEnvContent(content);
      Object.assign(result, vars);
    } catch {
      // 文件不存在，跳过
    }
  }

  return result;
}

/**
 * 扫描各 workspace 的 .env 变量
 * @param workspaces - 工作区名称列表（如 ['shared', 'server', 'client']）
 * @param rootDir - 项目根目录，默认为 process.cwd()
 * @returns 合并后的环境变量键值对
 */
export async function loadEnvFiles(
  workspaces: string[],
  rootDir: string = process.cwd(),
): Promise<Record<string, string>> {
  const allVars: Record<string, string> = {};

  // 先加载根目录
  const rootVars = await loadEnvFromDir(rootDir);
  Object.assign(allVars, rootVars);

  // 再加载各 workspace（后加载的覆盖先加载的）
  for (const ws of workspaces) {
    const wsPath = resolve(rootDir, ws);
    const wsVars = await loadEnvFromDir(wsPath);
    Object.assign(allVars, wsVars);
  }

  return allVars;
}
