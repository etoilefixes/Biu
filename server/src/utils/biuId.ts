/**
 * 生成用户 BiuId 的起始编号
 */
export const BIU_ID_START = 100001;

/**
 * 生成会话 BiuId
 * 格式：2 开头的 8 位数字（如 23456789），确保不超过 VarChar(20)
 * 与用户 BiuId（100001Biu 格式）命名空间隔离
 */
export function generateConversationBiuId(): string {
  const rand = Math.floor(Math.random() * 90000000) + 10000000;
  return `${rand}`;
}

/**
 * 生成群组 BiuId
 * 格式：2 开头 + 7 位随机数字（如 21234567）
 */
export function generateGroupBiuId(): string {
  const rand = Math.floor(Math.random() * 9000000) + 1000000;
  return `2${rand}`;
}
