import { setDefaultProxyUrl } from '@theia/core';
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Vite serves discovery and media through the same LAN-accessible origin.
setDefaultProxyUrl(window.theiaElectron?.proxyUrl || (import.meta.env.DEV ? '/api/proxy' : ''));

// Dialogs restore focus programmatically; track input so mouse users do not
// inherit a keyboard focus ring when a dialog closes.
const inputListeners = new AbortController();
document.addEventListener('pointerdown', () => {
  document.documentElement.dataset.inputModality = 'pointer';
}, { capture: true, signal: inputListeners.signal });
document.addEventListener('keydown', (event) => {
  if (!event.metaKey && !event.ctrlKey && !event.altKey) {
    document.documentElement.dataset.inputModality = 'keyboard';
  }
}, { capture: true, signal: inputListeners.signal });
if (import.meta.hot) import.meta.hot.dispose(() => inputListeners.abort());

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
