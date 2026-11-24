import { clamp, type LandmarkKey } from '../scene/layout.ts';

export type AppMode =
  | 'TITLE_IDLE'
  | 'EXPLORING'
  | 'DIALOGUE'
  | 'WORKS_PICKER'
  | 'INSPECT_CARD'
  | 'ARCHIVE_DRAWER'
  | 'FALLBACK_ARCHIVE';

export type AudioStatus = 'UNSTARTED' | 'PLAYING' | 'MUTED';

export interface MediaQueryLike {
  readonly matches: boolean;
  addEventListener?: (type: 'change', listener: (event: { matches: boolean }) => void) => void;
  removeEventListener?: (type: 'change', listener: (event: { matches: boolean }) => void) => void;
}

export interface AppEnvironment {
  matchMedia?: (query: string) => MediaQueryLike;
  now?: () => number;
}

export interface AppState {
  mode: AppMode;
  previousMode: AppMode;
  audioStatus: AudioStatus;
  heroT: number;
  facingDir: -1 | 1;
  walkTargetT: number | null;
  pendingInteractKey: LandmarkKey | null;
  activeLandmarkKey: LandmarkKey | null;
  dialoguePageIndex: number;
  dialogueRevealed: boolean;
  pickerIndex: number;
  activeWorkId: string | null;
  reducedMotion: boolean;
  whisperVisible: boolean;
}

export type AppStateListener = (state: Readonly<AppState>) => void;

export interface AppStateController {
  getState: () => Readonly<AppState>;
  now: () => number;
  subscribe: (listener: AppStateListener) => () => void;
  wakeAudioFromIdle: () => void;
  startKeyboardExplore: () => void;
  setWalkTarget: (targetT: number, pendingInteractKey?: LandmarkKey | null) => void;
  cancelWalkTarget: () => void;
  setHeroPosition: (t: number, facingDir?: -1 | 1) => void;
  clearWalkTargetOnArrival: () => LandmarkKey | null;
  toggleMute: () => AudioStatus;
  openArchive: () => void;
  closeArchive: () => void;
  enterFallbackArchive: () => void;
  openLandmark: (landmarkKey: LandmarkKey) => void;
  revealDialogueLine: () => void;
  advanceDialoguePage: (totalPages: number, enterPickerOnEnd?: boolean) => void;
  setPickerIndex: (index: number) => void;
  selectWork: (workId: string) => void;
  openInspect: () => void;
  closeInspect: () => void;
  closeDialogueToExplore: () => void;
  dispose: () => void;
}

function defaultMatchMedia(query: string): MediaQueryLike {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia(query);
  }
  return { matches: false };
}

