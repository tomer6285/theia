import React, { useEffect, useId, useRef, useState } from 'react';
import styles from './HistoryCard.module.css';

export function HistoryOptions({ label, children }: {
  label: string;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const dismissOutside = (event: Event) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismissOutside);
    document.addEventListener('focusin', dismissOutside);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside);
      document.removeEventListener('focusin', dismissOutside);
    };
  }, [open]);

  const close = () => {
    trigger.current?.focus();
    setOpen(false);
  };

  return (
    <div ref={wrapper} className={styles.options} onKeyDown={event => {
      if (open && event.key === 'Escape') {
        event.stopPropagation();
        close();
      }
    }}>
      <button ref={trigger} type="button" className={styles.icon} aria-label={label}
        aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(value => !value)}>⋯</button>
      <div id={panelId} className={styles.menu} hidden={!open}>{children(close)}</div>
    </div>
  );
}
