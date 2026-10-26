import { AspectRatioMode } from '../types';

export interface GesturePointerCoords {
  x: number;
  y: number;
  time: number;
}

export type DragMode = 'none' | 'left-brightness' | 'right-volume' | 'center-scrub';

export class GestureCoordinator {
  private startPoint: GesturePointerCoords | null = null;
  private currentPoint: GesturePointerCoords | null = null;
  private dragMode: DragMode = 'none';
  private lastTapTime = 0;
  private lastTapX = 0;
  private hudHideTimer: any = null;

  constructor(
    private options: {
      onToggleHUD: () => void;
      onSeekDelta: (deltaSeconds: number) => void;
      onBrightnessChange: (brightness: number) => void;
      onVolumeChange: (volume: number) => void;
      onScrubUpdate: (offsetSeconds: number | null) => void;
      onDoubleTapSeek: (direction: 'forward' | 'backward') => void;
      onAspectCycle: () => void;
    }
  ) {}

  resetHUDTimer(delayMs = 4000) {
    if (this.hudHideTimer) {
      clearTimeout(this.hudHideTimer);
    }
    this.hudHideTimer = setTimeout(() => {
      this.options.onToggleHUD();
    }, delayMs);
  }

  clearHUDTimer() {
    if (this.hudHideTimer) {
      clearTimeout(this.hudHideTimer);
      this.hudHideTimer = null;
    }
  }

  handlePointerDown(
    e: React.PointerEvent<HTMLDivElement>,
    bounds: DOMRect,
    currentBrightness: number,
    currentVolume: number
  ) {
    const x = e.clientX - bounds.left;
    const y = e.clientY - bounds.top;
    const now = Date.now();

    this.startPoint = { x, y, time: now };
    this.currentPoint = { x, y, time: now };

    // Determine initial drag mode based on horizontal zones
    const xRatio = x / bounds.width;
    if (xRatio < 0.35) {
      this.dragMode = 'left-brightness';
    } else if (xRatio > 0.65) {
      this.dragMode = 'right-volume';
    } else {
      this.dragMode = 'center-scrub';
    }
  }

  handlePointerMove(
    e: React.PointerEvent<HTMLDivElement>,
    bounds: DOMRect,
    startBrightness: number,
    startVolume: number,
    duration: number
  ) {
    if (!this.startPoint) return;
    const x = e.clientX - bounds.left;
    const y = e.clientY - bounds.top;
    const deltaX = x - this.startPoint.x;
    const deltaY = y - this.startPoint.y;

    // Must exceed movement threshold to be recognized as drag
    if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) return;

    if (this.dragMode === 'left-brightness') {
      // Vertical drag on left: deltaY < 0 is upwards (increase)
      const change = (-deltaY / bounds.height) * 100;
      const newBrightness = Math.max(0, Math.min(100, Math.round(startBrightness + change)));
      this.options.onBrightnessChange(newBrightness);
    } else if (this.dragMode === 'right-volume') {
      // Vertical drag on right
      const change = (-deltaY / bounds.height) * 100;
      const newVolume = Math.max(0, Math.min(100, Math.round(startVolume + change)));
      this.options.onVolumeChange(newVolume);
    } else if (this.dragMode === 'center-scrub') {
      // Horizontal scrub in center
      if (duration > 0) {
        // Scrub sensitivity: screen width = 90 seconds
        const scrubRatio = deltaX / bounds.width;
        const scrubSeconds = Math.round(scrubRatio * 90);
        this.options.onScrubUpdate(scrubSeconds);
      }
    }
  }

  handlePointerUp(
    e: React.PointerEvent<HTMLDivElement>,
    bounds: DOMRect,
    currentScrubOffset: number | null
  ) {
    if (!this.startPoint) return;
    const x = e.clientX - bounds.left;
    const y = e.clientY - bounds.top;
    const deltaX = Math.abs(x - this.startPoint.x);
    const deltaY = Math.abs(y - this.startPoint.y);
    const elapsed = Date.now() - this.startPoint.time;

    // If dragged horizontally in center
    if (this.dragMode === 'center-scrub' && currentScrubOffset !== null && Math.abs(currentScrubOffset) > 0) {
      this.options.onSeekDelta(currentScrubOffset);
      this.options.onScrubUpdate(null);
    }

    // Tap detection (minimal movement within 250ms)
    if (deltaX < 12 && deltaY < 12 && elapsed < 300) {
      const now = Date.now();
      const xRatio = x / bounds.width;

      // Check double-tap
      if (now - this.lastTapTime < 320 && Math.abs(x - this.lastTapX) < 80) {
        if (xRatio < 0.3) {
          // Double-tap left: seek backward 10s
          this.options.onDoubleTapSeek('backward');
        } else if (xRatio > 0.7) {
          // Double-tap right: seek forward 10s
          this.options.onDoubleTapSeek('forward');
        } else {
          // Double-tap center: cycle aspect ratio
          this.options.onAspectCycle();
        }
        this.lastTapTime = 0;
      } else {
        // Single tap
        this.lastTapTime = now;
        this.lastTapX = x;
        setTimeout(() => {
          if (this.lastTapTime === now) {
            this.options.onToggleHUD();
          }
        }, 220);
      }
    }

    this.startPoint = null;
    this.currentPoint = null;
    this.dragMode = 'none';
  }
}
