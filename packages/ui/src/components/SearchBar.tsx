import React, { useState, useEffect, useRef } from 'react';
import { colors } from '../theme/colors';

export interface SearchBarProps {
  placeholder?: string;
  onSearch: (query: string) => void;
  debounceMs?: number;
  initialValue?: string;
  onFocus?: () => void;
  onBlur?: () => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = 'Search movies, series, anime...',
  onSearch,
  debounceMs = 300,
  initialValue = '',
  onFocus,
  onBlur,
}) => {
  const [query, setQuery] = useState(initialValue);
  const [isFocused, setIsFocused] = useState(false);

  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;
  useEffect(() => { setQuery(initialValue); }, [initialValue]);
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchRef.current(query);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, debounceMs]);

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        height: 50,
        borderRadius: 16,
        backgroundColor: colors.bg.elevated,
        border: `1.5px solid ${isFocused ? colors.accent.primary : colors.border.subtle}`,
        boxShadow: isFocused ? `0 0 16px ${colors.accent.primary}33` : '0 2px 8px rgba(0,0,0,0.3)',
        padding: '0 16px',
        boxSizing: 'border-box',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        touchAction: 'manipulation',
      }}
    >
      <span
        style={{
          fontSize: '18px',
          color: isFocused ? colors.accent.primary : colors.text.muted,
          marginRight: 12,
          userSelect: 'none',
          display: 'flex',
          alignItems: 'center',
          transition: 'color 0.2s ease',
        }}
      >
        🔍
      </span>

      <input
        className="theia-search-input"
        type="search"
        aria-label={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => {
          setIsFocused(true);
          onFocus?.();
        }}
        onBlur={() => {
          setIsFocused(false);
          onBlur?.();
        }}
        placeholder={placeholder}
        style={{
          flex: 1,
          minWidth: 0,
          height: '100%',
          background: 'transparent',
          border: 'none',
          color: colors.text.primary,
          fontSize: '16px', // 16px prevents iOS safari auto-zoom on input focus!
          outline: 'none',
          WebkitAppearance: 'none',
        }}
      />

      {query.length > 0 && (
        <button
          type="button"
          onClick={() => {
            setQuery('');
            onSearch('');
          }}
          style={{
            background: colors.border.subtle,
            border: 'none',
            color: colors.text.primary,
            width: 32,
            height: 32,
            borderRadius: 16,
            fontSize: '16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            userSelect: 'none',
            WebkitTapHighlightColor: 'transparent',
            touchAction: 'manipulation',
            marginLeft: 8,
          }}
          aria-label="Clear search"
        >
          ✕
        </button>
      )}
    </div>
  );
};
