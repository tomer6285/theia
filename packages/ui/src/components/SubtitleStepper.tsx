import React from 'react';
import { SubtitleTrack } from '@theia/core';
import { colors } from '../theme/colors';
import { TouchSlider } from './TouchSlider';
import { TouchPill } from './TouchPill';

export interface SubtitleStepperProps {
  isOpen: boolean;
  onClose: () => void;
  offsetMs: number;
  onOffsetChange: (offsetMs: number) => void;
  tracks?: SubtitleTrack[];
  selectedTrackId?: string;
  onSelectTrack?: (trackId: string) => void;
}

export const SubtitleStepper: React.FC<SubtitleStepperProps> = ({
  isOpen,
  onClose,
  offsetMs,
  onOffsetChange,
  tracks = [],
  selectedTrackId,
  onSelectTrack,
}) => {
  if (!isOpen) return null;

  const adjust = (delta: number) => {
    onOffsetChange(offsetMs + delta);
  };

  const formattedOffset = `${offsetMs > 0 ? '+' : ''}${offsetMs} ms`;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        backgroundColor: 'rgba(0,0,0,0.8)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        touchAction: 'manipulation',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 460,
          backgroundColor: colors.bg.surface,
          borderRadius: 24,
          border: `1.5px solid ${colors.border.subtle}`,
          padding: '24px 24px',
          boxShadow: '0 25px 50px rgba(0,0,0,0.8)',
          display: 'flex',
          flexDirection: 'column',
          gap: 22,
          userSelect: 'none',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '20px', color: colors.text.primary, fontWeight: 800 }}>
              Subtitle Synchronization
            </h3>
            <span style={{ fontSize: '13px', color: colors.text.muted, marginTop: 2, display: 'block' }}>
              Adjust timing for speech alignment
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: colors.bg.elevated,
              border: `1px solid ${colors.border.subtle}`,
              color: colors.text.secondary,
              width: 38,
              height: 38,
              borderRadius: 19,
              cursor: 'pointer',
              fontSize: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              touchAction: 'manipulation',
            }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Current Offset Badge */}
        <div
          style={{
            backgroundColor: colors.bg.elevated,
            borderRadius: 18,
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            border: `1px solid ${colors.border.subtle}`,
          }}
        >
          <span style={{ fontSize: '12px', color: colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Current Audio/Subtitle Delay
          </span>
          <span
            style={{
              fontSize: '32px',
              fontWeight: 800,
              color: offsetMs === 0 ? colors.text.primary : colors.accent.primary,
              letterSpacing: '-0.5px',
            }}
          >
            {formattedOffset}
          </span>
        </div>

        {/* Large Touch Stepper Buttons */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            type="button"
            onClick={() => adjust(-250)}
            style={stepperButtonStyle}
          >
            -250ms
          </button>
          <button
            type="button"
            onClick={() => adjust(-50)}
            style={stepperButtonStyle}
          >
            -50ms
          </button>
          <button
            type="button"
            onClick={() => onOffsetChange(0)}
            style={{
              ...stepperButtonStyle,
              backgroundColor: colors.bg.surface,
              borderColor: colors.border.default,
              fontWeight: 700,
            }}
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => adjust(50)}
            style={stepperButtonStyle}
          >
            +50ms
          </button>
          <button
            type="button"
            onClick={() => adjust(250)}
            style={stepperButtonStyle}
          >
            +250ms
          </button>
        </div>

        {/* Coarse Slider */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: colors.text.muted }}>
            <span>-5.0s (Earlier)</span>
            <span>+5.0s (Later)</span>
          </div>
          <TouchSlider
            value={offsetMs}
            min={-5000}
            max={5000}
            step={50}
            onChange={(val) => onOffsetChange(val)}
            formatTooltip={(val) => `${val > 0 ? '+' : ''}${val}ms`}
          />
        </div>

        {/* Subtitle Track Picker (if tracks exist) */}
        {tracks.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: colors.text.secondary }}>
              Select Track
            </span>
            <div
              style={{
                display: 'flex',
                gap: 8,
                overflowX: 'auto',
                scrollbarWidth: 'none',
                paddingBottom: 4,
              }}
            >
              <TouchPill
                label="Off"
                size="sm"
                active={!selectedTrackId}
                onClick={() => onSelectTrack?.('')}
              />
              {tracks.map((t) => (
                <TouchPill
                  key={t.id}
                  label={t.label || t.language}
                  size="sm"
                  active={selectedTrackId === t.id}
                  onClick={() => onSelectTrack?.(t.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const stepperButtonStyle: React.CSSProperties = {
  flex: 1,
  height: 48,
  borderRadius: 14,
  backgroundColor: colors.bg.elevated,
  border: `1.5px solid ${colors.border.subtle}`,
  color: '#ffffff',
  fontSize: '13px',
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  userSelect: 'none',
  WebkitTapHighlightColor: 'transparent',
  touchAction: 'manipulation',
  transition: 'transform 0.1s ease',
};
