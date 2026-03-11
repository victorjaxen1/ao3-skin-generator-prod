import React, { useEffect, useRef } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  height?: string; // e.g., 'h-[60vh]', 'h-[90vh]'
}

export const BottomSheet: React.FC<Props> = ({
  isOpen,
  onClose,
  title,
  children,
  height = 'max-h-[70vh]',
}) => {
  const sheetRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-[2px] animate-fade-overlay"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl animate-slide-up ${height} flex flex-col`}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-stone-300" />
        </div>

        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-5 pb-3 border-b border-stone-100 flex-shrink-0">
            <h2 className="text-base font-semibold text-stone-900">{title}</h2>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 hover:text-stone-700 transition-colors text-sm"
            >
              ✕
            </button>
          </div>
        )}

        {/* Content — extra bottom padding so last item clears screen edge */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 pb-8">
          {children}
        </div>
      </div>
    </div>
  );
};

export default BottomSheet;
