import React, { useState, useEffect } from 'react';
import { colors } from '../theme/colors';

export interface SearchBarProps {
  placeholder?: string;
  onSearch: (query: string) => void;
  debounceMs?: number;
  initialValue?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = 'Search movies, shows...',
  onSearch,
  debounceMs = 350,
  initialValue = '',
}) => {
  const [query, setQuery] = useState(initialValue);

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(query);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, debounceMs, onSearch]);

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        borderRadius: 14,
        backgroundColor: colors.bg.elevated,
        border: `1px solid ${colors.border.subtle}`,
        padding: '2px 14px',
        boxSizing: 'border-box',
        transition: 'border-color 0.2s ease',
      }}
    >
      <span
        style={{
          fontSize: '18px',
          color: colors.text.muted,
          marginRight: 10,
          userSelect: 'none',
        }}
      >
        🔍
      </span>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1,
          height: 44,
          background: 'transparent',
          border: 'none',
          color: colors.text.primary,
          fontSize: '15px',
          outline: 'none',
        }}
      />
      {query.length > 0 && (
        <button
          type="button"
          onClick={() => setQuery('')}
          style={{
            background: 'transparent',
            border: 'none',
            color: colors.text.muted,
            cursor: 'pointer',
            padding: '6px',
            fontSize: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
};
