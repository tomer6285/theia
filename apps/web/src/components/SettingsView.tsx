import { useWatchState } from '@theia/ui';
import React, { useState, useRef, useEffect } from 'react';
import { theiaStore } from '@theia/core';
import { colors, TouchPill, TouchSwitch } from '@theia/ui';

export const SettingsView: React.FC = () => {
  useWatchState();
  const settings = theiaStore.getState().settings;
  const [proxyUrl, setProxyUrl] = useState(settings.proxyUrl || '');
  const [autoPlayNext, setAutoPlayNext] = useState(settings.autoPlayNext);
  const [autoResume, setAutoResume] = useState(settings.autoResume);
  const [validationError, setValidationError] = useState('');
  const savedTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(savedTimer.current), []);
  const [savedToast, setSavedToast] = useState(false);

  const handleSave = () => {
    const normalized = proxyUrl.trim();
    if (normalized) {
      try {
        const url = new URL(normalized, window.location.href);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password
          || (window.location.protocol === 'file:' && !/^https?:\/\//.test(normalized))) throw new Error();
      } catch { setValidationError('Enter an HTTP(S) proxy address, or leave it blank.'); return; }
    }
    setValidationError('');
    theiaStore.getState().updateSettings({
      proxyUrl: normalized,
      autoPlayNext,
      autoResume,
    });
    setSavedToast(true);
    clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSavedToast(false), 2200);
  };

  return (
    <div style={{ padding: '20px 20px 110px 20px', display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 640 }}>
      <div>
        <h1 style={{ margin: '0 0 6px 0', fontSize: '26px', fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>
          ⚙️ Settings
        </h1>
        <p style={{ margin: 0, fontSize: '14px', color: colors.text.muted }}>
          Configure stream routing, proxy endpoints, and touch playback
        </p>
      </div>

      {/* Cloudflare Edge Proxy Config */}
      <div
        style={{
          backgroundColor: colors.bg.surface,
          borderRadius: 20,
          padding: 22,
          border: `1.5px solid ${colors.border.subtle}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '17px', color: '#fff', fontWeight: 800 }}>
            Web Stream CORS Proxy
          </h3>
          <p style={{ margin: 0, fontSize: '13px', color: colors.text.muted, lineHeight: '1.5' }}>
            Some servers need a playback proxy. Enter your proxy address here, or leave it blank for a direct connection.
          </p>
        </div>

        <input
          type="text"
          aria-label="Playback proxy address"
          aria-invalid={Boolean(validationError)}
          aria-describedby={validationError ? 'proxy-error' : undefined}
          value={proxyUrl}
          onChange={(e) => setProxyUrl(e.target.value)}
          placeholder="https://theia-proxy.your-worker.workers.dev"
          style={{
            height: 48,
            borderRadius: 14,
            backgroundColor: colors.bg.elevated,
            border: `1.5px solid ${colors.border.subtle}`,
            padding: '0 16px',
            color: '#fff',
            fontSize: '15px',
            outline: 'none',
          }}
        />
      </div>

      {validationError && <p role="alert" id="proxy-error" style={{ color: '#fca5a5' }}>{validationError}</p>}
      {/* Playback Automation with TouchSwitch */}
      <div
        style={{
          backgroundColor: colors.bg.surface,
          borderRadius: 20,
          padding: 22,
          border: `1.5px solid ${colors.border.subtle}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <h3 style={{ margin: '0 0 4px 0', fontSize: '17px', color: '#fff', fontWeight: 800 }}>
          Playback Automation
        </h3>

        <TouchSwitch
          label="Auto-play Next Episode"
          description="Play the next episode when the current one ends. Available for direct video streams."
          checked={autoPlayNext}
          onChange={setAutoPlayNext}
        />
        <TouchSwitch label="Resume playback" description="Continue from your saved position when you return."
          checked={autoResume} onChange={setAutoResume} />
      </div>

      {/* Stream Provider Hierarchy */}
      <div
        style={{
          backgroundColor: colors.bg.surface,
          borderRadius: 20,
          padding: 22,
          border: `1.5px solid ${colors.border.subtle}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <h3 style={{ margin: 0, fontSize: '17px', color: '#fff', fontWeight: 800 }}>
          Active Scraper Providers
        </h3>
        <p style={{ margin: 0, fontSize: '13px', color: colors.text.muted, lineHeight: 1.4 }}>
          Theia queries providers in parallel with automated failover:
        </p>

        <p style={{ color: colors.text.secondary }}>VidLink · VixSrc · Vidora</p>
      </div>

      {/* Save Button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button
          type="button"
          onClick={handleSave}
          style={{
            height: 48,
            padding: '0 32px',
            borderRadius: 14,
            backgroundColor: colors.accent.primary,
            border: 'none',
            color: '#000',
            fontWeight: 800,
            fontSize: '15px',
            cursor: 'pointer',
            boxShadow: `0 0 16px ${colors.accent.primary}55`,
            touchAction: 'manipulation',
          }}
        >
          Save Settings
        </button>
        {savedToast && (
          <span role="status" style={{ fontSize: '14px', color: colors.status.success, fontWeight: 700 }}>
            ✓ Preferences saved!
          </span>
        )}
      </div>

      {/* App Info */}
      <div style={{ marginTop: 16, borderTop: `1px solid ${colors.border.subtle}`, paddingTop: 18 }}>
        <div style={{ fontSize: '12px', color: colors.text.muted, lineHeight: '1.6' }}>
          <strong>Theia v0.1.0</strong><br />
          Your library and watch progress are saved on this device.
        </div>
      </div>
    </div>
  );
};
