import React from 'react';
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
  const sizeStyles = {
    sm: { padding: '4px 10px', fontSize: '12px', minHeight: '28px' },
    md: { padding: '8px 16px', fontSize: '14px', minHeight: '38px' },
    lg: { padding: '12px 22px', fontSize: '16px', minHeight: '48px' },
  }[size];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        ...sizeStyles,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        borderRadius: '9999px',
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s ease',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        border: active
          ? `1.5px solid ${colors.accent.primary}`
          : `1px solid ${colors.border.subtle}`,
        backgroundColor: active ? colors.accent.primary : colors.bg.elevated,
        color: active ? colors.text.inverse : colors.text.primary,
        boxShadow: active ? `0 0 12px ${colors.accent.primary}55` : 'none',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {icon && <span style={{ display: 'inline-flex', alignItems: 'center' }}>{icon}</span>}
      <span>{label}</span>
      {badge !== undefined && (
        <span
          style={{
            fontSize: '11px',
            padding: '2px 6px',
            borderRadius: '10px',
            backgroundColor: active ? 'rgba(0,0,0,0.2)' : colors.bg.surface,
            color: active ? colors.text.inverse : colors.accent.primary,
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
};
