import React from 'react';
import { colors } from '../theme/colors';

export interface TouchSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  description?: string;
}

export const TouchSwitch: React.FC<TouchSwitchProps> = ({
  checked,
  onChange,
  disabled = false,
  label,
  description,
}) => {
  return (
    <div
      onClick={() => {
        if (!disabled) {
          onChange(!checked);
        }
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        cursor: disabled ? 'not-allowed' : 'pointer',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        padding: '8px 0',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {(label || description) && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {label && (
            <span style={{ fontSize: '15px', color: colors.text.primary, fontWeight: 600 }}>
              {label}
            </span>
          )}
          {description && (
            <span style={{ fontSize: '13px', color: colors.text.secondary, lineHeight: 1.4 }}>
              {description}
            </span>
          )}
        </div>
      )}

      {/* Pill Track */}
      <div
        style={{
          position: 'relative',
          width: 52,
          height: 32,
          borderRadius: 16,
          backgroundColor: checked ? colors.accent.primary : colors.bg.elevated,
          border: `1.5px solid ${checked ? colors.accent.primary : colors.border.default}`,
          boxShadow: checked ? `0 0 12px ${colors.accent.primary}55` : 'none',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          flexShrink: 0,
        }}
      >
        {/* Sliding Thumb */}
        <div
          style={{
            position: 'absolute',
            top: 3,
            left: checked ? 23 : 3,
            width: 22,
            height: 22,
            borderRadius: '50%',
            backgroundColor: checked ? '#000000' : '#ffffff',
            boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </div>
    </div>
  );
};
