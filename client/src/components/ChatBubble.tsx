import React from 'react';
import { Message } from '@biu/shared';

interface Props {
  message: Message;
  isSelf: boolean;
}

export default function ChatBubble({ message, isSelf }: Props) {
  return (
    <div className={`flex ${isSelf ? 'justify-end' : 'justify-start'} mb-3`}>
      {!isSelf && (
        <div className="w-8 h-8 rounded-full bg-biu-secondary/30 flex items-center justify-center text-white text-xs font-bold mr-2 shrink-0">
          {message.sender?.nickname?.[0] || '?'}
        </div>
      )}
      <div className="max-w-[60%]">
        {!isSelf && (
          <p className="text-gray-500 text-xs mb-1">{message.sender?.nickname}</p>
        )}
        <div className={`px-4 py-2 ${isSelf ? 'bubble-self' : 'bubble-other'}`}>
          <p className="text-white text-sm break-words">{message.content}</p>
        </div>
        <p className="text-gray-600 text-xs mt-1">
          {new Date(message.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}
