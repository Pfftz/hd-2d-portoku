export interface LoadProgress {
  total: number;
  settled: number;
  pending: number;
  failed: string[];
  ready: boolean;
}

export type LoadProgressListener = (progress: LoadProgress) => void;

export interface LoadTracker {
  begin(key: string): (failed?: boolean) => void;
  getProgress(): LoadProgress;
  subscribe(listener: LoadProgressListener): () => void;
  reset(): void;
}

/** Tracks pending asset loads so the loading gate waits until textures settle. */
export function createLoadTracker(): LoadTracker {
  let total = 0;
  let settled = 0;
  const failed: string[] = [];
  const listeners = new Set<LoadProgressListener>();

  const getProgress = (): LoadProgress => {
    const pending = Math.max(0, total - settled);
    return {
      total,
      settled,
      pending,
      failed: [...failed],
      ready: total > 0 && pending === 0,
    };
  };

  const notify = (): void => {
    const snapshot = getProgress();
    for (const listener of listeners) {
      listener(snapshot);
    }
  };

  return {
    begin(key: string): (didFail?: boolean) => void {
      total += 1;
      let done = false;
      notify();

      return (didFail = false): void => {
        if (done) {
          return;
        }
        done = true;
        settled += 1;
        if (didFail) {
          failed.push(key);
        }
        notify();
      };
    },
    getProgress,
    subscribe(listener: LoadProgressListener): () => void {
      listeners.add(listener);
      listener(getProgress());
      return (): void => {
        listeners.delete(listener);
      };
    },
    reset(): void {
      total = 0;
      settled = 0;
      failed.length = 0;
      notify();
    },
  };
}

export const assetLoadTracker = createLoadTracker();
