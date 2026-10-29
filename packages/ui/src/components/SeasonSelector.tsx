import React, { useState, useRef, useEffect } from 'react';
import { SeasonInfo, WatchProgress } from '@theia/core';
import { colors } from '../theme/colors';

export interface SeasonSelectorProps {
  seasons: SeasonInfo[];
  selectedSeason: number;
  onSelectSeason: (seasonNumber: number) => void;
  progressMap?: Record<string, WatchProgress>;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  placeholder?: string;
}

export const SeasonSelector: React.FC<SeasonSelectorProps> = ({
  seasons,
  selectedSeason,
  onSelectSeason,
  progressMap = {},
  searchQuery = '',
  onSearchChange,
  placeholder = 'Filter episodes...',
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pillTrackRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const currentSeasonInfo = seasons.find((s) => s.season === selectedSeason) || seasons[0];
  const currentSeasonLabel =
    currentSeasonInfo?.season === 0 ? 'Specials' : `Season ${currentSeasonInfo?.season ?? 1}`;
  const currentEpisodeCount = currentSeasonInfo?.episodes.length ?? 0;

  // Calculate watched count for each season
  const getSeasonProgressStats = (season: SeasonInfo) => {
    const total = season.episodes.length;
    let completedCount = 0;
    for (const ep of season.episodes) {
      if (progressMap[ep.id]?.completed) {
        completedCount++;
      }
    }
    return { total, completedCount, isAllCompleted: total > 0 && completedCount === total };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Top Controls: Dropdown + Search Input */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        {/* Season Dropdown Menu Button */}
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            style={{
              height: 40,
              padding: '0 16px',
              borderRadius: 12,
              backgroundColor: isDropdownOpen ? colors.bg.elevated : 'rgba(28, 28, 34, 0.8)',
              border: isDropdownOpen
                ? `1.5px solid ${colors.accent.primary}`
                : `1.5px solid ${colors.border.subtle}`,
              color: '#fff',
              fontSize: '14px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              cursor: 'pointer',
              boxShadow: isDropdownOpen ? `0 0 16px ${colors.accent.primary}33` : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            <span style={{ color: colors.accent.primary }}>📺</span>
            <span>{currentSeasonLabel}</span>
            <span
              style={{
                fontSize: '12px',
                color: colors.text.muted,
                fontWeight: 600,
              }}
            >
              ({currentEpisodeCount} {currentEpisodeCount === 1 ? 'ep' : 'eps'})
            </span>
            <span
              style={{
                fontSize: '11px',
                color: colors.text.muted,
                transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
                marginLeft: 4,
              }}
            >
              ▼
            </span>
          </button>

          {/* Floating Dropdown Popover */}
          {isDropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                left: 0,
                zIndex: 100,
                minWidth: 260,
                maxHeight: 320,
                overflowY: 'auto',
                backgroundColor: colors.bg.surface,
                borderRadius: 16,
                border: `1.5px solid ${colors.border.subtle}`,
                boxShadow: '0 12px 36px rgba(0,0,0,0.85)',
                padding: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                animation: 'fadeIn 0.15s ease-out',
              }}
            >
              <div
                style={{
                  padding: '6px 10px',
                  fontSize: '11px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.8px',
                  color: colors.text.muted,
                }}
              >
                Select Season ({seasons.length})
              </div>

              {seasons.map((s) => {
                const isSelected = s.season === selectedSeason;
                const stats = getSeasonProgressStats(s);
                const label = s.season === 0 ? 'Specials' : `Season ${s.season}`;

                return (
                  <button
                    key={s.season}
                    type="button"
                    onClick={() => {
                      onSelectSeason(s.season);
                      setIsDropdownOpen(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 10,
                      backgroundColor: isSelected ? `${colors.accent.primary}22` : 'transparent',
                      border: isSelected
                        ? `1px solid ${colors.accent.primary}66`
                        : '1px solid transparent',
                      color: isSelected ? colors.accent.primary : colors.text.primary,
                      fontSize: '13px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = colors.bg.elevated;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: isSelected ? colors.accent.primary : colors.text.muted }}>
                        {isSelected ? '✓' : '•'}
                      </span>
                      <span>{label}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {stats.isAllCompleted && (
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: 6,
                            backgroundColor: 'rgba(16, 185, 129, 0.2)',
                            color: '#10b981',
                          }}
                        >
                          WATCHED
                        </span>
                      )}
                      <span style={{ fontSize: '12px', color: colors.text.muted, fontWeight: 600 }}>
                        {s.episodes.length} eps
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Live Search / Filter Input */}
        {onSearchChange && (
          <div
            style={{
              position: 'relative',
              flex: '1 1 200px',
              maxWidth: 320,
              minWidth: 160,
            }}
          >
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={placeholder}
              style={{
                width: '100%',
                height: 40,
                padding: '0 36px 0 34px',
                borderRadius: 12,
                backgroundColor: 'rgba(28, 28, 34, 0.7)',
                border: `1px solid ${colors.border.subtle}`,
                color: '#fff',
                fontSize: '13px',
                outline: 'none',
                transition: 'border-color 0.2s ease',
              }}
              onFocus={(e) => (e.target.style.borderColor = colors.accent.primary)}
              onBlur={(e) => (e.target.style.borderColor = colors.border.subtle)}
            />
            {/* Search Icon */}
            <span
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: '12px',
                color: colors.text.muted,
                pointerEvents: 'none',
              }}
            >
              🔍
            </span>
            {/* Clear Button */}
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: colors.text.muted,
                  cursor: 'pointer',
                  fontSize: '13px',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>

      {/* Horizontal Pill Track for Quick Season Switching */}
      {seasons.length > 1 && (
        <div
          ref={pillTrackRef}
          className="touch-scroll-row"
          style={{
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            paddingBottom: 4,
            scrollbarWidth: 'none',
            scrollSnapType: 'x proximity',
          }}
        >
          {seasons.map((s) => {
            const isSelected = s.season === selectedSeason;
            const stats = getSeasonProgressStats(s);
            const label = s.season === 0 ? 'Specials' : `S${s.season}`;

            return (
              <button
                key={s.season}
                type="button"
                onClick={() => onSelectSeason(s.season)}
                style={{
                  flexShrink: 0,
                  scrollSnapAlign: 'start',
                  padding: '7px 14px',
                  borderRadius: 12,
                  backgroundColor: isSelected
                    ? colors.accent.primary
                    : 'rgba(28, 28, 34, 0.7)',
                  border: isSelected
                    ? `1.5px solid ${colors.accent.primary}`
                    : `1px solid ${colors.border.subtle}`,
                  color: isSelected ? '#000' : colors.text.secondary,
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: isSelected ? `0 0 14px ${colors.accent.primary}55` : 'none',
                  transition: 'all 0.15s ease',
                  userSelect: 'none',
                }}
              >
                <span>{label}</span>
                {stats.isAllCompleted && !isSelected && (
                  <span style={{ fontSize: '11px', color: '#10b981' }}>✓</span>
                )}
                <span
                  style={{
                    fontSize: '11px',
                    opacity: isSelected ? 0.8 : 0.6,
                    fontWeight: 600,
                  }}
                >
                  {s.episodes.length}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
