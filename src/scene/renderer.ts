import * as THREE from 'three';
import type { AppStateController, AudioStatus } from '../state/appState.ts';
import type { AssetSourceKind, DiagRecorder } from './placeholders.ts';

export interface DiagEvent {
  timeMs: number;
  message: string;
}

export interface HD2DDiagnostics {
  webglReady: boolean;
  msaaSamples: number;
  activeAlphaTest: 0.3 | 0.5;
  dpr: number;
  assetSources: Record<string, AssetSourceKind>;
  audioStatus: AudioStatus;
  events: DiagEvent[];
}

declare global {
  interface Window {
    __HD2D_DIAG__?: HD2DDiagnostics;
  }
}

export interface SceneRendererHandle extends DiagRecorder {
  renderer: THREE.WebGLRenderer;
  debugEnabled: boolean;
  updateDebugReadout: (info: { heroT: number; guidesVisible: boolean }) => void;
  resize: (width: number, height: number) => void;
  triggerSimulatedContextLossIfRequested: () => void;
  dispose: () => void;
}

export interface SceneRendererOptions {
  canvas: HTMLCanvasElement;
  debugOverlay: HTMLElement;
  appState: AppStateController;
  onContextLostFallback: () => void;
  onToggleDebugGuides: () => void;
}

export function createSceneRenderer(options: SceneRendererOptions): SceneRendererHandle {
  const { canvas, debugOverlay, appState, onContextLostFallback, onToggleDebugGuides } = options;
  const params = new URLSearchParams(window.location.search);
  const debugEnabled = params.get('debug') === '1';
  const noMsaa = params.get('noMsaa') === '1';
  const loseContext = params.get('loseContext') === '1';

  const isCoarsePointer =
    typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  const maxDpr = isCoarsePointer ? 1.5 : 2.0;
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);

  const diag: HD2DDiagnostics = {
    webglReady: false,
    msaaSamples: 0,
    activeAlphaTest: 0.5,
    dpr,
    assetSources: {},
    audioStatus: appState.getState().audioStatus,
    events: [],
  };
  window.__HD2D_DIAG__ = diag;

  const recordEvent = (message: string): void => {
    diag.events.push({ timeMs: Math.round(performance.now()), message });
    if (diag.events.length > 50) {
      diag.events.shift();
    }
  };

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !noMsaa,
      powerPreference: 'high-performance',
    });
  } catch (error) {
    recordEvent(`WebGLRenderer creation failed: ${String(error)}`);
    throw error;
  }

  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setSize(window.innerWidth, window.innerHeight, false);

  const gl = renderer.getContext();
  const msaaSamples = Number(gl.getParameter(gl.SAMPLES) ?? 0);
  const antialiasActive = renderer.getContextAttributes()?.antialias === true && !noMsaa;
  diag.webglReady = true;
  diag.msaaSamples = msaaSamples;
  diag.activeAlphaTest = antialiasActive && msaaSamples >= 2 ? 0.3 : 0.5;
  recordEvent(
    `WebGL ready (dpr=${dpr}, msaaSamples=${msaaSamples}, alphaTest=${diag.activeAlphaTest})`,
  );

  const onContextLost = (event: Event): void => {
    event.preventDefault();
    diag.webglReady = false;
    recordEvent('webglcontextlost -> FALLBACK_ARCHIVE');
    onContextLostFallback();
  };
  canvas.addEventListener('webglcontextlost', onContextLost);

  let debugTextEl: HTMLPreElement | null = null;
  let guidesBtnEl: HTMLButtonElement | null = null;
  let fpsAccumFrames = 0;
  let fpsAccumTime = 0;
  let lastFps = 60;
  let lastFrameStamp = performance.now();

  const onDebugBtnPointer = (event: Event): void => {
    event.stopPropagation();
  };
  const onDebugBtnClick = (event: Event): void => {
    event.stopPropagation();
    onToggleDebugGuides();
  };

  if (debugEnabled) {
    debugOverlay.hidden = false;
    debugOverlay.replaceChildren();
    debugTextEl = document.createElement('pre');
    debugTextEl.className = 'debug-readout';
    guidesBtnEl = document.createElement('button');
    guidesBtnEl.type = 'button';
    guidesBtnEl.className = 'debug-toggle-btn';
    guidesBtnEl.textContent = '[G] Alignment Guides';
    guidesBtnEl.addEventListener('pointerdown', onDebugBtnPointer);
    guidesBtnEl.addEventListener('pointerup', onDebugBtnPointer);
    guidesBtnEl.addEventListener('click', onDebugBtnClick);
    debugOverlay.append(debugTextEl, guidesBtnEl);
  } else {
    debugOverlay.hidden = true;
  }

  return {
    renderer,
    debugEnabled,
    assetSources: diag.assetSources,
    recordEvent,
    resize(width, height) {
      const nextDpr = Math.min(window.devicePixelRatio || 1, maxDpr);
      renderer.setPixelRatio(nextDpr);
      renderer.setSize(width, height, false);
      diag.dpr = nextDpr;
    },
    updateDebugReadout({ heroT, guidesVisible }) {
      const state = appState.getState();
      diag.audioStatus = state.audioStatus;
      if (!debugEnabled || !debugTextEl) {
        return;
      }
      const now = performance.now();
      const elapsed = (now - lastFrameStamp) / 1000;
      lastFrameStamp = now;
      fpsAccumFrames += 1;
      fpsAccumTime += elapsed;
      if (fpsAccumTime >= 0.4) {
        lastFps = Math.round(fpsAccumFrames / fpsAccumTime);
        fpsAccumFrames = 0;
        fpsAccumTime = 0;
      }

      const sourcesSummary = Object.entries(diag.assetSources)
        .map(([k, v]) => `${k}:${v}`)
        .join(' ');
      debugTextEl.textContent = [
        `FPS: ${lastFps} | DPR: ${diag.dpr.toFixed(2)} | MSAA: ${diag.msaaSamples} (alphaTest ${diag.activeAlphaTest})`,
        `Calls: ${renderer.info.render.calls} | Tris: ${renderer.info.render.triangles} | Mode: ${state.mode}`,
        `heroT: ${heroT.toFixed(3)} | Audio: ${state.audioStatus} | Guides: ${guidesVisible ? 'ON' : 'OFF'}`,
        `Assets: ${sourcesSummary || 'pending'}`,
      ].join('\n');
    },
    triggerSimulatedContextLossIfRequested() {
      if (!loseContext) {
        return;
      }
      const ext = gl.getExtension('WEBGL_lose_context');
      if (ext) {
        recordEvent('Simulating WEBGL_lose_context via ?loseContext=1');
        ext.loseContext();
      }
    },
    dispose() {
      canvas.removeEventListener('webglcontextlost', onContextLost);
      if (guidesBtnEl) {
        guidesBtnEl.removeEventListener('pointerdown', onDebugBtnPointer);
        guidesBtnEl.removeEventListener('pointerup', onDebugBtnPointer);
        guidesBtnEl.removeEventListener('click', onDebugBtnClick);
      }
      renderer.dispose();
    },
  };
}
