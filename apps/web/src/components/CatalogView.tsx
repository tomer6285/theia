import React, { useEffect, useState } from 'react';
import { cinemeta, MediaItem, MediaType, theiaStore } from '@theia/core';
import { MediaCard, SearchBar, TouchPill, useWatchState } from '@theia/ui';

interface CatalogViewProps {
  type: MediaType;
  onSelectMedia: (media: MediaItem) => void;
  onQuickPlay?: (media: MediaItem) => void;
}

export function CatalogView({ type, onSelectMedia, onQuickPlay }: CatalogViewProps) {
  useWatchState();
  const [query, setQuery] = useState('');
  const [popular, setPopular] = useState<MediaItem[]>([]);
  const [more, setMore] = useState<MediaItem[]>([]);
  const [results, setResults] = useState<MediaItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const title = type === 'movie' ? 'Movies' : 'Shows';
  const searching = Boolean(query.trim());

  useEffect(() => {
    let active = true;
    setCatalogLoading(true);
    void Promise.all([cinemeta.getPopular(type), cinemeta.getPopular(type, 20)]).then(([first, second]) => {
      if (!active) return;
      setPopular(first);
      const ids = new Set(first.map((item) => item.id));
      setMore(second.filter((item) => !ids.has(item.id)));
      setCatalogLoading(false);
    });
    return () => { active = false; };
  }, [type, attempt]);

  useEffect(() => {
    let active = true;
    setSearchLoading(searching);
    setResults([]);
    if (searching) void cinemeta.search(query, type).then((items) => {
      if (active) { setResults(items); setSearchLoading(false); }
    });
    return () => { active = false; };
  }, [query, type, attempt]);

  const card = (item: MediaItem, rail = false) => <MediaCard key={item.id} media={item}
    width={rail ? 160 : '100%'} onPress={() => onSelectMedia(item)} onQuickPlay={onQuickPlay}
    progress={theiaStore.getState().getProgress(item.id)}
    isFavorite={theiaStore.getState().isFavorite(item.id)}
    onToggleFavorite={() => theiaStore.getState().toggleFavorite(item)} />;
  const rail = (label: string, items: MediaItem[]) => items.length > 0 && <section className="catalog-section">
    <h2>{label}</h2>
    <div className="touch-scroll-row catalog-rail">{items.map((item) => card(item, true))}</div>
  </section>;
  const loading = searching ? searchLoading : catalogLoading;

  return <div className="catalog-view">
    <header><p className="eyebrow">EXPLORE THEIA</p><h1>{title}</h1>
      <p className="view-description">{type === 'movie' ? 'A new favorite is waiting to be found.' : 'Discover your next great series.'}</p>
    </header>
    <SearchBar initialValue={query} onSearch={setQuery} placeholder={`Search ${title.toLowerCase()}…`} />
    <div aria-live="polite" aria-busy={loading}>
      {loading ? <div className="loading-state" role="status"><span className="loading-spinner" />Loading {searching ? 'results' : title.toLowerCase()}…</div>
        : searching ? <section className="catalog-section"><h2>Results <span className="result-count">{results.length}</span></h2>
          {results.length ? <div className="media-grid">{results.map((item) => card(item))}</div>
            : <div className="empty-state"><h3>No matches found</h3><p>Try another title or check your connection.</p>
              <TouchPill label="Try again" onClick={() => setAttempt(attempt + 1)} /></div>}
        </section>
        : popular.length || more.length ? <>{rail(`Popular ${title.toLowerCase()}`, popular)}{rail('More to explore', more)}</>
          : <div className="empty-state"><h3>Couldn’t load the catalog</h3><p>Check your connection and try again.</p>
            <TouchPill label="Reload catalog" onClick={() => setAttempt(attempt + 1)} /></div>}
    </div>
  </div>;
}
