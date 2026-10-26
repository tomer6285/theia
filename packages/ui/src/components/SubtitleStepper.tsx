import React from 'react';
import { SubtitleTrack } from '@dion/core';
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
        backgroundColor: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          backgroundColor: colors.bg.surface,
          borderRadius: 20,
          border: `1px solid ${colors.border.subtle}`,
          padding: 24,
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '18px', color: colors.text.primary, fontWeight: 700 }}>
            Subtitle Sync & Tracks
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: colors.bg.elevated,
              border: `1px solid ${colors.border.subtle}`,
              color: colors.text.secondary,
              width: 32,
              height: 32,
              borderRadius: 16,
              cursor: 'pointer',
              fontSize: '16px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Tracks List */}
        {tracks.length > 0 && onSelectTrack && (
          <div>
            <span style={{ fontSize: '13px', color: colors.text.muted, display: 'block', marginBottom: 8 }}>
              Language Track
            </span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', maxHeight: 110, overflowY: 'auto' }}>
              <TouchPill
                label="Off"
                size="sm"
                active={!selectedTrackId}
                onClick={() => onSelectTrack('')}
              />
              {tracks.map((t) => (
                <TouchPill
                  key={t.id}
                  label={t.label || t.language}
                  size="sm"
                  active={selectedTrackId === t.id}
                  onClick={() => onSelectTrack(t.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Subtitle Offset Stepper */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: '13px', color: colors.text.muted }}>
              Timing Delay
            </span>
            <span
              style={{
                fontSize: '16px',
                fontWeight: 700,
                color: offsetMs === 0 ? colors.text.secondary : colors.accent.primary,
              }}
            >
              {formattedOffset}
            </span>
          </div>

          {/* Stepper Buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => adjust(-250)}
              style={buttonStyle}
            >
              -250ms
            </button>
            <button
              type="button"
              onClick={() => adjust(-50)}
              style={buttonStyle}
            >
              -50ms
            </button>
            <button
              type="button"
              onClick={() => adjust(50)}
              style={buttonStyle}
            >
              +50ms
            </button>
            <button
              type="button"
              onClick={() => adjust(250)}
              style={buttonStyle}
            >
              +250ms
            </button>
          </div>

          {/* Fine-tune Slider */}
          <div style={{ padding: '0 4px' }}>
            <TouchSlider
              value={offsetMs}
              min={-5000}
              max={5000}
              step={50}
              onChange={(val) => onOffsetChange(val)}
            />
          </div>
        </div>

        {/* Reset Button */}
        {offsetMs !== 0 && (
          <button
            type="button"
            onClick={() => onOffsetChange(0)}
            style={{
              padding: '10px 16px',
              borderRadius: 12,
              backgroundColor: colors.bg.elevated,
              border: `1px solid ${colors.border.subtle}`,
              color: colors.text.secondary,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px',
            }}
          >
            Reset Timing to 0ms
          </button>
        )}
      </div>
    </div>
  );
};

const buttonStyle: React.CSSProperties = {
  padding: '10px 0',
  borderRadius: 10,
  backgroundColor: colors.bg.elevated,
  border: `1px solid ${colors.border.subtle}`,
  color: colors.text.primary,
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'background-color 0.1s ease',
  textAlign: 'center',
};
