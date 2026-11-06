// @vitest-environment jsdom
import React, { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TouchSlider, TouchSwitch, MediaCard, SearchBar, SubtitleStepper } from '../src';

afterEach(cleanup);

describe('accessible controls', () => {
  it('toggles switches with the keyboard and respects disabled state', async () => {
    const change = vi.fn();
    const { rerender } = render(<TouchSwitch checked={false} label="Auto-play" onChange={change} />);
    const user = userEvent.setup();
    await user.tab();
    await user.keyboard(' ');
    expect(change).toHaveBeenCalledWith(true);
    rerender(<TouchSwitch checked={false} label="Auto-play" onChange={change} disabled />);
    await user.click(screen.getByRole('switch'));
    expect(change).toHaveBeenCalledTimes(1);
  });
  it('supports arrow keys, Home and End on sliders', () => {
    const change = vi.fn();
    render(<TouchSlider label="Subtitle delay" value={50} min={-100} max={100} step={50} onChange={change} />);
    const slider = screen.getByRole('slider', { name: 'Subtitle delay' });
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(change).toHaveBeenLastCalledWith(100);
    fireEvent.keyDown(slider, { key: 'Home' });
    expect(change).toHaveBeenLastCalledWith(-100);
    fireEvent.keyDown(slider, { key: 'End' });
    expect(change).toHaveBeenLastCalledWith(100);
  });
  it('opens media with the keyboard and keeps favorite clicks separate', async () => {
    const open = vi.fn();
    const favorite = vi.fn();
    render(<MediaCard media={{ id: 'tt1', title: 'Example', type: 'movie' }} onPress={open} onToggleFavorite={favorite} />);
    const user = userEvent.setup();
    await user.tab();
    await user.keyboard('{Enter}');
    expect(open).toHaveBeenCalledTimes(1);
    await user.tab();
    await user.keyboard('{Enter}');
    expect(favorite).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledTimes(1);
  });
  it('does not restart search debounce when its parent rerenders', async () => {
    vi.useFakeTimers();
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<SearchBar onSearch={first} debounceMs={300} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'test' } });
    await vi.advanceTimersByTimeAsync(200);
    rerender(<SearchBar onSearch={second} debounceMs={300} />);
    await vi.advanceTimersByTimeAsync(100);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith('test');
    vi.useRealTimers();
  });
  it('traps dialog focus, closes with Escape, and restores focus', async () => {
    const Demo = () => {
      const [open, setOpen] = useState(false);
      return <><button onClick={() => setOpen(true)}>Subtitles</button>
        <SubtitleStepper isOpen={open} onClose={() => setOpen(false)} offsetMs={0} onOffsetChange={() => {}} /></>;
    };
    render(<Demo />);
    const user = userEvent.setup();
    const trigger = screen.getByRole('button', { name: 'Subtitles' });
    await user.click(trigger);
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).toBe('');
  });
});