export function createAppState(env: AppEnvironment = {}): AppStateController {
  const matchMediaFn = env.matchMedia ?? defaultMatchMedia;
  const nowFn = env.now ?? (() => Date.now());
  const media = matchMediaFn('(prefers-reduced-motion: reduce)');

  const state: AppState = {
    mode: 'TITLE_IDLE',
    previousMode: 'EXPLORING',
    audioStatus: 'UNSTARTED',
    heroT: 0.5,
    facingDir: -1,
    walkTargetT: null,
    pendingInteractKey: null,
    activeLandmarkKey: null,
    dialoguePageIndex: 0,
    dialogueRevealed: false,
    pickerIndex: 0,
    activeWorkId: null,
    reducedMotion: Boolean(media.matches),
    whisperVisible: true,
  };

  const listeners = new Set<AppStateListener>();
  const notify = (): void => {
    const snapshot = { ...state };
    for (const listener of listeners) {
      listener(snapshot);
    }
  };

  const onMotionChange = (event: { matches: boolean }): void => {
    if (state.reducedMotion !== event.matches) {
      state.reducedMotion = event.matches;
      notify();
    }
  };
  media.addEventListener?.('change', onMotionChange);

  return {
    getState: () => ({ ...state }),
    now: nowFn,
    subscribe(listener) {
      listeners.add(listener);
      listener({ ...state });
      return () => {
        listeners.delete(listener);
      };
    },
    wakeAudioFromIdle() {
      if (state.mode === 'FALLBACK_ARCHIVE') {
        return;
      }
      if (state.mode === 'TITLE_IDLE') {
        state.mode = 'EXPLORING';
      }
      state.whisperVisible = false;
      if (state.audioStatus === 'UNSTARTED') {
        state.audioStatus = 'PLAYING';
      }
      notify();
    },
    startKeyboardExplore() {
      if (state.mode !== 'TITLE_IDLE') {
        return;
      }
      state.mode = 'EXPLORING';
      state.whisperVisible = false;
      notify();
    },
    setWalkTarget(targetT, pendingInteractKey = null) {
      if (state.mode !== 'EXPLORING') {
        return;
      }
      state.walkTargetT = clamp(targetT, 0, 1);
      state.pendingInteractKey = pendingInteractKey;
      notify();
    },
    cancelWalkTarget() {
      if (state.walkTargetT === null && state.pendingInteractKey === null) {
        return;
      }
      state.walkTargetT = null;
      state.pendingInteractKey = null;
      notify();
    },
    setHeroPosition(t, facingDir) {
      const nextT = clamp(t, 0, 1);
      const nextFacing = facingDir ?? state.facingDir;
      if (nextT === state.heroT && nextFacing === state.facingDir) {
        return;
      }
      state.heroT = nextT;
      state.facingDir = nextFacing;
      notify();
    },
    clearWalkTargetOnArrival() {
      const arrivedKey = state.pendingInteractKey;
      state.walkTargetT = null;
      state.pendingInteractKey = null;
      notify();
      return arrivedKey;
    },
    toggleMute() {
      if (state.audioStatus === 'UNSTARTED') {
        state.audioStatus = 'MUTED';
      } else if (state.audioStatus === 'PLAYING') {
        state.audioStatus = 'MUTED';
      } else {
        state.audioStatus = 'PLAYING';
      }
      notify();
      return state.audioStatus;
    },
    openArchive() {
      if (state.mode === 'FALLBACK_ARCHIVE' || state.mode === 'ARCHIVE_DRAWER') {
        return;
      }
      state.previousMode = state.mode;
      state.mode = 'ARCHIVE_DRAWER';
      notify();
    },
    closeArchive() {
      if (state.mode !== 'ARCHIVE_DRAWER') {
        return;
      }
      state.mode = state.previousMode;
      notify();
    },
    enterFallbackArchive() {
      if (state.mode === 'FALLBACK_ARCHIVE') {
        return;
      }
      state.mode = 'FALLBACK_ARCHIVE';
      state.whisperVisible = false;
      state.walkTargetT = null;
      state.pendingInteractKey = null;
      notify();
    },
    openLandmark(landmarkKey) {
      if (state.mode === 'FALLBACK_ARCHIVE') {
        return;
      }
      state.mode = 'DIALOGUE';
      state.activeLandmarkKey = landmarkKey;
      state.dialoguePageIndex = 0;
      state.dialogueRevealed = state.reducedMotion;
      state.activeWorkId = null;
      state.pickerIndex = 0;
      state.walkTargetT = null;
      state.pendingInteractKey = null;
      notify();
    },
    revealDialogueLine() {
      if (state.mode !== 'DIALOGUE' || state.dialogueRevealed) {
        return;
      }
      state.dialogueRevealed = true;
      notify();
    },
    advanceDialoguePage(totalPages, enterPickerOnEnd = false) {
      if (state.mode !== 'DIALOGUE') {
        return;
      }
      if (state.dialoguePageIndex + 1 < totalPages) {
        state.dialoguePageIndex += 1;
        state.dialogueRevealed = state.reducedMotion;
        notify();
        return;
      }
      if (enterPickerOnEnd && state.activeLandmarkKey === 'works') {
        state.mode = 'WORKS_PICKER';
        state.activeWorkId = null;
        state.dialoguePageIndex = 0;
        state.dialogueRevealed = state.reducedMotion;
        notify();
        return;
      }
      state.mode = 'EXPLORING';
      state.activeLandmarkKey = null;
      state.activeWorkId = null;
      state.dialoguePageIndex = 0;
      state.dialogueRevealed = false;
      notify();
    },
    setPickerIndex(index) {
      if (state.mode !== 'WORKS_PICKER') {
        return;
      }
      state.pickerIndex = Math.max(0, index);
      notify();
    },
    selectWork(workId) {
      if (state.mode !== 'WORKS_PICKER') {
        return;
      }
      state.activeWorkId = workId;
      state.mode = 'DIALOGUE';
      state.dialoguePageIndex = 0;
      state.dialogueRevealed = state.reducedMotion;
      notify();
    },
    openInspect() {
      if (state.mode !== 'DIALOGUE' || state.activeWorkId === null) {
        return;
      }
      state.mode = 'INSPECT_CARD';
      notify();
    },
    closeInspect() {
      if (state.mode !== 'INSPECT_CARD') {
        return;
      }
      state.mode = 'WORKS_PICKER';
      state.activeWorkId = null;
      notify();
    },
    closeDialogueToExplore() {
      if (state.mode === 'FALLBACK_ARCHIVE' || state.mode === 'ARCHIVE_DRAWER') {
        return;
      }
      state.mode = 'EXPLORING';
      state.activeLandmarkKey = null;
      state.activeWorkId = null;
      state.dialoguePageIndex = 0;
      state.dialogueRevealed = false;
      notify();
    },
    dispose() {
      media.removeEventListener?.('change', onMotionChange);
      listeners.clear();
    },
  };
}
