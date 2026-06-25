// ============================================================
// Biu Auto-Optimizer — 结构化日志工具
// ============================================================

/**
 * 格式化时间戳为 [HH:mm:ss] 格式
 */
function timestamp(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `[${hh}:${mm}:${ss}]`;
}

/**
 * 日志级别
 */
type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

/**
 * 内部格式化输出
 */
function log(level: LogLevel, message: string): void {
  const line = `${timestamp()} [${level}] ${message}`;
  switch (level) {
    case 'ERROR':
      process.stderr.write(line + '\n');
      break;
    case 'WARN':
      process.stderr.write(line + '\n');
      break;
    default:
      process.stdout.write(line + '\n');
  }
}

/**
 * 检查是否开启详细模式
 */
function isVerbose(): boolean {
  return (
    process.env.BIU_OPT_VERBOSE === '1' ||
    process.env.BIU_OPT_VERBOSE === 'true' ||
    process.env.BIU_OPT_DEBUG === '1' ||
    process.env.BIU_OPT_DEBUG === 'true'
  );
}

/** 信息日志 — 关键步骤 */
export function info(message: string): void {
  log('INFO', message);
}

/** 警告日志 — 需要注意但非阻塞 */
export function warn(message: string): void {
  log('WARN', message);
}

/** 错误日志 — 操作失败 */
export function error(message: string): void {
  log('ERROR', message);
}

/** 调试日志 — 仅在 BIU_OPT_VERBOSE 或 BIU_OPT_DEBUG 时输出 */
export function debug(message: string): void {
  if (isVerbose()) {
    log('DEBUG', message);
  }
}
