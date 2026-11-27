import React, { useState } from 'react';
import { addProfile, DEFAULT_PROFILE_ID, deleteProfile, PROFILE_NAME_LIMIT, renameProfile, selectProfile } from '@theia/core';
import { useWatchState } from '@theia/ui';
import styles from './HouseholdProfiles.module.css';

export function ProfilePicker({ onSelect }: { onSelect: (id: string) => void }) {
  const { profiles } = useWatchState();
  return (
    <main id="main-content" className={styles.picker}>
      <h1>Who’s watching?</h1>
      <div className={styles.choices}>
        {profiles.map(({ id, name }) => (
          <button className={styles.choice} key={id} type="button" onClick={() => onSelect(id)}>
            <span className={styles.initial} aria-hidden="true">{Array.from(name)[0].toLocaleUpperCase()}</span>
            {name}
          </button>
        ))}
      </div>
    </main>
  );
}

export function HouseholdProfiles() {
  const { activeProfileId, profiles } = useWatchState();
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string>();
  const [deletingId, setDeletingId] = useState<string>();

  return (
    <section className={styles.card} aria-labelledby="profiles-heading">
      <h3 id="profiles-heading">Household profiles</h3>
      <ul className={styles.list}>
        {profiles.map(({ id, name }) => (
          <li className={styles.row} key={id}>
            <span>{name}{id === activeProfileId && <small> · Active</small>}</span>
            <div className={styles.actions}>
              {id !== activeProfileId && <button type="button" onClick={() => selectProfile(id)}>Switch to {name}</button>}
              <button type="button" onClick={() => { setEditingId(id); setName(name); }} aria-label={`Rename ${name}`}>Rename</button>
              {id !== DEFAULT_PROFILE_ID && id !== activeProfileId && (
                <button type="button" onClick={() => setDeletingId(id)} aria-label={`Remove ${name}`}>Remove</button>
              )}
            </div>
            {deletingId === id && (
              <div className={styles.confirmation}>
                <p>Remove {name} and their saved viewing data from this device?</p>
                <div className={styles.actions}>
                  <button type="button" onClick={() => { deleteProfile(id); setDeletingId(undefined); if (editingId === id) { setEditingId(undefined); setName(''); } }}>Remove profile</button>
                  <button type="button" onClick={() => setDeletingId(undefined)}>Cancel</button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      <form className={styles.actions} onSubmit={(event) => {
        event.preventDefault();
        if (editingId) renameProfile(editingId, name);
        else addProfile(name);
        setEditingId(undefined);
        setName('');
      }}>
        <label className={styles.field}>
          {editingId ? 'New profile name' : 'Profile name'}
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={PROFILE_NAME_LIMIT} required />
        </label>
        <button type="submit" disabled={!name.trim()}>{editingId ? 'Save name' : 'Add profile'}</button>
        {editingId && <button type="button" onClick={() => { setEditingId(undefined); setName(''); }}>Cancel rename</button>}
      </form>
    </section>
  );
}
