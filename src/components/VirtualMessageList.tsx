/**
 * Performance Optimization for Message Lists
 * Uses windowing technique to improve render performance with large lists
 * 
 * For lists with 50+ items, only renders visible items + buffer
 * For smaller lists, renders normally to preserve full functionality
 */

import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';

interface Props {
  itemCount: number;
  children: (index: number) => React.ReactNode;
  className?: string;
  estimatedItemHeight?: number;
  focusedIndex?: number | null;
  focusTrigger?: number;
}

export interface VirtualMessageListRef {
  scrollToIndex: (index: number) => void;
}

export const VirtualMessageList = forwardRef<VirtualMessageListRef, Props>(({
  itemCount,
  children,
  className = '',
  estimatedItemHeight = 400, // Average height of a message card
  focusedIndex,
  focusTrigger,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: Math.min(itemCount, 20) });
  
  // Only use optimization for large lists (>50 items)
  const useOptimization = itemCount > 50;

  // Expose scrollToIndex method via ref
  useImperativeHandle(ref, () => ({
    scrollToIndex: (index: number) => {
      if (!containerRef.current) return;
      const scrollTop = index * estimatedItemHeight;
      containerRef.current.scrollTo({ top: scrollTop, behavior: 'smooth' });
    }
  }));

  // Scroll to focused index when it changes
  useEffect(() => {
    if (focusedIndex != null && focusedIndex >= 0 && containerRef.current) {
      // Calculate scroll position to center the item
      const containerHeight = containerRef.current.clientHeight;
      const itemTop = focusedIndex * estimatedItemHeight;
      const scrollTop = itemTop - (containerHeight / 2) + (estimatedItemHeight / 2);
      
      containerRef.current.scrollTo({ 
        top: Math.max(0, scrollTop), 
        behavior: 'smooth' 
      });
      
      // Update visible range immediately to include the focused item
      if (useOptimization) {
        const start = Math.max(0, focusedIndex - 10);
        const end = Math.min(itemCount, focusedIndex + 10);
        setVisibleRange({ start, end });
      }
    }
  }, [focusedIndex, focusTrigger, estimatedItemHeight, itemCount, useOptimization]);

  useEffect(() => {
    if (!useOptimization || !containerRef.current) return;

    const handleScroll = () => {
      if (!containerRef.current) return;

      const scrollTop = containerRef.current.scrollTop;
      const containerHeight = containerRef.current.clientHeight;

      const start = Math.max(0, Math.floor(scrollTop / estimatedItemHeight) - 5); // 5 item buffer above
      const end = Math.min(
        itemCount,
        Math.ceil((scrollTop + containerHeight) / estimatedItemHeight) + 5 // 5 item buffer below
      );

      setVisibleRange({ start, end });
    };

    const container = containerRef.current;
    container.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial calculation

    return () => container.removeEventListener('scroll', handleScroll);
  }, [itemCount, estimatedItemHeight, useOptimization]);

  if (!useOptimization) {
    // Render all items for small lists (preserves full functionality)
    return (
      <div ref={containerRef} className={className}>
        {Array.from({ length: itemCount }, (_, index) => {
          const child = children(index);
          // Skip rendering if child is null/undefined (safety check)
          if (!child) return null;
          return <React.Fragment key={index}>{child}</React.Fragment>;
        })}
      </div>
    );
  }

  // Render only visible items for large lists
  const { start, end } = visibleRange;
  const topPadding = start * estimatedItemHeight;
  const bottomPadding = (itemCount - end) * estimatedItemHeight;

  return (
    <div ref={containerRef} className={className}>
      {topPadding > 0 && <div style={{ height: topPadding }} />}
      {Array.from({ length: end - start }, (_, i) => {
        const index = start + i;
        const child = children(index);
        // Skip rendering if child is null/undefined (safety check)
        if (!child) return null;
        return <React.Fragment key={index}>{child}</React.Fragment>;
      })}
      {bottomPadding > 0 && <div style={{ height: bottomPadding }} />}
    </div>
  );
});
