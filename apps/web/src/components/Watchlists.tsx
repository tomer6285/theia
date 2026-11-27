import React, { useId, useRef, useState } from 'react';
import { watchlistItemKey, type MediaItem, type Watchlist } from '@theia/core';
import { useWatchState } from '@theia/ui';
import { HistoryConfirmation } from './HistoryConfirmation';
import styles from './Watchlists.module.css';

function ListNameForm({ action, initialName = '', onSubmit, onCancel }: {
  action: string;
  initialName?: string;
  onSubmit: (name: string) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initialName);
  return (
    <form className={styles.controls} onSubmit={event => {
      event.preventDefault();
      if (!name.trim()) return;
      onSubmit(name);
      setName('');
    }}>
      <input aria-label="List name" placeholder="List name" value={name}
        onChange={event => setName(event.target.value)} />
      <button type="submit" disabled={!name.trim()}>{action}</button>
      {onCancel && <button type="button" onClick={onCancel}>Cancel</button>}
    </form>
  );
}

export function AddToWatchlist({ media }: { media: MediaItem }) {
  const { watchlists, addToWatchlist, createWatchlist } = useWatchState();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const key = watchlistItemKey(media);

  const finish = (name: string) => {
    setMessage(`Added to ${name}.`);
    setOpen(false);
    trigger.current?.focus();
  };

  return (
    <div className={styles.picker}>
      <button type="button" ref={trigger} aria-expanded={open} aria-controls={open ? id : undefined}
        onClick={() => { setOpen(!open); setMessage(''); }}>Add to list</button>
      {open && (
        <div className={styles.panel} id={id} aria-label="Add to list">
          {watchlists.map(list => {
            const added = list.items.some(item => watchlistItemKey(item) === key);
            return <button type="button" key={list.id} disabled={added} onClick={() => {
              addToWatchlist(list.id, media);
              finish(list.name);
            }}>{list.name}{added && ' (added)'}</button>;
          })}
          <ListNameForm action="Create and add" onSubmit={name => {
            if (createWatchlist(name, media)) finish(name.trim());
          }} />
        </div>
      )}
      <span role="status">{message}</span>
    </div>
  );
}

export function Watchlists({ onSelectMedia }: { onSelectMedia: (media: MediaItem) => void }) {
  const { watchlists, createWatchlist } = useWatchState();
  const [selectedId, setSelectedId] = useState('');
  const selected = watchlists.find(list => list.id === selectedId) ?? watchlists[0];

  return (
    <section className={styles.lists} aria-label="Custom lists">
      <ListNameForm action="Create list" onSubmit={name => {
        const id = createWatchlist(name);
        if (id) setSelectedId(id);
      }} />
      {selected ? (
        <>
          <label className={styles.controls}>List
            <select value={selected.id} onChange={event => setSelectedId(event.target.value)}>
              {watchlists.map(list => <option key={list.id} value={list.id}>{list.name}</option>)}
            </select>
          </label>
          <ListContents key={selected.id} list={selected} onSelectMedia={onSelectMedia} />
        </>
      ) : <p>Create a list to start organizing your movies and shows.</p>}
    </section>
  );
}

function ListContents({ list, onSelectMedia }: { list: Watchlist; onSelectMedia: (media: MediaItem) => void }) {
  const { watchlists, renameWatchlist, deleteWatchlist, reorderWatchlist, moveBetweenWatchlists, removeFromWatchlist } = useWatchState();
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [moving, setMoving] = useState<string>();
  const [dropTarget, setDropTarget] = useState<string>();
  const [notice, setNotice] = useState('');
  const dragging = useRef<number>();
  const destinations = watchlists.filter(other => other.id !== list.id);

  function reorder(media: MediaItem, target: string) {
    const key = watchlistItemKey(media);
    if (key === target) return;
    const position = list.items.findIndex(item => watchlistItemKey(item) === target);
    if (position < 0) return;
    reorderWatchlist(list.id, key, target);
    setNotice(`${media.title} moved to position ${position + 1}.`);
  }

  function targetAt(event: React.PointerEvent) {
    return document.elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-watchlist-item]')?.dataset.watchlistItem;
  }

  return (
    <>
      <div className={styles.controls}>
        <h2>{list.name}</h2>
        <button type="button" onClick={() => setRenaming(true)}>Rename</button>
        <button type="button" onClick={() => setDeleting(true)}>Delete list</button>
      </div>
      {renaming && <ListNameForm action="Save name" initialName={list.name} onCancel={() => setRenaming(false)}
        onSubmit={name => { renameWatchlist(list.id, name); setRenaming(false); }} />}
      {!list.items.length && <p>Add a movie or show from its detail page.</p>}
      <ol className={styles.items}>
        {list.items.map((media, index) => {
          const key = watchlistItemKey(media);
          return (
            <li key={key} data-watchlist-item={key} className={dropTarget === key ? styles.dropTarget : undefined}>
              <div className={styles.row}>
                <span aria-hidden="true" className={styles.handle}
                  onPointerDown={event => {
                    if (event.button !== 0 || dragging.current !== undefined) return;
                    dragging.current = event.pointerId;
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setDropTarget(key);
                  }}
                  onPointerMove={event => {
                    if (dragging.current === event.pointerId) setDropTarget(targetAt(event));
                  }}
                  onPointerUp={event => {
                    if (dragging.current !== event.pointerId) return;
                    const target = targetAt(event);
                    dragging.current = undefined;
                    setDropTarget(undefined);
                    if (target) reorder(media, target);
                  }}
                  onLostPointerCapture={() => { dragging.current = undefined; setDropTarget(undefined); }}>☰</span>
                <button type="button" className={styles.title} onClick={() => onSelectMedia(media)}>
                  {media.poster && <img src={media.poster} alt="" loading="lazy" />}
                  <span>{media.title}{media.year && <small>{media.year}</small>}</span>
                </button>
                <div className={styles.controls}>
                  <button type="button" aria-label={`Move ${media.title} up`} disabled={index === 0}
                    onClick={() => reorder(media, watchlistItemKey(list.items[index - 1]))}>↑</button>
                  <button type="button" aria-label={`Move ${media.title} down`} disabled={index === list.items.length - 1}
                    onClick={() => reorder(media, watchlistItemKey(list.items[index + 1]))}>↓</button>
                  {destinations.length > 0 && <button type="button" aria-label={`Move ${media.title} to another list`}
                    aria-expanded={moving === key} onClick={() => setMoving(moving === key ? undefined : key)}>Move to…</button>}
                  <button type="button" aria-label={`Remove ${media.title} from ${list.name}`}
                    onClick={() => { removeFromWatchlist(list.id, key); setNotice(`Removed ${media.title}.`); }}>Remove</button>
                </div>
              </div>
              {moving === key && destinations.length > 0 && <div className={styles.controls} role="group" aria-label="Destination list">
                {destinations.map(destination => <button type="button" key={destination.id} onClick={() => {
                  moveBetweenWatchlists(list.id, destination.id, key);
                  setMoving(undefined);
                  setNotice(`Moved ${media.title} to ${destination.name}.`);
                }}>{destination.name}</button>)}
              </div>}
            </li>
          );
        })}
      </ol>
      <div role="status">{notice}</div>
      {deleting && <HistoryConfirmation title="Delete list?" action="Delete list" onCancel={() => setDeleting(false)}
        onConfirm={() => deleteWatchlist(list.id)}>Delete “{list.name}” and its saved titles?</HistoryConfirmation>}
    </>
  );
}
