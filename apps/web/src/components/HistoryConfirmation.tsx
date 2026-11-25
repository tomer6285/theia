import React, { useId } from 'react';
import { createPortal } from 'react-dom';
import { useModal } from '@theia/ui';
import styles from './HistoryCard.module.css';

export function HistoryConfirmation({ title, children, action, onCancel, onConfirm }: {
  title: string;
  children: React.ReactNode;
  action: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const id = useId();
  const dialogRef = useModal(true, onCancel);
  return createPortal(
    <div className={styles.backdrop}>
      <div ref={dialogRef} className={styles.dialog} role="alertdialog" aria-modal="true"
        aria-labelledby={id} aria-describedby={`${id}-description`} tabIndex={-1}>
        <h2 id={id}>{title}</h2>
        <p id={`${id}-description`}>{children}</p>
        <div className={styles.actions}>
          <button type="button" onClick={onCancel}>Cancel</button>
          <button type="button" className={styles.remove} onClick={onConfirm}>{action}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
