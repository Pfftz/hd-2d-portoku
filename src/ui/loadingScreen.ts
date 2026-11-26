import type { LoadProgress, LoadTracker } from '../assets/loadTracker.ts';

export interface LoadingScreenOptions {
  root: HTMLElement;
  tracker: LoadTracker;
  isReducedMotion: () => boolean;
  onContinue: () => void;
  timeoutMs?: number;
}

export interface LoadingScreenHandle {
  isActive: () => boolean;
  dispose: () => void;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const FADE_DURATION_MS = 700;

/** Blocks scene reveal until loaded assets settle, then gates entry behind a gesture. */
export function createLoadingScreen(options: LoadingScreenOptions): LoadingScreenHandle {
  const { root, tracker, isReducedMotion, onContinue, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  let active = true;
  let ready = false;
  let disposed = false;
  let rafIdA = 0;
  let rafIdB = 0;
  let fadeTimer: number | null = null;

  root.replaceChildren();
  root.removeAttribute('style');
  root.id = 'loading-screen';
  root.setAttribute('role', 'status');
  root.setAttribute('aria-live', 'polite');
  root.setAttribute('aria-busy', 'true');

  const panel = document.createElement('div');
  panel.className = 'loading-panel';

  const label = document.createElement('p');
  label.className = 'loading-label';
  label.textContent = 'Preparing the hillside...';

  const bar = document.createElement('div');
  bar.className = 'loading-bar';
  const barFill = document.createElement('div');
  barFill.className = 'loading-bar-fill';
  barFill.style.width = '0%';
  bar.append(barFill);

  const continueBtn = document.createElement('button');
  continueBtn.type = 'button';
  continueBtn.className = 'jrpg-btn loading-continue';
  continueBtn.textContent = 'Click anywhere to begin';
  continueBtn.hidden = true;

  panel.append(label, bar, continueBtn);
  root.append(panel);

  const revealReady = (): void => {
    if (disposed || ready || !active) {
      return;
    }
    ready = true;

    const schedulePaintReady = (): void => {
      rafIdA = window.requestAnimationFrame(() => {
        rafIdB = window.requestAnimationFrame(() => {
          if (disposed || !active) {
            return;
          }
          root.setAttribute('aria-busy', 'false');
          label.textContent = 'Hillside ready';
          barFill.style.width = '100%';
          continueBtn.hidden = false;
          continueBtn.focus();
        });
      });
    };

    schedulePaintReady();
  };

  const updateProgress = (progress: LoadProgress): void => {
    if (disposed || !active) {
      return;
    }
    const pct = progress.total > 0 ? Math.round((progress.settled / progress.total) * 100) : 0;
    barFill.style.width = `${Math.min(100, Math.max(0, pct))}%`;
    if (progress.ready) {
      revealReady();
    }
  };

  const handleContinue = (event: Event): void => {
    event.stopPropagation();
    if (disposed || !active || !ready) {
      return;
    }
    active = false;
    cleanupListeners();
    onContinue();

    if (isReducedMotion()) {
      dispose();
      return;
    }

    root.classList.add('is-leaving');
    const onFadeDone = (): void => {
      dispose();
    };
    root.addEventListener('transitionend', onFadeDone, { once: true });
    fadeTimer = window.setTimeout(onFadeDone, FADE_DURATION_MS + 60);
  };

  const stopEarlyPointer = (event: Event): void => {
    event.stopPropagation();
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (!active || !ready) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleContinue(event);
    }
  };

  const safetyTimer = window.setTimeout(() => {
    revealReady();
  }, timeoutMs);

  const unsubscribe = tracker.subscribe(updateProgress);

  root.addEventListener('pointerdown', stopEarlyPointer);
  root.addEventListener('pointerup', handleContinue);
  continueBtn.addEventListener('click', handleContinue);
  window.addEventListener('keydown', onKeyDown);

  function cleanupListeners(): void {
    unsubscribe();
    window.clearTimeout(safetyTimer);
    window.cancelAnimationFrame(rafIdA);
    window.cancelAnimationFrame(rafIdB);
    root.removeEventListener('pointerdown', stopEarlyPointer);
    root.removeEventListener('pointerup', handleContinue);
    continueBtn.removeEventListener('click', handleContinue);
    window.removeEventListener('keydown', onKeyDown);
  }

  function dispose(): void {
    if (disposed) {
      return;
    }
    disposed = true;
    active = false;
    cleanupListeners();
    if (fadeTimer !== null) {
      window.clearTimeout(fadeTimer);
      fadeTimer = null;
    }
    root.hidden = true;
    root.replaceChildren();
  }

  return {
    isActive: () => active && !disposed,
    dispose,
  };
}
