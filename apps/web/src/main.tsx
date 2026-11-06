import { setDefaultProxyUrl } from '@theia/core';
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Vite serves discovery and media through the same LAN-accessible origin.
setDefaultProxyUrl(import.meta.env.DEV ? '/api/proxy' : '');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
