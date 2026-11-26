import { describe, expect, it, vi } from 'vitest';
import { createLoadTracker } from '../src/assets/loadTracker';

describe('createLoadTracker', () => {
  it('starts unready with zero pending assets', () => {
    const tracker = createLoadTracker();
    expect(tracker.getProgress()).toEqual({
      total: 0,
      settled: 0,
      pending: 0,
      failed: [],
      ready: false,
    });
  });

  it('tracks concurrent loads and settles idempotently', () => {
    const tracker = createLoadTracker();
    const finishHero = tracker.begin('hero');
    const finishCitadel = tracker.begin('citadel');

    expect(tracker.getProgress()).toEqual({
      total: 2,
      settled: 0,
      pending: 2,
      failed: [],
      ready: false,
    });

    finishHero();
    finishHero();
    expect(tracker.getProgress()).toEqual({
      total: 2,
      settled: 1,
      pending: 1,
      failed: [],
      ready: false,
    });

    finishCitadel(true);
    expect(tracker.getProgress()).toEqual({
      total: 2,
      settled: 2,
      pending: 0,
      failed: ['citadel'],
      ready: true,
    });
  });

  it('notifies subscribers and supports unsubscribing and reset', () => {
    const tracker = createLoadTracker();
    const listener = vi.fn();
    const unsubscribe = tracker.subscribe(listener);

    expect(listener).toHaveBeenCalledTimes(1);
    const finishClouds = tracker.begin('clouds');
    finishClouds();
    expect(listener).toHaveBeenLastCalledWith({
      total: 1,
      settled: 1,
      pending: 0,
      failed: [],
      ready: true,
    });

    unsubscribe();
    tracker.reset();
    expect(listener).toHaveBeenCalledTimes(3);
    expect(tracker.getProgress().total).toBe(0);
    expect(tracker.getProgress().ready).toBe(false);
  });
});
