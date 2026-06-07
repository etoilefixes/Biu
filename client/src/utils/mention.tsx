import React from 'react';

const MENTION_REGEX = /\[at:([^\]]+)\]/g;

/**
 * 纯文本预览：将 [at:userId] 替换为 @显示名，用于会话列表预览等纯文本场景
 * @param text 消息文本
 * @param memberMap 可选的 userId→nickname 映射
 */
export function renderPreview(text: string, memberMap?: Map<string, string>): string {
  return text.replace(MENTION_REGEX, (_, userId) => {
    if (userId === 'all') return '@全体成员';
    const nickname = memberMap?.get(userId);
    return nickname ? `@${nickname}` : `@${userId}`;
  });
}

/**
 * 富文本渲染：将 [at:userId] 替换为带样式的 JSX 节点，用于聊天气泡等富文本场景
 * @param content 消息内容
 * @param memberMap 可选的 userId→nickname 映射
 */
export function renderRich(content: string, memberMap?: Map<string, string>): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  MENTION_REGEX.lastIndex = 0;

  while ((match = MENTION_REGEX.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }

    const userId = match[1];
    const nickname = memberMap?.get(userId);
    parts.push(
      <span
        key={`mention-${match.index}`}
        style={{ color: '#ef4444', fontWeight: 600 }}
      >
        {userId === 'all' ? '@全体成员' : nickname ? `@${nickname}` : `@${userId}`}
      </span>
    );

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts;
}
