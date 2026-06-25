// ============================================================
// Biu Auto-Optimizer — 文件系统工具
// ============================================================

import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * 递归创建目录（类似 mkdir -p）
 * @param dirPath - 目标目录路径
 */
export async function safeMkdir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

/**
 * 确保目录存在，如不存在则创建
 * @param dirPath - 目标目录路径
 */
export async function ensureDir(dirPath: string): Promise<void> {
  try {
    await access(dirPath);
  } catch {
    await mkdir(dirPath, { recursive: true });
  }
}

/**
 * 安全读取 JSON 文件
 * @param filePath - JSON 文件路径
 * @returns 解析后的 JSON 对象
 * @throws {Error} 文件不存在或 JSON 解析失败
 */
export async function readJSON<T = unknown>(filePath: string): Promise<T> {
  try {
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch (err: unknown) {
    if (err instanceof SyntaxError) {
      throw new Error(`JSON 解析失败 (${filePath}): ${err.message}`);
    }
    if (err instanceof Error && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`文件不存在: ${filePath}`);
    }
    throw err;
  }
}

/**
 * 安全写入 JSON 文件（自动创建父目录）
 * @param filePath - JSON 文件路径
 * @param data - 要写入的数据
 * @param pretty - 是否格式化输出（默认 true）
 */
export async function writeJSON(
  filePath: string,
  data: unknown,
  pretty: boolean = true,
): Promise<void> {
  const dir = dirname(filePath);
  await safeMkdir(dir);

  const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  await writeFile(filePath, content, 'utf-8');
}
