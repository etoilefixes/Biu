// ============================================================
// Biu Auto-Optimizer — execa 进程调用包装
// ============================================================

import { execa, type Options as ExecaOptions } from 'execa';

/** 执行结果 */
export interface ExecResult {
  /** 标准输出（已 trim） */
  stdout: string;
  /** 标准错误输出（已 trim） */
  stderr: string;
  /** 退出码 */
  exitCode: number;
}

const DEFAULT_TIMEOUT_MS = 60_000; // 默认 60 秒超时

/**
 * 执行外部命令
 *
 * @param command - 要执行的命令
 * @param args - 命令参数数组
 * @param options - execa 选项（可覆盖默认超时等）
 * @returns 执行结果，包含 stdout、stderr、exitCode
 * @throws {Error} 命令执行超时或进程被信号终止
 */
export async function exec(
  command: string,
  args: string[] = [],
  options?: ExecaOptions,
): Promise<ExecResult> {
  const mergedOptions: ExecaOptions = {
    timeout: DEFAULT_TIMEOUT_MS,
    reject: false, // 非零退出码不抛异常，由调用方处理
    ...options,
  };

  try {
    const result = await execa(command, args, mergedOptions);

    return {
      stdout: (typeof result.stdout === 'string' ? result.stdout : String(result.stdout ?? '')).trim(),
      stderr: (typeof result.stderr === 'string' ? result.stderr : String(result.stderr ?? '')).trim(),
      exitCode: result.exitCode ?? 0,
    };
  } catch (err: unknown) {
    // execa 在超时、kill signal 等情况下仍可能抛出
    if (err instanceof Error) {
      const errorMsg = err.message;

      if (errorMsg.includes('timed out') || (err as { code?: string }).code === 'ETIMEDOUT') {
        throw new Error(`命令执行超时 (${command} ${args.join(' ')}): ${DEFAULT_TIMEOUT_MS}ms`);
      }

      throw new Error(`命令执行失败 (${command} ${args.join(' ')}): ${errorMsg}`);
    }
    throw err;
  }
}
