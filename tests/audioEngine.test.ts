import { describe, expect, it } from 'vitest';
import { ASSET_MANIFEST, resolveAssetUrl } from '../src/assets/manifest.ts';
import {
  createAudioEngine,
  generatePinkNoiseSamples,
  selectAudioCandidates,
  type AudioBufferLike,
  type AudioBufferSourceNodeLike,
  type AudioContextLike,
  type AudioFetchResponse,
  type AudioParamLike,
  type DocumentVisibilityLike,
} from '../src/audio/audioEngine.ts';
import type { DiagRecorder } from '../src/scene/placeholders.ts';
import { createAppState } from '../src/state/appState.ts';

function createFakeAudioContext() {
  const stateLog = {
    resumes: 0,
    suspends: 0,
    closes: 0,
    decodedCount: 0,
  };
  let ctxState = 'suspended';
  const gains: Array<{ value: number; ramps: Array<{ target: number; endTime: number }> }> = [];
  const sources: Array<{
    started: boolean;
    stopped: boolean;
    loop: boolean;
    buffer: AudioBufferLike | null;
  }> = [];

  const makeParam = (initial = 0): AudioParamLike & {
    ramps: Array<{ target: number; endTime: number }>;
  } => {
    const ramps: Array<{ target: number; endTime: number }> = [];
    return {
      value: initial,
      ramps,
      setValueAtTime(v) {
        this.value = v;
      },
      linearRampToValueAtTime(target, endTime) {
        this.value = target;
        ramps.push({ target, endTime });
      },
    };
  };

  const ctx: AudioContextLike = {
    get state() {
      return ctxState;
    },
    sampleRate: 48000,
    currentTime: 0,
    destination: {
      connect() {},
    },
    async resume() {
      ctxState = 'running';
      stateLog.resumes += 1;
    },
    async suspend() {
      ctxState = 'suspended';
      stateLog.suspends += 1;
    },
    async close() {
      ctxState = 'closed';
      stateLog.closes += 1;
    },
    createGain() {
      const gainParam = makeParam(1);
      gains.push(gainParam);
      return {
        gain: gainParam,
        connect() {},
      };
    },
    createBiquadFilter() {
      return {
        type: 'lowpass',
        frequency: makeParam(350),
        Q: makeParam(1),
        connect() {},
      };
    },
    createOscillator() {
      return {
        frequency: makeParam(440),
        start() {},
        stop() {},
        connect() {},
      };
    },
    createBuffer(channels, length) {
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      return {
        getChannelData: (ch) => data[ch] ?? new Float32Array(0),
      };
    },
    createBufferSource() {
      const record: AudioBufferSourceNodeLike & {
        started: boolean;
        stopped: boolean;
      } = {
        buffer: null,
        loop: false,
        started: false,
        stopped: false,
        start() {
          this.started = true;
        },
        stop() {
          this.stopped = true;
        },
        connect() {},
      };
      sources.push(record);
      return record;
    },
    async decodeAudioData() {
      stateLog.decodedCount += 1;
      return {
        getChannelData: () => new Float32Array(64),
      };
    },
  };

  return { ctx, stateLog, gains, sources };
}

function createFakeDoc(): DocumentVisibilityLike & {
  setVisibility: (next: string) => void;
} {
  let visibility = 'visible';
  const listeners = new Set<() => void>();
  return {
    get visibilityState() {
      return visibility;
    },
    addEventListener(_type, cb) {
      listeners.add(cb);
    },
    removeEventListener(_type, cb) {
      listeners.delete(cb);
    },
    setVisibility(next) {
      visibility = next;
      for (const cb of listeners) {
        cb();
      }
    },
  };
}

function createDiag(): { diag: DiagRecorder; events: string[] } {
  const events: string[] = [];
  return {
    events,
    diag: {
      assetSources: {},
      recordEvent(msg) {
        events.push(msg);
      },
    },
  };
}

async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 12; i += 1) {
    await Promise.resolve();
  }
}

