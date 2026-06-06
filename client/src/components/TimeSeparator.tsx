import React from 'react';

interface TimeSeparatorProps {
  label: string;
}

/**
 * 消息列表中的时间分隔标签
 * 用于在消息分组之间显示智能格式化的时间标签
 */
export default function TimeSeparator({ label }: TimeSeparatorProps) {
  return (
    <div className="flex items-center justify-center py-4">
      <span className="text-gray-600 text-[11px] font-body tracking-wide select-none">
        {label}
      </span>
    </div>
  );
}
