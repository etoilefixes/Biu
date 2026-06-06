import React from 'react';

/**
 * "以下是新消息" 分割线
 * 插入在已读消息和未读消息之间，视觉上区分新旧消息。
 * 使用 biu-accent 色调（红色）吸引注意力，但不刺眼。
 */
export default function NewMessageDivider() {
  return (
    <div className="flex items-center gap-3 py-3" data-new-message-divider>
      <div className="flex-1 h-px bg-biu-accent/20" />
      <span className="text-biu-accent/70 text-[11px] font-body tracking-wide whitespace-nowrap select-none">
        以下是新消息
      </span>
      <div className="flex-1 h-px bg-biu-accent/20" />
    </div>
  );
}
