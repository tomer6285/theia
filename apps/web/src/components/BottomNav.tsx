import React from 'react';
import { colors } from '@theia/ui';

export type TabType = 'home' | 'movies' | 'shows' | 'continue' | 'library' | 'settings';

interface BottomNavProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  continueCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
  continueCount = 0,
}) => {
  const tabs: Array<{ id: TabType; label: string; icon: string; badge?: number }> = [
    { id: 'home', label: 'Home', icon: '🏠' },
    { id: 'movies', label: 'Movies', icon: '🎬' },
    { id: 'shows', label: 'Shows', icon: '📺' },
    { id: 'continue', label: 'Continue', icon: '⏱️', badge: continueCount },
    { id: 'library', label: 'Library', icon: '📚' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        padding: '0 12px max(12px, env(safe-area-inset-bottom, 12px)) 12px',
        zIndex: 50,
        pointerEvents: 'none',
      }}
    >
      <nav
        aria-label="Main navigation"
        style={{
          pointerEvents: 'auto',
          width: '100%',
          maxWidth: 540,
          height: 64,
          backgroundColor: 'rgba(18, 18, 22, 0.88)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: `1.5px solid ${colors.border.subtle}`,
          borderRadius: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          padding: '4px 6px',
          boxShadow: '0 12px 36px rgba(0,0,0,0.7), 0 0 20px rgba(6, 182, 212, 0.08)',
        }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChangeTab(tab.id)}
              style={{
                position: 'relative',
                background: isActive ? 'rgba(6, 182, 212, 0.12)' : 'none',
                border: 'none',
                borderRadius: 20,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                flex: 1,
                height: 52,
                cursor: 'pointer',
                color: isActive ? colors.accent.primary : colors.text.muted,
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
                padding: '2px 0',
              }}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <span
                style={{
                  fontSize: '18px',
                  transition: 'transform 0.2s ease',
                  transform: isActive ? 'scale(1.12)' : 'scale(1)',
                }}
              >
                {tab.icon}
              </span>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: isActive ? 800 : 600,
                  letterSpacing: '0.2px',
                }}
              >
                {tab.label}
              </span>

              {/* Active Tab Glow Dot */}
              {isActive && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 3,
                    width: 4,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: colors.accent.primary,
                    boxShadow: `0 0 6px ${colors.accent.primary}`,
                  }}
                />
              )}

              {/* Badge for Continue Watching */}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 'calc(50% - 18px)',
                    backgroundColor: colors.accent.primary,
                    color: '#000000',
                    fontSize: '9px',
                    fontWeight: 900,
                    borderRadius: '9999px',
                    minWidth: 15,
                    height: 15,
                    padding: '0 3px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: `0 0 8px ${colors.accent.primary}88`,
                  }}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};