describe('audioEngine helpers and lifecycle', () => {
  it('prioritizes .opus first when supported and retains decode fallback order', () => {
    const supported = selectAudioCandidates(ASSET_MANIFEST.audio, (mime) =>
      mime.includes('opus') ? 'probably' : mime === 'audio/mpeg' ? 'probably' : '',
    );
    expect(supported.map((c) => c.format)).toEqual(['opus', 'mp3', 'm4a', 'ogg']);

    const conservative = selectAudioCandidates(ASSET_MANIFEST.audio, (mime) =>
      mime === 'audio/mpeg' ? 'probably' : '',
    );
    expect(conservative.map((c) => c.format)).toEqual(['mp3', 'opus', 'm4a', 'ogg']);
  });

  it('generates bounded deterministic pink noise with smooth loop ends', () => {
    const a = generatePinkNoiseSamples(4096);
    const b = generatePinkNoiseSamples(4096);
    expect(a.length).toBe(4096);
    expect(a).toEqual(b);

    let maxAbs = 0;
    for (let i = 0; i < a.length; i += 1) {
      const sample = a[i] ?? 0;
      expect(Number.isFinite(sample)).toBe(true);
      maxAbs = Math.max(maxAbs, Math.abs(sample));
    }
    expect(maxAbs).toBeGreaterThan(0.1);
    expect(maxAbs).toBeLessThanOrEqual(0.8501);
    expect(Math.abs((a[0] ?? 0) - (a[a.length - 1] ?? 0))).toBeLessThan(0.25);
  });

  it('unlocks synchronously, decodes .opus primary, and ramps bgmGain over 2s', async () => {
    const appState = createAppState({ matchMedia: () => ({ matches: false }) });
    const fake = createFakeAudioContext();
    const doc = createFakeDoc();
    const { diag } = createDiag();
    const fetchedUrls: string[] = [];

    const engine = createAudioEngine({
      appState,
      diag,
      createContext: () => fake.ctx,
      canPlayType: () => 'probably',
      documentRef: doc,
      fetchFn: async (url): Promise<AudioFetchResponse> => {
        fetchedUrls.push(url);
        return {
          ok: url.endsWith('.opus'),
          headers: { get: () => 'audio/ogg' },
          arrayBuffer: async () => new ArrayBuffer(128),
        };
      },
    });

    appState.wakeAudioFromIdle();
    engine.unlockFromGesture();
    expect(fake.stateLog.resumes).toBe(1);
    // Wind pink-noise source starts immediately on gesture unlock
    expect(fake.sources.length).toBe(1);

    await flushMicrotasks();

    expect(fetchedUrls).toEqual([resolveAssetUrl(ASSET_MANIFEST.audio.opus)]);
    expect(diag.assetSources.audio).toBe('opus');
    expect(fake.sources.length).toBe(2);
    expect(fake.sources[1]?.loop).toBe(true);
    // gains: [0]=master, [1]=bgmGain, [2]=windGain, [3]=windLfoGain
    expect(fake.gains[1]?.ramps.at(-1)).toEqual({ target: 0.45, endTime: 2.0 });

    doc.setVisibility('hidden');
    expect(fake.stateLog.suspends).toBe(1);
    doc.setVisibility('visible');
    expect(fake.stateLog.resumes).toBe(2);

    engine.dispose();
    appState.dispose();
  });

  it('falls back to .mp3 when .opus fails decode and to wind-only when all BGM 404', async () => {
    const appState = createAppState({ matchMedia: () => ({ matches: false }) });
    const fake = createFakeAudioContext();
    const { diag } = createDiag();
    const fetchedUrls: string[] = [];

    const engine = createAudioEngine({
      appState,
      diag,
      createContext: () => ({
        ...fake.ctx,
        async decodeAudioData() {
          if (fetchedUrls.at(-1)?.endsWith('.opus')) {
            throw new Error('Opus decode unsupported');
          }
          return { getChannelData: () => new Float32Array(32) };
        },
      }),
      canPlayType: () => 'probably',
      fetchFn: async (url) => {
        fetchedUrls.push(url);
        return {
          ok: true,
          headers: { get: () => 'audio/mpeg' },
          arrayBuffer: async () => new ArrayBuffer(64),
        };
      },
    });

    appState.wakeAudioFromIdle();
    engine.unlockFromGesture();
    await flushMicrotasks();

    expect(fetchedUrls).toEqual([
      resolveAssetUrl(ASSET_MANIFEST.audio.opus),
      resolveAssetUrl(ASSET_MANIFEST.audio.primary),
    ]);
    expect(diag.assetSources.audio).toBe('mp3');
    engine.dispose();
    appState.dispose();

    // Missing all files -> clean wind-only fallback
    const appState2 = createAppState({ matchMedia: () => ({ matches: false }) });
    const fake2 = createFakeAudioContext();
    const diag2 = createDiag();
    const engine2 = createAudioEngine({
      appState: appState2,
      diag: diag2.diag,
      createContext: () => fake2.ctx,
      canPlayType: () => 'probably',
      fetchFn: async () => ({
        ok: false,
        headers: { get: () => 'text/html' },
        arrayBuffer: async () => new ArrayBuffer(0),
      }),
    });
    appState2.wakeAudioFromIdle();
    engine2.unlockFromGesture();
    await flushMicrotasks();
    expect(diag2.diag.assetSources.audio).toBe('wind-only');
    expect(fake2.sources.length).toBe(1);
    engine2.dispose();
    appState2.dispose();
  });

  it('cancels pending BGM decode playback via decodeSeq if muted mid-flight', async () => {
    const appState = createAppState({ matchMedia: () => ({ matches: false }) });
    const fake = createFakeAudioContext();
    const { diag } = createDiag();

    let resolveDecode!: (buf: AudioBufferLike) => void;
    const decodePromise = new Promise<AudioBufferLike>((resolve) => {
      resolveDecode = resolve;
    });

    const engine = createAudioEngine({
      appState,
      diag,
      createContext: () => ({
        ...fake.ctx,
        decodeAudioData: () => decodePromise,
      }),
      canPlayType: () => 'probably',
      fetchFn: async () => ({
        ok: true,
        headers: { get: () => 'audio/opus' },
        arrayBuffer: async () => new ArrayBuffer(64),
      }),
    });

    appState.wakeAudioFromIdle();
    engine.unlockFromGesture();
    await flushMicrotasks();

    // Mute before decode completes
    appState.toggleMute();
    resolveDecode({ getChannelData: () => new Float32Array(16) });
    await flushMicrotasks();

    // Only pink-noise source exists; muted mid-flight BGM was canceled
    expect(fake.sources.length).toBe(1);
    expect(diag.assetSources.audio).toBeUndefined();
    engine.dispose();
    appState.dispose();
  });
});
