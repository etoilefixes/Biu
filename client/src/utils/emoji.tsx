import React from 'react';

const OPENMOJI_CDN = 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji@14.0.0/color/svg';

const EMOJI_REGEX = /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu;

export function emojiToCodePoint(emoji: string): string {
  const codePoints: string[] = [];
  for (let i = 0; i < emoji.length; ) {
    const code = emoji.codePointAt(i)!;
    if (code === 0xFE0F) {
      i += 2;
      continue;
    }
    if (code === 0x200D) {
      i += 1;
      codePoints.push('200D');
      continue;
    }
    codePoints.push(code.toString(16).toUpperCase().padStart(4, '0'));
    i += code > 0xFFFF ? 2 : 1;
  }
  return codePoints.join('-');
}

export function getEmojiSvgUrl(emoji: string): string {
  const codePoint = emojiToCodePoint(emoji);
  return `${OPENMOJI_CDN}/${codePoint}.svg`;
}

export function renderContentWithEmoji(content: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const regex = new RegExp(EMOJI_REGEX.source, EMOJI_REGEX.flags);

  while ((match = regex.exec(content)) !== null) {
    const emoji = match[0];
    const index = match.index;

    if (index > lastIndex) {
      parts.push(content.slice(lastIndex, index));
    }

    parts.push(
      <img
        key={`emoji-${index}`}
        src={getEmojiSvgUrl(emoji)}
        alt={emoji}
        className="inline-block w-[1.2em] h-[1.2em] align-middle mx-[0.05em]"
        loading="lazy"
      />
    );

    lastIndex = index + emoji.length;
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [content];
}
