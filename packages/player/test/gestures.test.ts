import { afterEach, expect, it, vi } from 'vitest';
import type { PointerEvent } from 'react';
import { GestureCoordinator } from '../src/gestures/coordinator';
const bounds = { left: 0, top: 0, width: 1000, height: 500 } as DOMRect;
const pointer = (x: number, y: number) => ({ clientX: x, clientY: y }) as PointerEvent<HTMLDivElement>;
const callbacks = () => ({ onToggleHUD: vi.fn(), onSeekDelta: vi.fn(), onBrightnessChange: vi.fn(),
  onVolumeChange: vi.fn(), onScrubUpdate: vi.fn(), onDoubleTapSeek: vi.fn(), onAspectCycle: vi.fn() });
afterEach(() => vi.useRealTimers());
it('uses the gesture start volume rather than compounding movement updates', () => {
  const options = callbacks();
  const coordinator = new GestureCoordinator(options);
  coordinator.handlePointerDown(pointer(900, 250), bounds, 50, 50);
  coordinator.handlePointerMove(pointer(900, 200), bounds, 50, 50, 100);
  coordinator.handlePointerMove(pointer(900, 150), bounds, 50, 60, 100);
  expect(options.onVolumeChange.mock.calls.map(([value]) => value)).toEqual([60, 70]);
});
it('double taps do not toggle the HUD and cleanup cancels pending taps', () => {
  vi.useFakeTimers();
  const options = callbacks();
  const coordinator = new GestureCoordinator(options);
  coordinator.handlePointerDown(pointer(900, 250), bounds, 100, 100);
  coordinator.handlePointerUp(pointer(900, 250), bounds);
  vi.advanceTimersByTime(250);
  coordinator.handlePointerDown(pointer(900, 250), bounds, 100, 100);
  coordinator.handlePointerUp(pointer(900, 250), bounds);
  vi.advanceTimersByTime(400);
  expect(options.onDoubleTapSeek).toHaveBeenCalledWith('forward');
  expect(options.onToggleHUD).not.toHaveBeenCalled();
  coordinator.handlePointerDown(pointer(500, 250), bounds, 100, 100);
  coordinator.handlePointerUp(pointer(500, 250), bounds);
  coordinator.dispose();
  vi.advanceTimersByTime(400);
  expect(options.onToggleHUD).not.toHaveBeenCalled();
});
