import type { PointerEvent } from 'react';

export interface GesturePointerCoords { x: number; y: number; time: number }
export type DragMode = 'none' | 'left-brightness' | 'right-volume' | 'center-scrub';

export class GestureCoordinator {
  private startPoint: GesturePointerCoords | null = null;
  private dragMode: DragMode = 'none';
  private startBrightness = 100;
  private startVolume = 100;
  private scrubOffset: number | null = null;
  private lastTapTime = 0;
  private lastTapX = 0;
  private tapTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private options: {
    onToggleHUD: () => void;
    onSeekDelta: (deltaSeconds: number) => void;
    onBrightnessChange: (brightness: number) => void;
    onVolumeChange: (volume: number) => void;
    onScrubUpdate: (offsetSeconds: number | null) => void;
    onDoubleTapSeek: (direction: 'forward' | 'backward') => void;
    onAspectCycle: () => void;
  }) {}

  dispose() {
    clearTimeout(this.tapTimer);
    this.cancel();
  }

  cancel() {
    this.startPoint = null;
    this.dragMode = 'none';
    this.scrubOffset = null;
    this.options.onScrubUpdate(null);
  }

  handlePointerDown(e: PointerEvent<HTMLDivElement>, bounds: DOMRect, brightness: number, volume: number) {
    if (bounds.width <= 0 || bounds.height <= 0) return;
    const x = e.clientX - bounds.left;
    this.startPoint = { x, y: e.clientY - bounds.top, time: Date.now() };
    this.startBrightness = brightness;
    this.startVolume = volume;
    this.scrubOffset = null;
    this.dragMode = x / bounds.width < 0.35 ? 'left-brightness'
      : x / bounds.width > 0.65 ? 'right-volume' : 'center-scrub';
  }

  handlePointerMove(e: PointerEvent<HTMLDivElement>, bounds: DOMRect, _brightness: number, _volume: number, duration: number) {
    if (!this.startPoint || bounds.height <= 0 || bounds.width <= 0) return;
    const dx = e.clientX - bounds.left - this.startPoint.x;
    const dy = e.clientY - bounds.top - this.startPoint.y;
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
    if (this.dragMode === 'center-scrub' && duration > 0 && Math.abs(dx) > Math.abs(dy)) {
      this.scrubOffset = Math.round(dx / bounds.width * 90);
      this.options.onScrubUpdate(this.scrubOffset);
    } else if (Math.abs(dy) > Math.abs(dx)) {
      const start = this.dragMode === 'left-brightness' ? this.startBrightness : this.startVolume;
      const value = Math.max(0, Math.min(100, Math.round(start - dy / bounds.height * 100)));
      if (this.dragMode === 'left-brightness') this.options.onBrightnessChange(value);
      if (this.dragMode === 'right-volume') this.options.onVolumeChange(value);
    }
  }

  handlePointerUp(e: PointerEvent<HTMLDivElement>, bounds: DOMRect, _offset?: number | null) {
    if (!this.startPoint) return;
    const x = e.clientX - bounds.left;
    const y = e.clientY - bounds.top;
    const now = Date.now();
    if (this.scrubOffset !== null) this.options.onSeekDelta(this.scrubOffset);
    if (Math.abs(x - this.startPoint.x) < 10 && Math.abs(y - this.startPoint.y) < 10
      && now - this.startPoint.time < 300) {
      if (this.lastTapTime > 0 && now - this.lastTapTime < 320 && Math.abs(x - this.lastTapX) < 80) {
        clearTimeout(this.tapTimer);
        if (x / bounds.width < 0.3) this.options.onDoubleTapSeek('backward');
        else if (x / bounds.width > 0.7) this.options.onDoubleTapSeek('forward');
        else this.options.onAspectCycle();
        this.lastTapTime = 0;
      } else {
        clearTimeout(this.tapTimer);
        this.lastTapTime = now;
        this.lastTapX = x;
        this.tapTimer = setTimeout(() => {
          this.lastTapTime = 0;
          this.options.onToggleHUD();
        }, 320);
      }
    }
    this.cancel();
  }
}
