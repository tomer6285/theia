import React, { useRef, useState } from 'react';
import { colors } from '../theme/colors';

export interface TouchSliderProps {
  value: number; // 0 to 100 or min to max
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  orientation?: 'horizontal' | 'vertical';
  height?: number | string;
  width?: number | string;
  trackColor?: string;
  fillColor?: string;
  showThumb?: boolean;
}

export const TouchSlider: React.FC<TouchSliderProps> = ({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  orientation = 'horizontal',
  height = orientation === 'horizontal' ? 8 : 160,
  width = orientation === 'horizontal' ? '100%' : 12,
  trackColor = colors.border.subtle,
  fillColor = colors.accent.primary,
  showThumb = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const calculateValue = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    let percentage = 0;

    if (orientation === 'horizontal') {
      const offsetX = clientX - rect.left;
      percentage = Math.max(0, Math.min(1, offsetX / rect.width));
    } else {
      // In vertical sliders, bottom is min, top is max
      const offsetY = rect.bottom - clientY;
      percentage = Math.max(0, Math.min(1, offsetY / rect.height));
    }

    const raw = min + percentage * (max - min);
    const stepped = Math.round(raw / step) * step;
    onChange(Math.max(min, Math.min(max, stepped)));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    calculateValue(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    calculateValue(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
  };

  const percentage = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        position: 'relative',
        width,
        height,
        backgroundColor: trackColor,
        borderRadius: 9999,
        cursor: 'pointer',
        touchAction: 'none',
        userSelect: 'none',
        display: 'flex',
        alignItems: orientation === 'horizontal' ? 'center' : 'flex-end',
      }}
    >
      {/* Fill track */}
      <div
        style={{
          position: 'absolute',
          borderRadius: 9999,
          backgroundColor: fillColor,
          ...(orientation === 'horizontal'
            ? { left: 0, top: 0, bottom: 0, width: `${percentage}%` }
            : { left: 0, right: 0, bottom: 0, height: `${percentage}%` }),
          transition: isDragging ? 'none' : 'all 0.1s ease',
        }}
      />

      {/* Thumb handle */}
      {showThumb && (
        <div
          style={{
            position: 'absolute',
            width: isDragging ? 18 : 14,
            height: isDragging ? 18 : 14,
            borderRadius: '50%',
            backgroundColor: '#ffffff',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            ...(orientation === 'horizontal'
              ? {
                  left: `calc(${percentage}% - ${isDragging ? 9 : 7}px)`,
                  top: '50%',
                  transform: 'translateY(-50%)',
                }
              : {
                  bottom: `calc(${percentage}% - ${isDragging ? 9 : 7}px)`,
                  left: '50%',
                  transform: 'translateX(-50%)',
                }),
            transition: isDragging ? 'transform 0.1s ease' : 'all 0.15s ease',
          }}
        />
      )}
    </div>
  );
};
