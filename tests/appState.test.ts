import { describe, expect, it } from 'vitest';
import { isDragGesture, isRefocusClick } from '../src/input/inputRouter.ts';
import { createAppState, type MediaQueryLike } from '../src/state/appState.ts';

function createMockMediaQuery(initialMatches: boolean): {
  mq: MediaQueryLike;
  emitChange: (matches: boolean) => void;
} {
  let listener: ((event: { matches: boolean }) => void) | undefined;
  let currentMatches = initialMatches;
  return {
    mq: {
      get matches() {
        return currentMatches;
      },
      addEventListener(_type, cb) {
        listener = cb;
      },
      removeEventListener() {
        listener = undefined;
      },
    },
    emitChange(nextMatches) {
      currentMatches = nextMatches;
      listener?.({ matches: nextMatches });
    },
  };
}

describe('input guards', () => {
  it('blocks canvas clicks within 150ms of window focus', () => {
    expect(isRefocusClick(1100, 1000)).toBe(true);
    expect(isRefocusClick(1149, 1000)).toBe(true);
    expect(isRefocusClick(1150, 1000)).toBe(false);
  });

  it('blocks pointerup drags exceeding 8px travel', () => {
    expect(isDragGesture(100, 100, 106, 105)).toBe(false);
    expect(isDragGesture(100, 100, 108, 100)).toBe(false);
    expect(isDragGesture(100, 100, 109, 100)).toBe(true);
  });
});

describe('appState transitions', () => {
  it('handles zero-walk wake click and A/D-first unstarted audio', () => {
    const s1 = createAppState({ matchMedia: () => ({ matches: false }) });
    s1.wakeAudioFromIdle();
    expect(s1.getState().mode).toBe('EXPLORING');
    expect(s1.getState().audioStatus).toBe('PLAYING');
    expect(s1.getState().walkTargetT).toBeNull();
    expect(s1.getState().whisperVisible).toBe(false);

    const s2 = createAppState({ matchMedia: () => ({ matches: false }) });
    s2.startKeyboardExplore();
    expect(s2.getState().mode).toBe('EXPLORING');
    expect(s2.getState().audioStatus).toBe('UNSTARTED');
    expect(s2.getState().whisperVisible).toBe(false);
  });

  it('respects Mute toggled before waking audio', () => {
    const state = createAppState({ matchMedia: () => ({ matches: false }) });
    expect(state.toggleMute()).toBe('MUTED');
    state.wakeAudioFromIdle();
    expect(state.getState().mode).toBe('EXPLORING');
    expect(state.getState().audioStatus).toBe('MUTED');
    expect(state.toggleMute()).toBe('PLAYING');
  });

  it('cancels walkTargetT and pendingInteractKey on keyboard movement and opens on arrival', () => {
    const state = createAppState({ matchMedia: () => ({ matches: false }) });
    state.startKeyboardExplore();
    state.setWalkTarget(0.68, 'works');
    expect(state.getState().walkTargetT).toBe(0.68);
    expect(state.getState().pendingInteractKey).toBe('works');

    state.cancelWalkTarget();
    expect(state.getState().walkTargetT).toBeNull();
    expect(state.getState().pendingInteractKey).toBeNull();

    state.setWalkTarget(0.68, 'works');
    const arrived = state.clearWalkTargetOnArrival();
    expect(arrived).toBe('works');
    if (arrived) {
      state.openLandmark(arrived);
    }
    expect(state.getState().mode).toBe('DIALOGUE');
    expect(state.getState().activeLandmarkKey).toBe('works');
  });

  it('supports DIALOGUE <-> WORKS_PICKER <-> INSPECT_CARD and ARCHIVE_DRAWER restore', () => {
    const state = createAppState({ matchMedia: () => ({ matches: false }) });
    state.openArchive();
    expect(state.getState().mode).toBe('ARCHIVE_DRAWER');
    expect(state.getState().previousMode).toBe('TITLE_IDLE');
    state.closeArchive();
    expect(state.getState().mode).toBe('TITLE_IDLE');

    state.startKeyboardExplore();
    state.openLandmark('works');
    state.revealDialogueLine();
    expect(state.getState().dialogueRevealed).toBe(true);
    state.advanceDialoguePage(1, true);
    expect(state.getState().mode).toBe('WORKS_PICKER');

    state.setPickerIndex(1);
    expect(state.getState().pickerIndex).toBe(1);
    state.selectWork('work-2');
    expect(state.getState().mode).toBe('DIALOGUE');
    expect(state.getState().activeWorkId).toBe('work-2');

    state.openInspect();
    expect(state.getState().mode).toBe('INSPECT_CARD');
    state.closeInspect();
    expect(state.getState().mode).toBe('WORKS_PICKER');
    expect(state.getState().activeWorkId).toBeNull();
  });

  it('tracks prefers-reduced-motion changes and enforces terminal FALLBACK_ARCHIVE', () => {
    const mock = createMockMediaQuery(true);
    const state = createAppState({ matchMedia: () => mock.mq });
    expect(state.getState().reducedMotion).toBe(true);

    mock.emitChange(false);
    expect(state.getState().reducedMotion).toBe(false);

    state.enterFallbackArchive();
    expect(state.getState().mode).toBe('FALLBACK_ARCHIVE');
    state.wakeAudioFromIdle();
    state.openLandmark('about');
    state.closeArchive();
    expect(state.getState().mode).toBe('FALLBACK_ARCHIVE');
    state.dispose();
  });
});
