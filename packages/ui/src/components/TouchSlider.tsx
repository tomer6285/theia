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
  formatTooltip?: (value: number) => string;
}

export const TouchSlider: React.FC<TouchSliderProps> = ({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  orientation = 'horizontal',
  height = orientation === 'horizontal' ? 8 : 160,
  width = orientation === 'horizontal' ? '100%' : 14,
  trackColor = colors.border.subtle,
  fillColor = colors.accent.primary,
  showThumb = true,
  formatTooltip,
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
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore in environments without capture support
    }
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

  // Generous touch hit zone (at least 44px touch area)
  const isHoriz = orientation === 'horizontal';

  return (
    <div
      style={{
        position: 'relative',
        width,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isHoriz ? '14px 0' : '0 14px',
        touchAction: 'none',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Visual Track */}
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          width: '100%',
          height,
          backgroundColor: trackColor,
          borderRadius: 9999,
          cursor: 'pointer',
          overflow: 'visible',
          transition: 'height 0.15s ease',
        }}
      >
        {/* Fill track */}
        <div
          style={{
            position: 'absolute',
            borderRadius: 9999,
            backgroundColor: fillColor,
            ...(isHoriz
              ? { left: 0, top: 0, bottom: 0, width: `${percentage}%` }
              : { left: 0, right: 0, bottom: 0, height: `${percentage}%` }),
            transition: isDragging ? 'none' : 'all 0.1s ease',
            boxShadow: isDragging ? `0 0 10px ${fillColor}88` : 'none',
          }}
        />

        {/* Thumb handle */}
        {showThumb && (
          <div
            style={{
              position: 'absolute',
              width: isDragging ? 22 : 16,
              height: isDragging ? 22 : 16,
              borderRadius: '50%',
              backgroundColor: '#ffffff',
              boxShadow: isDragging
                ? `0 0 0 6px ${fillColor}44, 0 4px 12px rgba(0,0,0,0.6)`
                : '0 2px 8px rgba(0,0,0,0.4)',
              border: `2px solid ${fillColor}`,
              ...(isHoriz
                ? {
                    left: `calc(${percentage}% - ${isDragging ? 11 : 8}px)`,
                    top: '50%',
                    transform: 'translateY(-50%)',
                  }
                : {
                    bottom: `calc(${percentage}% - ${isDragging ? 11 : 8}px)`,
                    left: '50%',
                    transform: 'translateX(-50%)',
                  }),
              transition: isDragging
                ? 'box-shadow 0.15s ease, width 0.15s ease, height 0.15s ease'
                : 'all 0.15s ease',
              pointerEvents: 'none',
            }}
          />
        )}

        {/* Live Dragging Tooltip */}
        {isDragging && formatTooltip && isHoriz && (
          <div
            style={{
              position: 'absolute',
              bottom: 'calc(100% + 14px)',
              left: `${percentage}%`,
              transform: 'translateX(-50%)',
              backgroundColor: 'rgba(18, 18, 21, 0.95)',
              backdropFilter: 'blur(10px)',
              border: `1px solid ${colors.border.subtle}`,
              color: '#ffffff',
              padding: '4px 10px',
              borderRadius: 8,
              fontSize: '12px',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
              zIndex: 10,
            }}
          >
            {formatTooltip(value)}
            {/* Tooltip caret */}
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                borderLeft: '5px solid transparent',
                borderRight: '5px solid transparent',
                borderTop: `5px solid ${colors.border.subtle}`,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
