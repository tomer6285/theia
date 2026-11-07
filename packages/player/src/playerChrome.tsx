import React from 'react';

const paths = {
  close: 'm6 6 12 12M18 6 6 18',
  check: 'm5 12 4 4L19 6',
  lock: 'M6 10h12v11H6ZM8 10V6a4 4 0 0 1 8 0v4M12 14v3',
  unlock: 'M6 10h12v11H6ZM8 10V6a4 4 0 0 1 8 0M12 14v3',
  back: 'm14 6-6 6 6 6M8 12h13',
  play: 'm9 5 11 7-11 7Z',
  pause: 'M8 5v14M16 5v14',
  rewind: 'M4 9a9 9 0 1 1-1 6M4 3v6h6',
  forward: 'M20 9a9 9 0 1 0 1 6M20 3v6h-6',
  next: 'm5 5 11 7-11 7ZM19 5v14',
  volume: 'm11 4-6 5H2v6h3l6 5ZM15 8a6 6 0 0 1 0 8M18 4a11 11 0 0 1 0 16',
  muted: 'm11 4-6 5H2v6h3l6 5ZM16 9l6 6M22 9l-6 6',
  captions: 'M3 5h18v14H3ZM10 10H7v4h3M17 10h-3v4h3',
  aspect: 'M3 7V4h5M16 4h5v3M21 17v3h-5M8 20H3v-3M7 8h10v8H7Z',
  fullscreen: 'M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6',
  server: 'M3 4h18v6H3ZM3 14h18v6H3ZM7 7h.01M7 17h.01M11 7h6M11 17h6',
  sun: 'M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1 1M18 18l1 1M5 19l1-1M18 6l1-1M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
};
export function PlayerIcon({ name }: { name: keyof typeof paths }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill={name === 'play' || name === 'next' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

export const playerStyles = `
.video-player { container-type:inline-size; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
.player-lock { opacity:.65; }
.player-lock:hover,.player-lock:focus-visible { opacity:1; }
.player-chrome { transition:opacity .22s ease,visibility .22s; box-sizing:border-box; position:absolute; inset:0; z-index:20; padding:clamp(16px,4vw,48px); display:flex; flex-direction:column; justify-content:space-between; color:#f5f5f7; background:linear-gradient(180deg,rgba(5,7,10,.72),rgba(5,7,10,0) 30%,rgba(5,7,10,0) 55%,rgba(5,7,10,.94)); }
.player-chrome.is-hidden { opacity:0; visibility:hidden; pointer-events:none; }
.player-header,.player-heading,.player-toolbar,.player-toolbar-group { display:flex; align-items:center; }
.player-header,.player-toolbar { justify-content:space-between; gap:16px; }
.player-toolbar { flex-wrap:wrap; }
.player-header { align-items:flex-start; padding-right:52px; }
.player-heading { gap:20px; min-width:0; }
.player-title-block { min-width:0; }
.player-eyebrow { display:block; color:#b4b8c1; font-size:10px; font-weight:600; letter-spacing:2.2px; margin-bottom:8px; }
.video-player .player-title-block h2 { margin:0; font-size:clamp(18px,2.4vw,30px); line-height:1.2; font-weight:550; letter-spacing:-.6px; max-width:60vw; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.player-title-block p { margin:7px 0 0; color:#b4b8c1; font-size:13px; }
.player-source { flex-shrink:0; margin-top:7px; padding:6px 10px; border:1px solid #ffffff26; border-radius:5px; font-size:11px; color:#c8cbd2; max-width:22vw; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.player-icon,.player-text-button,.player-seek,.player-play { display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; border:0; color:inherit; cursor:pointer; touch-action:manipulation; transition:background .18s,transform .18s; }
.player-icon { width:42px; height:42px; border-radius:8px; background:transparent; }
.player-icon:hover,.player-text-button:hover { background:#ffffff15; }
.player-chrome button:focus-visible,.player-chrome input:focus-visible,.player-chrome select:focus-visible { outline:2px solid #c9e7ed; outline-offset:4px; }
.player-chrome button:active { transform:scale(.94); }
.player-transport { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); display:flex; align-items:center; gap:32px; }
.player-play { width:80px; height:80px; border-radius:50%; background:rgba(245,245,247,.95); color:#14171c; box-shadow:0 8px 40px #0003; }
.player-play:hover { background:#fff; transform:scale(1.05); }
.player-play svg { width:30px; height:30px; }
.player-seek { position:relative; width:48px; height:48px; background:transparent; color:#ffffffb3; border-radius:50%; }
.player-seek:hover { color:white; background:#ffffff12; }
.player-seek svg { width:34px; height:34px; }
.player-seek span { position:absolute; font-size:10px; font-weight:600; top:21px; }
.player-footer { width:100%; }
.player-footer-rule { height:1px; background:linear-gradient(90deg,#ffffff20,transparent); margin-bottom:18px; }
.is-playing .player-play { background:#13182075; color:#fff; border:1px solid #ffffff30; backdrop-filter:blur(12px); }
.is-playing .player-play:hover { background:#ffffff26; }
.player-timeline-meta { display:flex; justify-content:space-between; color:#b4b8c1; font-size:11px; font-variant-numeric:tabular-nums; letter-spacing:.3px; }
.player-timeline-meta>span:first-child { color:#fff; }
.player-time-divider { color:#8c919b; margin-left:6px; }
.player-timeline { display:block; width:100%; height:24px; margin:8px 0 10px; padding:0; cursor:pointer; appearance:none; background:transparent; }
.player-timeline::-webkit-slider-runnable-track { height:3px; border-radius:8px; background:linear-gradient(to right,#e1edf0 var(--progress),#ffffff30 var(--progress)); }
.player-timeline::-moz-range-track { height:3px; border-radius:8px; background:#ffffff30; }
.player-timeline::-moz-range-progress { height:3px; background:#e1edf0; }
.player-timeline::-webkit-slider-thumb { appearance:none; width:11px; height:11px; border-radius:50%; background:white; margin-top:-4px; box-shadow:0 0 0 4px #ffffff0c; }
.player-timeline::-moz-range-thumb { width:11px; height:11px; border:0; border-radius:50%; background:white; }
.player-toolbar-group { gap:6px; }
.player-toolbar-group:last-child { margin-left:auto; max-width:100%; flex-wrap:wrap; justify-content:flex-end; }
.player-volume { width:64px; height:24px; accent-color:#e1edf0; margin:0 18px 0 0; cursor:pointer; }
.player-text-button { gap:9px; height:42px; padding:0 12px; border-radius:8px; font-size:12px; background:transparent; }
.player-audio { box-sizing:border-box; flex-shrink:0; width:auto; min-width:160px; max-width:100%; color:#ddd; background-color:#171a20; border:1px solid #ffffff25; border-radius:6px; padding:10px 36px 10px 12px; font-size:14px; line-height:1.4; appearance:none; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='m3 4.5 3 3 3-3' fill='none' stroke='%23b4b8c1' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 12px center; }
@container(max-width:600px) {
 .player-chrome { padding:18px 16px; }
 .player-heading { gap:10px; }
 .player-eyebrow { font-size:8px; letter-spacing:1.4px; margin-bottom:5px; }
 .video-player .player-title-block h2 { font-size:17px !important; max-width:55vw; }
 .player-title-block p { font-size:11px; max-width:55vw; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
 .player-source,.player-volume,.player-text-button span { display:none; }
 .player-toolbar-group { gap:0; }
 .player-icon { width:36px; height:40px; }
 .player-transport { gap:22px; }
 .player-play { width:64px; height:64px; }
 .player-timeline-meta { font-size:10px; }
 .player-audio { min-width:144px; }
 .player-toolbar { gap:4px; flex-wrap:wrap; }
 .player-lock { top:16px !important; right:16px !important; width:40px !important; height:40px !important; }
}
@media(max-height:450px) {
 .player-chrome { padding:12px 22px; }
 .player-eyebrow,.player-title-block p { display:none; }
 .player-play { width:56px; height:56px; }
 .player-timeline { margin:3px 0; }
 .player-icon { height:34px; }
 .player-recovery { padding:16px 24px; }
 .player-state-icon { display:none; }
 .player-recovery p { margin-bottom:16px; }
 .player-servers { bottom:100px; max-height:calc(100% - 120px); }
}

.player-buffering { position:absolute; z-index:25; display:flex; flex-direction:column; align-items:center; gap:18px; color:#c2c7cf; font-size:11px; letter-spacing:.6px; pointer-events:none; }
.player-spinner { width:34px; height:34px; border:2px solid #ffffff18; border-top-color:#e1edf0; border-radius:50%; animation:player-spin 1s linear infinite; }
@keyframes player-spin { to { transform:rotate(360deg); } }
.player-recovery { position:absolute; z-index:60; width:min(420px,calc(100% - 40px)); box-sizing:border-box; max-height:calc(100% - 32px); overflow:auto; padding:30px; border:1px solid #ffffff18; border-radius:16px; background:linear-gradient(145deg,#20242bef,#101319fa); box-shadow:0 24px 80px #0008; color:#f5f5f7; text-align:center; }
.player-state-icon { display:inline-flex; padding:12px; margin-bottom:22px; border-radius:12px; background:#ffffff08; color:#b9cbd2; }
.player-recovery h3 { font-size:20px; font-weight:500; line-height:1.35; letter-spacing:-.4px; margin:12px 0; }
.player-recovery p { font-size:13px; color:#a9afb9; line-height:1.7; margin:0 0 24px; }
.player-recovery-actions { display:flex; justify-content:center; flex-wrap:wrap; gap:8px; }
.player-primary,.player-secondary { display:inline-flex; align-items:center; justify-content:center; gap:9px; min-height:40px; padding:0 15px; border:1px solid #ffffff20; border-radius:7px; background:#ffffff07; color:#e1e4e9; cursor:pointer; font-family:inherit; font-weight:500; touch-action:manipulation; }
.player-primary { background:#e1edf0; color:#171b21; border-color:transparent; font-size:12px; }
.player-secondary { font-size:12px; }
.player-primary:hover { background:#fff; }
.player-secondary:hover { background:#ffffff13; }
.video-player button:focus-visible { outline:2px solid #c9e7ed; outline-offset:3px; }
.player-notice { position:absolute; bottom:150px; z-index:55; margin:0 20px; padding:12px 18px; border:1px solid #ffffff20; border-radius:8px; background:#15191ff2; color:#d3d7df; font-size:12px; }
.player-embed-header { position:absolute; inset:0 0 auto; z-index:40; display:flex; align-items:center; justify-content:space-between; gap:16px; padding:24px 88px 32px 24px; background:linear-gradient(#05070add,transparent); pointer-events:none; }
.player-embed-header button { pointer-events:auto; }
.player-servers { position:absolute; right:clamp(16px,4vw,48px); bottom:150px; width:300px; max-width:calc(100% - 32px); max-height:calc(100% - 180px); box-sizing:border-box; overflow:auto; padding:16px; border:1px solid #ffffff1c; border-radius:12px; background:#14181ff5; box-shadow:0 16px 60px #0008; backdrop-filter:blur(24px); z-index:50; color:#f5f5f7; }
.player-servers.is-embed { bottom:auto; top:88px; max-height:calc(100% - 104px); }
.player-servers-heading { display:flex; align-items:center; justify-content:space-between; padding:0 0 12px 8px; border-bottom:1px solid #ffffff10; margin-bottom:8px; }
.player-servers-heading .player-eyebrow { font-size:8px; margin-bottom:5px; }
.player-servers h3 { font-size:15px; font-weight:500; margin:0; }
.player-server-option { width:100%; display:flex; gap:12px; align-items:center; border:0; border-radius:7px; background:transparent; color:#c1c7d0; padding:13px 10px; text-align:left; cursor:pointer; }
.player-server-option:hover { background:#ffffff08; }
.player-server-option[aria-pressed=true] { background:#d9edf00c; color:#eef6f8; }
.player-server-number { font-size:10px; color:#717986; font-variant-numeric:tabular-nums; }
.player-server-label { flex:1; min-width:0; overflow-wrap:anywhere; font-size:12px; }
.player-server-label small { display:block; margin-top:5px; color:#858e9c; font-size:10px; }
@container(max-width:600px) {
 .player-footer-rule { margin-bottom:12px; }
 .player-embed-header { padding:16px 68px 24px 16px; }
 .player-embed-header .player-secondary span { display:none; }
 .player-servers { bottom:140px; max-height:calc(100% - 160px); }
 .player-recovery { padding:20px; }
 .player-recovery h3 { font-size:17px; }
}
@media(prefers-reduced-motion:reduce) { .player-spinner { animation:none; border-color:#ffffff40; } }

@media(prefers-reduced-motion:reduce) { .player-chrome,.player-chrome button { transition:none; } }
`;
