import { ASSET_MANIFEST, resolveAssetUrl, type AssetManifest } from '../assets/manifest.ts';
import type { DiagRecorder } from '../scene/placeholders.ts';
import type { AppStateController } from '../state/appState.ts';

export type AudioFormat = 'opus' | 'mp3' | 'm4a' | 'ogg';

export interface AudioCandidate {
  format: AudioFormat;
  path: string;
  mimeTypes: readonly string[];
}

export interface AudioParamLike {
  value: number;
  setValueAtTime: (value: number, startTime: number) => void;
  linearRampToValueAtTime: (value: number, endTime: number) => void;
}

export interface AudioNodeLike {
  connect: (destination: AudioNodeLike | AudioParamLike) => void;
}

export interface GainNodeLike extends AudioNodeLike {
  gain: AudioParamLike;
}

export interface BiquadFilterNodeLike extends AudioNodeLike {
  type: BiquadFilterType;
  frequency: AudioParamLike;
  Q: AudioParamLike;
}

export interface OscillatorNodeLike extends AudioNodeLike {
  frequency: AudioParamLike;
  start: (when?: number) => void;
  stop: (when?: number) => void;
}

export interface AudioBufferLike {
  getChannelData: (channel: number) => Float32Array;
}

export interface AudioBufferSourceNodeLike extends AudioNodeLike {
  buffer: AudioBufferLike | null;
  loop: boolean;
  start: (when?: number) => void;
  stop: (when?: number) => void;
}

export interface AudioContextLike {
  readonly state: string;
  readonly sampleRate: number;
  readonly currentTime: number;
  readonly destination: AudioNodeLike;
  resume: () => Promise<void>;
  suspend: () => Promise<void>;
  close: () => Promise<void>;
  createGain: () => GainNodeLike;
  createBiquadFilter: () => BiquadFilterNodeLike;
  createOscillator: () => OscillatorNodeLike;
  createBuffer: (channels: number, length: number, sampleRate: number) => AudioBufferLike;
  createBufferSource: () => AudioBufferSourceNodeLike;
  decodeAudioData: (audioData: ArrayBuffer) => Promise<AudioBufferLike>;
}

export interface AudioFetchResponse {
  ok: boolean;
  headers?: { get: (name: string) => string | null };
  arrayBuffer: () => Promise<ArrayBuffer>;
}

export interface DocumentVisibilityLike {
  readonly visibilityState: string;
  addEventListener: (type: 'visibilitychange', listener: () => void) => void;
  removeEventListener: (type: 'visibilitychange', listener: () => void) => void;
}

export interface AudioEngineOptions {
  appState: AppStateController;
  diag?: DiagRecorder;
  audioSpec?: AssetManifest['audio'];
  createContext?: () => AudioContextLike;
  fetchFn?: (url: string) => Promise<AudioFetchResponse>;
  canPlayType?: (mime: string) => string;
  documentRef?: DocumentVisibilityLike;
}

export interface AudioEngineHandle {
  unlockFromGesture: () => void;
  dispose: () => void;
}

/**
 * Orders BGM codecs with `.opus` preferred first when supported, keeping
 * unconfirmed codecs as decode fallbacks (for browsers with conservative canPlayType).
 */
export function selectAudioCandidates(
  audioSpec: AssetManifest['audio'],
  canPlayType?: (mime: string) => string,
): AudioCandidate[] {
  const allCandidates: AudioCandidate[] = [
    {
      format: 'opus',
      path: audioSpec.opus,
      mimeTypes: ['audio/ogg; codecs="opus"', 'audio/opus', 'audio/webm; codecs="opus"'],
    },
    {
      format: 'mp3',
      path: audioSpec.primary,
      mimeTypes: ['audio/mpeg'],
    },
    {
      format: 'm4a',
      path: audioSpec.fallbackM4a,
      mimeTypes: ['audio/mp4; codecs="mp4a.40.2"', 'audio/mp4'],
    },
    {
      format: 'ogg',
      path: audioSpec.fallbackOgg,
      mimeTypes: ['audio/ogg; codecs="vorbis"', 'audio/ogg'],
    },
  ];

  if (!canPlayType) {
    return allCandidates;
  }

  const supported: AudioCandidate[] = [];
  const fallback: AudioCandidate[] = [];
  for (const candidate of allCandidates) {
    const isSupported = candidate.mimeTypes.some((mime) => canPlayType(mime) !== '');
    if (isSupported) {
      supported.push(candidate);
    } else {
      fallback.push(candidate);
    }
  }
  return [...supported, ...fallback];
}

/**
 * Generates a deterministic Paul Kellet pink-noise bed with an equal-power
 * cosine loop crossfade so 4s ambient wind playback loops seamlessly.
 */
