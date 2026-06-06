/**
 * 时间格式化工具
 *
 * 分组时间戳：根据消息与当前时间的关系，智能选择展示格式。
 * 精确时间：悬停时展示完整的日期+时间。
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * 将消息时间格式化为分隔标签（用于消息列表中的时间分组）
 *
 * 规则：
 * - 今天：仅显示时间，如 "下午 3:42"
 * - 昨天：显示 "昨天 下午 3:42"
 * - 本周内：显示 "周一 下午 3:42"
 * - 本年：显示 "6月1日 下午 3:42"
 * - 更早：显示 "2024/6/1 下午 3:42"
 */
export function formatSeparatorLabel(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();

  const timeStr = d.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // 今天
  if (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  ) {
    return timeStr;
  }

  // 昨天
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  ) {
    return `昨天 ${timeStr}`;
  }

  // 本周内（7天）
  const diffDays = Math.floor((now.getTime() - d.getTime()) / DAY);
  if (diffDays < 7) {
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return `${weekDays[d.getDay()]} ${timeStr}`;
  }

  // 本年
  if (d.getFullYear() === now.getFullYear()) {
    return `${d.getMonth() + 1}月${d.getDate()}日 ${timeStr}`;
  }

  // 更早
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${timeStr}`;
}

/**
 * 格式化为精确时间（用于悬停 tooltip）
 * 显示完整日期 + 时间，如 "2026/6/1 15:42"
 */
export function formatExactTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();

  const timeStr = d.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // 今天：仅显示时间
  if (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  ) {
    return timeStr;
  }

  // 本年：显示 月/日 时间
  if (d.getFullYear() === now.getFullYear()) {
    return `${d.getMonth() + 1}/${d.getDate()} ${timeStr}`;
  }

  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${timeStr}`;
}

/**
 * 判断两条消息之间是否需要插入时间分隔
 * @param current  当前消息时间
 * @param previous 上一条消息时间（null 表示第一条）
 * @param gapMs    间隔阈值（默认 5 分钟）
 */
export function shouldShowSeparator(
  current: Date | string,
  previous: Date | string | null,
  gapMs: number = 5 * MINUTE,
): boolean {
  if (!previous) return true;
  const c = typeof current === 'string' ? new Date(current) : current;
  const p = typeof previous === 'string' ? new Date(previous) : previous;
  return c.getTime() - p.getTime() >= gapMs;
}
