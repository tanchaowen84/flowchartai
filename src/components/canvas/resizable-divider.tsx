'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface ResizableDividerProps {
  onResize: (width: number) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
  minWidth?: number;
  maxWidth?: number;
  defaultWidth?: number;
  className?: string;
}

export const ResizableDivider: React.FC<ResizableDividerProps> = ({
  onResize,
  onResizeStart,
  onResizeEnd,
  minWidth = 300,
  maxWidth = 600,
  defaultWidth = 400,
  className = '',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [currentWidth, setCurrentWidth] = useState(defaultWidth);
  const dividerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      onResizeStart?.();
    },
    [onResizeStart]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;

      // 计算新宽度（从右边界开始计算）
      const newWidth = window.innerWidth - e.clientX;

      // 限制在最小和最大宽度之间
      const constrainedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));

      setCurrentWidth(constrainedWidth);
      onResize(constrainedWidth);
    },
    [isDragging, minWidth, maxWidth, onResize]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    onResizeEnd?.();
  }, [onResizeEnd]);

  // 添加全局鼠标事件监听器
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={dividerRef}
      className={`
        group
        relative
        w-px
        h-full
        cursor-col-resize
        flex-shrink-0
        ${className}
      `}
      onMouseDown={handleMouseDown}
    >
      {/* 主分隔线 - 极简自然的线条 */}
      <div
        className={`
          absolute
          inset-0
          transition-all
          duration-200
          ${
            isDragging
              ? 'bg-blue-500/50'
              : 'bg-gray-300/30 group-hover:bg-gray-400/50'
          }
        `}
      />

      {/* 极简的拖拽指示器 */}
      <div
        className={`
          absolute
          top-1/2
          left-1/2
          transform
          -translate-x-1/2
          -translate-y-1/2
          w-0.5
          h-6
          rounded-full
          opacity-0
          group-hover:opacity-100
          transition-all
          duration-200
          pointer-events-none
          ${isDragging ? 'opacity-100 bg-blue-500/70' : 'bg-gray-500/50'}
        `}
      />

      {/* 扩展的鼠标悬停区域 */}
      <div
        className="absolute inset-y-0 -left-2 -right-2 cursor-col-resize"
        onMouseDown={handleMouseDown}
      />
    </div>
  );
};

export default ResizableDivider;
