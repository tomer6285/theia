// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { DefaultStorageAdapter, setStorageAdapter } from '@theia/core';
import { LibraryView } from '../src/components/LibraryView';
import { AddToWatchlist } from '../src/components/Watchlists';

afterEach(() => { cleanup(); localStorage.clear(); });

it('creates a list from a title, reorders it, and moves a title through Library', async () => {
  await setStorageAdapter(new DefaultStorageAdapter());
  const first = { id: 'tt1', title: 'First movie', type: 'movie' as const };
  const second = { id: 'tt2', title: 'Second movie', type: 'movie' as const };
  const picker = render(<AddToWatchlist media={first} />);
  fireEvent.click(screen.getByRole('button', { name: 'Add to list' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'List name' }), { target: { value: 'Weekend movies' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create and add' }));
  expect(screen.getByRole('status').textContent).toBe('Added to Weekend movies.');
  picker.rerender(<AddToWatchlist key={second.id} media={second} />);
  fireEvent.click(screen.getByRole('button', { name: 'Add to list' }));
  fireEvent.click(screen.getByRole('button', { name: 'Weekend movies' }));
  picker.unmount();

  const selectMedia = vi.fn();
  render(<LibraryView onSelectMedia={selectMedia} />);
  fireEvent.click(screen.getByRole('button', { name: 'Lists' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'List name' }), { target: { value: 'Watch with friends' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create list' }));

  const list = screen.getByRole<HTMLSelectElement>('combobox', { name: 'List' });
  fireEvent.change(list, { target: { value: screen.getByRole<HTMLOptionElement>('option', { name: 'Weekend movies' }).value } });
  fireEvent.click(screen.getByRole('button', { name: 'Move Second movie up' }));
  expect(within(screen.getAllByRole('listitem')[0]).getByRole('button', { name: 'Second movie' })).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: 'Move Second movie to another list' }));
  fireEvent.click(screen.getByRole('button', { name: 'Watch with friends' }));
  expect(screen.queryByRole('button', { name: 'Second movie' })).toBeNull();
  fireEvent.change(list, { target: { value: screen.getByRole<HTMLOptionElement>('option', { name: 'Watch with friends' }).value } });
  fireEvent.click(screen.getByRole('button', { name: 'Second movie' }));
  expect(selectMedia).toHaveBeenCalledWith(second);
}, 15_000);
