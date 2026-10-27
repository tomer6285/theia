import React, { useState } from 'react';
import { theiaStore, UserSettings } from '@theia/core';
import { colors, TouchPill } from '@theia/ui';

export const SettingsView: React.FC = () => {
  const settings = theiaStore.getState().settings;
  const [proxyUrl, setProxyUrl] = useState(settings.proxyUrl || '');
  const [autoPlayNext, setAutoPlayNext] = useState(settings.autoPlayNext);
  const [savedToast, setSavedToast] = useState(false);

  const handleSave = () => {
    theiaStore.getState().updateSettings({
      proxyUrl,
      autoPlayNext,
    });
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
  };

  return (
    <div style={{ padding: '20px 20px 100px 20px', display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 640 }}>
      <div>
        <h1 style={{ margin: '0 0 6px 0', fontSize: '24px', fontWeight: 800, color: '#fff' }}>
          ⚙️ Settings
        </h1>
        <p style={{ margin: 0, fontSize: '14px', color: colors.text.muted }}>
          Configure stream routing, servers, and playback preferences
        </p>
      </div>

      {/* Cloudflare Edge Proxy Config */}
      <div
        style={{
          backgroundColor: colors.bg.surface,
          borderRadius: 16,
          padding: 20,
          border: `1px solid ${colors.border.subtle}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', color: '#fff', fontWeight: 700 }}>
            Web Stream CORS Proxy
          </h3>
          <p style={{ margin: 0, fontSize: '13px', color: colors.text.muted, lineHeight: '1.4' }}>
            Specify your Cloudflare Worker endpoint (`services/edge-proxy`) to rewrite headers (Referer spoofing) for web playback.
          </p>
        </div>

        <input
          type="text"
          value={proxyUrl}
          onChange={(e) => setProxyUrl(e.target.value)}
          placeholder="https://theia-proxy.your-worker.workers.dev"
          style={{
            height: 44,
            borderRadius: 10,
            backgroundColor: colors.bg.elevated,
            border: `1px solid ${colors.border.subtle}`,
            padding: '0 14px',
            color: '#fff',
            fontSize: '14px',
            outline: 'none',
          }}
        />
      </div>

      {/* Playback Preferences */}
      <div
        style={{
          backgroundColor: colors.bg.surface,
          borderRadius: 16,
          padding: 20,
          border: `1px solid ${colors.border.subtle}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <h3 style={{ margin: 0, fontSize: '16px', color: '#fff', fontWeight: 700 }}>
          Playback Automation
        </h3>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '14px', color: '#fff', fontWeight: 600 }}>
              Auto-play Next Episode
            </div>
            <div style={{ fontSize: '12px', color: colors.text.muted }}>
              Automatically cue the next episode 30s before the current one finishes.
            </div>
          </div>
          <input
            type="checkbox"
            checked={autoPlayNext}
            onChange={(e) => setAutoPlayNext(e.target.checked)}
            style={{ width: 20, height: 20, accentColor: colors.accent.primary, cursor: 'pointer' }}
          />
        </div>
      </div>

      {/* Stream Provider Hierarchy */}
      <div
        style={{
          backgroundColor: colors.bg.surface,
          borderRadius: 16,
          padding: 20,
          border: `1px solid ${colors.border.subtle}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <h3 style={{ margin: 0, fontSize: '16px', color: '#fff', fontWeight: 700 }}>
          Active Scraper Providers
        </h3>
        <p style={{ margin: 0, fontSize: '13px', color: colors.text.muted }}>
          Theia queries providers in parallel with failover:
        </p>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <TouchPill label="1. VidLink (XSalsa20)" active size="sm" />
          <TouchPill label="2. VixSrc" active size="sm" />
          <TouchPill label="3. Vidora (Fallback)" active size="sm" />
        </div>
      </div>

      {/* Save Button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          type="button"
          onClick={handleSave}
          style={{
            padding: '12px 28px',
            borderRadius: 12,
            backgroundColor: colors.accent.primary,
            border: 'none',
            color: '#000',
            fontWeight: 700,
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          Save Settings
        </button>
        {savedToast && (
          <span style={{ fontSize: '13px', color: colors.status.success, fontWeight: 600 }}>
            ✓ Preferences saved!
          </span>
        )}
      </div>

      {/* App Info */}
      <div style={{ marginTop: 20, borderTop: `1px solid ${colors.border.subtle}`, paddingTop: 16 }}>
        <div style={{ fontSize: '12px', color: colors.text.muted, lineHeight: '1.6' }}>
          <strong>Theia v0.1.0</strong> • Pure TypeScript Monorepo<br />
          React Native (Android APK) • Web PWA • Electron Desktop<br />
          Stremio Cinemeta API • XSalsa20-Poly1305 Native Decryption
        </div>
      </div>
    </div>
  );
};
