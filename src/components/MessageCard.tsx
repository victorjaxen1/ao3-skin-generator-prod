import React from 'react';
import { Message, TwitterCharacter } from '../lib/schema';

interface MessageCardProps {
  message: Message;
  index: number;
  totalMessages: number;
  character?: TwitterCharacter;
  isReply?: boolean;
  onUpdate: (patch: Partial<Message>) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  uploading?: boolean;
  onImageUpload?: (file: File) => Promise<void>;
  children?: React.ReactNode;
  template: 'twitter' | 'ios' | 'android' | 'google';
}

export const MessageCard: React.FC<MessageCardProps> = ({
  message: m,
  index: idx,
  totalMessages,
  character: char,
  isReply,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  uploading,
  onImageUpload,
  children,
  template
}) => {
  const getTemplateConfig = () => {
    switch (template) {
      case 'twitter':
        return {
          icon: '𝕏',
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          focusRing: 'focus:ring-blue-400',
          accentBg: 'bg-blue-100',
          accentText: 'text-blue-700',
        };
      case 'ios':
        return {
          icon: '💬',
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          focusRing: 'focus:ring-blue-400',
          accentBg: 'bg-blue-100',
          accentText: 'text-blue-700',
        };
      case 'android':
        return {
          icon: '💬',
          bg: 'bg-green-50',
          border: 'border-green-200',
          focusRing: 'focus:ring-green-400',
          accentBg: 'bg-green-100',
          accentText: 'text-green-700',
        };
      default:
        return {
          icon: '💬',
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          focusRing: 'focus:ring-gray-400',
          accentBg: 'bg-gray-100',
          accentText: 'text-gray-700',
        };
    }
  };

  const config = getTemplateConfig();

  return (
    <div 
      className={`group border-2 ${config.border} rounded-xl bg-white hover:border-opacity-70 hover:shadow-lg transition-all ${
        isReply ? 'ml-4 sm:ml-8 border-l-4 border-l-purple-400' : ''
      }`}
    >
      {/* Card Header - More Prominent */}
      <div className={`${config.accentBg} ${config.accentText} px-4 py-2.5 border-b-2 ${config.border} flex items-center justify-between`}>
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="text-base sm:text-lg font-bold flex items-center gap-1.5">
            {config.icon}
            <span className="text-gray-700">#{idx + 1}</span>
          </span>
          {m.useCustomIdentity && char && (
            <span className="text-[10px] sm:text-xs bg-white/80 text-purple-700 px-2 py-1 rounded-full font-semibold flex items-center gap-1 shadow-sm">
              👤 <span className="hidden sm:inline">{char.name}</span>
              {char.verified && <span className="text-blue-500">✓</span>}
            </span>
          )}
          {isReply && (
            <span className="text-[10px] sm:text-xs bg-white/80 ${config.accentText} px-2 py-1 rounded-full font-semibold shadow-sm">
              💬 <span className="hidden sm:inline">Reply</span>
            </span>
          )}
        </div>
        
        {/* Action Buttons */}
        <div className="flex items-center gap-0.5 sm:gap-1">
          {onMoveUp && idx > 0 && (
            <button 
              type="button" 
              onClick={onMoveUp}
              className="text-gray-400 hover:text-gray-700 hover:bg-white text-sm sm:text-base px-1.5 sm:px-2 py-1 rounded transition"
              title="Move up"
            >
              ↑
            </button>
          )}
          {onMoveDown && idx < totalMessages - 1 && (
            <button 
              type="button" 
              onClick={onMoveDown}
              className="text-gray-400 hover:text-gray-700 hover:bg-white text-sm sm:text-base px-1.5 sm:px-2 py-1 rounded transition"
              title="Move down"
            >
              ↓
            </button>
          )}
          <button 
            type="button" 
            onClick={() => {
              if (confirm('Delete this message?')) {
                onDelete();
              }
            }}
            className="text-red-500 hover:text-red-700 hover:bg-white font-bold text-base sm:text-lg leading-none px-1.5 sm:px-2 py-1 rounded transition"
            title="Delete"
          >
            ×
          </button>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-3 sm:p-4 space-y-3">
        {children}
      </div>
    </div>
  );
};
