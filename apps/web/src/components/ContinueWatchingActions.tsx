import React, { useEffect, useRef, useState } from 'react';
import { MediaItem, theiaStore } from '@theia/core';
import { colors } from '@theia/ui';

export function ContinueWatchingActions({ media, children }: React.PropsWithChildren<{ media: MediaItem }>) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const origin = useRef({ x: 0, y: 0 });
  const held = useRef(false);
  const cancel = () => clearTimeout(timer.current);
  const open = (x: number, y: number) => setPosition({
    x: Math.max(8, Math.min(x, window.innerWidth - 276)),
    y: Math.max(8, Math.min(y, window.innerHeight - 116)),
  });
  useEffect(() => () => cancel(), []);
  useEffect(() => {
    if (!position) return;
    menu.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const dismiss = () => setPosition(null);
    const outside = (event: PointerEvent) => { if (!menu.current?.contains(event.target as Node)) dismiss(); };
    document.addEventListener('pointerdown', outside);
    window.addEventListener('resize', dismiss);
    window.addEventListener('scroll', dismiss, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('scroll', dismiss, true);
    };
  }, [position]);
  const close = () => { setPosition(null); root.current?.querySelector<HTMLElement>('.media-card')?.focus(); };
  const style: React.CSSProperties = { background: 'none', border: 'none', color: colors.text.primary,
    textAlign: 'left', padding: '10px 8px', minHeight: 44, cursor: 'pointer', fontSize: 12 };
  return <div ref={root} style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0,
    userSelect: 'none', WebkitTouchCallout: 'none' }}
    onContextMenu={event => { event.preventDefault(); cancel(); open(event.clientX, event.clientY); }}
    onKeyDown={event => {
      if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
        event.preventDefault(); const rect = event.currentTarget.getBoundingClientRect(); open(rect.left, rect.top + 30);
      }
    }}
    onPointerDown={event => {
      if (event.pointerType === 'mouse' || menu.current?.contains(event.target as Node)) return;
      cancel(); held.current = false; origin.current = { x: event.clientX, y: event.clientY };
      timer.current = setTimeout(() => { held.current = true; open(event.clientX, event.clientY); }, 500);
    }}
    onPointerMove={event => { if (Math.hypot(event.clientX - origin.current.x, event.clientY - origin.current.y) > 10) cancel(); }}
    onPointerUp={cancel} onPointerCancel={cancel} onPointerLeave={cancel}
    onClickCapture={event => { if (held.current) { event.preventDefault(); event.stopPropagation(); held.current = false; } }}>
    {children}
    {position && <div ref={menu} role="menu" aria-label={`Actions for ${media.title}`}
      onKeyDown={event => {
        const buttons = Array.from(menu.current!.querySelectorAll('button'));
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        if (event.key === 'Escape' || event.key === 'Tab') { close(); if (event.key === 'Escape') event.preventDefault(); }
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault(); buttons[event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
            : (index + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length]?.focus();
        }
      }}
      style={{ position: 'fixed', left: position.x, top: position.y, zIndex: 1000, width: 260,
        display: 'flex', flexDirection: 'column', padding: 8, backgroundColor: colors.bg.surface,
        border: `1px solid ${colors.border.subtle}`, borderRadius: 10, boxShadow: '0 8px 28px #0008' }}>
      <button role="menuitem" type="button" style={style} onClick={() => { theiaStore.getState().toggleFavorite(media); close(); }}>
        {theiaStore.getState().isFavorite(media.id) ? 'Remove from favorites' : 'Add to favorites'}</button>
      <button role="menuitem" type="button" style={style} onClick={() => { theiaStore.getState().dismissContinueWatching(media.id); close(); }}>
        Remove from Continue Watching</button>
    </div>}
  </div>;
}
