import React from 'react';
import { colors } from '@dion/ui';

export type TabType = 'discover' | 'continue' | 'library' | 'settings';

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
    { id: 'discover', label: 'Discover', icon: '🔍' },
    { id: 'continue', label: 'Continue', icon: '⏱️', badge: continueCount },
    { id: 'library', label: 'Library', icon: '📚' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 64,
        backgroundColor: 'rgba(18, 18, 21, 0.95)',
        backdropFilter: 'blur(16px)',
        borderTop: `1px solid ${colors.border.subtle}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 50,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
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
              background: 'none',
              border: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              flex: 1,
              height: '100%',
              cursor: 'pointer',
              color: isActive ? colors.accent.primary : colors.text.muted,
              transition: 'color 0.15s ease',
            }}
          >
            <span style={{ fontSize: '20px' }}>{tab.icon}</span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: isActive ? 700 : 500,
              }}
            >
              {tab.label}
            </span>
            {tab.badge !== undefined && tab.badge > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 'calc(50% - 18px)',
                  backgroundColor: colors.accent.primary,
                  color: '#000',
                  fontSize: '10px',
                  fontWeight: 800,
                  borderRadius: '50%',
                  width: 16,
                  height: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
};