export function generatePinkNoiseSamples(
  sampleCount: number,
  seed = 0x5650574e,
): Float32Array {
  const safeCount = Math.max(1, Math.floor(sampleCount));
  const out = new Float32Array(safeCount);
  let state = seed >>> 0;
  const nextRand = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;
  let maxAbs = 0;

  for (let i = 0; i < safeCount; i += 1) {
    const white = nextRand() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.016898;
    const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
    out[i] = pink;
    const absVal = Math.abs(pink);
    if (absVal > maxAbs) {
      maxAbs = absVal;
    }
  }

  if (maxAbs > 0) {
    const scale = 0.85 / maxAbs;
    for (let i = 0; i < safeCount; i += 1) {
      out[i] = (out[i] ?? 0) * scale;
    }
  }

  const fadeLen = Math.min(Math.floor(safeCount * 0.08), 11025);
  if (fadeLen > 1 && safeCount > fadeLen * 2) {
    for (let i = 0; i < fadeLen; i += 1) {
      const t = i / (fadeLen - 1);
      const headWeight = Math.sin(t * Math.PI * 0.5);
      const tailWeight = Math.cos(t * Math.PI * 0.5);
      const tailIdx = safeCount - fadeLen + i;
      const headVal = out[i] ?? 0;
      const tailVal = out[tailIdx] ?? 0;
      const blended = headVal * headWeight + tailVal * tailWeight;
      out[i] = blended;
      out[tailIdx] = blended;
    }
  }

  return out;
}

function defaultCreateContext(): AudioContextLike {
  const Ctor =
    typeof AudioContext !== 'undefined'
      ? AudioContext
      : (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) {
    throw new Error('Web Audio API is not supported in this browser');
  }
  return new Ctor() as unknown as AudioContextLike;
}

function defaultCanPlayType(): (mime: string) => string {
  if (typeof document === 'undefined' || typeof HTMLAudioElement === 'undefined') {
    return () => '';
  }
  const probe = document.createElement('audio');
  return (mime: string) => probe.canPlayType(mime);
}

