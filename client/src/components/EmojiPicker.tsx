import React, { useCallback, useEffect, useRef } from 'react';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

// emoji-mart 中文翻译
const zhCN = {
  search: '搜索',
  clear: '清除',
  noEmojiFound: '未找到表情',
  skinToneLabel: '肤色',
  skinTones: ['默认', '浅色', '中浅', '中等', '中深', '深色'],
  categories: {
    search: '搜索结果',
    frequent: '常用',
    smileys: '表情与情感',
    people: '人物与身体',
    nature: '动物与自然',
    foods: '食物与饮料',
    activity: '活动',
    places: '旅行与地点',
    objects: '物品',
    symbols: '符号',
    flags: '旗帜',
    custom: '自定义',
  },
  categoriesLabel: '表情分类',
};

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

const RECENT_KEY = 'biu_recent_emojis';

function getRecentEmojis(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
}

function addRecentEmoji(emoji: string) {
  const recent = getRecentEmojis().filter((e) => e !== emoji);
  recent.unshift(emoji);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 24)));
}

export default function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  const handleSelect = useCallback(
    (data: any) => {
      const emoji = data.native;
      if (emoji) {
        addRecentEmoji(emoji);
        onSelect(emoji);
      }
    },
    [onSelect]
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return (
    <div ref={ref} className="absolute bottom-full left-0 mb-2 z-50 animate-scale-in">
      <Picker
        data={data}
        i18n={zhCN}
        onEmojiSelect={handleSelect}
        theme="dark"
        set="native"
        previewPosition="none"
        skinTonePosition="search"
        perLine={8}
        maxFrequentRows={2}
      />
    </div>
  );
}

export { getRecentEmojis, addRecentEmoji };
