import React, { useState } from 'react';
import { colors } from '../theme/colors';

export interface TouchPillProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
  icon?: React.ReactNode;
  badge?: string | number;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

export const TouchPill: React.FC<TouchPillProps> = ({
  label,
  active = false,
  onClick,
  icon,
  badge,
  size = 'md',
  disabled = false,
}) => {
  const [isPressed, setIsPressed] = useState(false);

  // Ergonomic touch sizes (min touch height for comfortable thumbs)
  const sizeStyles = {
    sm: { padding: '8px 14px', fontSize: '13px', minHeight: '36px' },
    md: { padding: '10px 18px', fontSize: '14px', minHeight: '44px' },
    lg: { padding: '14px 24px', fontSize: '16px', minHeight: '52px' },
  }[size];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onPointerDown={() => setIsPressed(true)}
      onPointerUp={() => setIsPressed(false)}
      onPointerLeave={() => setIsPressed(false)}
      style={{
        ...sizeStyles,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        borderRadius: '9999px',
        fontWeight: active ? 700 : 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: isPressed && !disabled ? 'scale(0.94)' : 'scale(1)',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'manipulation',
        border: active
          ? `1.5px solid ${colors.accent.primary}`
          : `1px solid ${colors.border.subtle}`,
        backgroundColor: active ? colors.accent.primary : colors.bg.elevated,
        color: active ? '#000000' : colors.text.primary,
        boxShadow: active
          ? `0 0 16px ${colors.accent.primary}55, 0 2px 8px rgba(0,0,0,0.3)`
          : '0 2px 6px rgba(0,0,0,0.2)',
        opacity: disabled ? 0.4 : 1,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {icon && <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: '15px' }}>{icon}</span>}
      <span>{label}</span>
      {badge !== undefined && (
        <span
          style={{
            fontSize: '11px',
            fontWeight: 800,
            padding: '2px 7px',
            borderRadius: '9999px',
            backgroundColor: active ? 'rgba(0,0,0,0.25)' : colors.bg.surface,
            color: active ? '#000000' : colors.text.secondary,
            marginLeft: 2,
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
};