export function createAudioEngine(options: AudioEngineOptions): AudioEngineHandle {
  const {
    appState,
    diag,
    audioSpec = ASSET_MANIFEST.audio,
    createContext = defaultCreateContext,
    fetchFn = (url) => fetch(url),
    canPlayType = defaultCanPlayType(),
    documentRef = typeof document !== 'undefined' ? document : undefined,
  } = options;

  let ctx: AudioContextLike | null = null;
  let masterMuteGain: GainNodeLike | null = null;
  let bgmGain: GainNodeLike | null = null;
  let windGain: GainNodeLike | null = null;
  let windLfoGain: GainNodeLike | null = null;
  let windLfo: OscillatorNodeLike | null = null;
  let windSource: AudioBufferSourceNodeLike | null = null;
  let bgmSource: AudioBufferSourceNodeLike | null = null;
  let decodedBgmBuffer: AudioBufferLike | null = null;

  let decodeSeq = 0;
  let bgmAttempted = false;
  let bgmStartedOnce = false;
  let disposed = false;

  const rampGain = (gainParam: AudioParamLike, target: number, durationSec: number): void => {
    if (!ctx) {
      return;
    }
    const now = ctx.currentTime;
    const safeCurrent = Math.max(0.0001, gainParam.value);
    gainParam.setValueAtTime(safeCurrent, now);
    gainParam.linearRampToValueAtTime(target, now + durationSec);
  };

  const ensureGraph = (): AudioContextLike | null => {
    if (ctx) {
      return ctx;
    }
    try {
      ctx = createContext();
    } catch (error) {
      diag?.recordEvent(`Web Audio unavailable: ${String(error)}`);
      return null;
    }

    const now = ctx.currentTime;
    masterMuteGain = ctx.createGain();
    masterMuteGain.gain.setValueAtTime(0.0001, now);
    masterMuteGain.connect(ctx.destination);

    bgmGain = ctx.createGain();
    bgmGain.gain.setValueAtTime(0.0001, now);
    bgmGain.connect(masterMuteGain);

    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.setValueAtTime(550, now);
    windFilter.Q.setValueAtTime(0.7, now);

    windGain = ctx.createGain();
    windGain.gain.setValueAtTime(0.0001, now);
    windFilter.connect(windGain);
    windGain.connect(masterMuteGain);

    windLfo = ctx.createOscillator();
    windLfo.frequency.setValueAtTime(0.11, now);
    windLfoGain = ctx.createGain();
    windLfoGain.gain.setValueAtTime(appState.getState().reducedMotion ? 0 : 230, now);
    windLfo.connect(windLfoGain);
    windLfoGain.connect(windFilter.frequency);
    windLfo.start();

    const noiseLength = Math.max(1, Math.round(ctx.sampleRate * 4));
    const noiseBuffer = ctx.createBuffer(1, noiseLength, ctx.sampleRate);
    noiseBuffer.getChannelData(0).set(generatePinkNoiseSamples(noiseLength));

    windSource = ctx.createBufferSource();
    windSource.buffer = noiseBuffer;
    windSource.loop = true;
    windSource.connect(windFilter);
    windSource.start();

    return ctx;
  };

  const startBgmPlayback = (fadeSeconds: number): void => {
    if (!ctx || !bgmGain || !decodedBgmBuffer || bgmSource) {
      return;
    }
    const source = ctx.createBufferSource();
    source.buffer = decodedBgmBuffer;
    source.loop = true;
    source.connect(bgmGain);
    source.start();
    bgmSource = source;
    bgmStartedOnce = true;
    bgmGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    bgmGain.gain.linearRampToValueAtTime(0.45, ctx.currentTime + fadeSeconds);
  };

  const loadAndStartBgm = async (seq: number): Promise<void> => {
    if (!ctx || bgmAttempted) {
      return;
    }
    bgmAttempted = true;
    const candidates = selectAudioCandidates(audioSpec, canPlayType);

    for (const candidate of candidates) {
      if (disposed || seq !== decodeSeq) {
        return;
      }
      try {
        const res = await fetchFn(resolveAssetUrl(candidate.path));
        if (!res.ok) {
          continue;
        }
        const contentType = res.headers?.get('content-type')?.toLowerCase() ?? '';
        if (contentType.includes('text/html')) {
          continue;
        }
        const rawBytes = await res.arrayBuffer();
        if (rawBytes.byteLength === 0) {
          continue;
        }
        if (disposed || seq !== decodeSeq) {
          return;
        }
        const decoded = await ctx.decodeAudioData(rawBytes.slice(0));
        if (disposed || seq !== decodeSeq || appState.getState().audioStatus !== 'PLAYING') {
          return;
        }
        decodedBgmBuffer = decoded;
        if (diag) {
          diag.assetSources.audio = candidate.format;
          diag.recordEvent(`Loaded BGM (${candidate.format})`);
        }
        startBgmPlayback(2.0);
        return;
      } catch (error) {
        diag?.recordEvent(`BGM candidate ${candidate.format} failed: ${String(error)}`);
      }
    }

    if (disposed || seq !== decodeSeq) {
      return;
    }
    if (diag) {
      diag.assetSources.audio = 'wind-only';
      diag.recordEvent('BGM unavailable; running pink-noise wind bed');
    }
  };

  const unlockFromGesture = (): void => {
    const state = appState.getState();
    if (disposed || state.audioStatus !== 'PLAYING' || state.mode === 'FALLBACK_ARCHIVE') {
      return;
    }

    const audioCtx = ensureGraph();
    if (!audioCtx || !masterMuteGain || !windGain) {
      return;
    }

    void audioCtx.resume().catch(() => {});
    rampGain(masterMuteGain.gain, 1.0, 0.15);
    rampGain(windGain.gain, 0.08, 2.0);

    if (decodedBgmBuffer) {
      startBgmPlayback(bgmStartedOnce ? 0.35 : 2.0);
    } else if (!bgmAttempted) {
      const seq = ++decodeSeq;
      void loadAndStartBgm(seq);
    }
  };

  const unsubscribe = appState.subscribe((state) => {
    if (disposed) {
      return;
    }

    if (windLfoGain && ctx) {
      windLfoGain.gain.setValueAtTime(state.reducedMotion ? 0 : 230, ctx.currentTime);
    }

    if (state.audioStatus === 'MUTED' || state.mode === 'FALLBACK_ARCHIVE') {
      decodeSeq += 1;
      if (ctx && masterMuteGain) {
        const now = ctx.currentTime;
        masterMuteGain.gain.setValueAtTime(Math.max(0.0001, masterMuteGain.gain.value), now);
        masterMuteGain.gain.linearRampToValueAtTime(0.0001, now + 0.12);
        masterMuteGain.gain.setValueAtTime(0, now + 0.13);
      }
      return;
    }

    if (state.audioStatus === 'PLAYING' && ctx && masterMuteGain) {
      void ctx.resume().catch(() => {});
      rampGain(masterMuteGain.gain, 1.0, 0.25);
      if (decodedBgmBuffer && !bgmSource) {
        startBgmPlayback(bgmStartedOnce ? 0.35 : 2.0);
      }
    }
  });

  const onVisibilityChange = (): void => {
    if (!ctx || disposed) {
      return;
    }
    if (documentRef?.visibilityState === 'hidden') {
      void ctx.suspend().catch(() => {});
    } else if (appState.getState().audioStatus === 'PLAYING') {
      void ctx.resume().catch(() => {});
    }
  };
  documentRef?.addEventListener('visibilitychange', onVisibilityChange);

  return {
    unlockFromGesture,
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      decodeSeq += 1;
      unsubscribe();
      documentRef?.removeEventListener('visibilitychange', onVisibilityChange);

      try {
        bgmSource?.stop();
      } catch {
        // Source may already be stopped
      }
      try {
        windSource?.stop();
      } catch {
        // Source may already be stopped
      }
      try {
        windLfo?.stop();
      } catch {
        // Oscillator may already be stopped
      }
      try {
        void ctx?.close().catch(() => {});
      } catch {
        // Context may already be closed
      }
    },
  };
}
