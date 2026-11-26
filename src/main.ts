import './ui/styles.css';
import { assetLoadTracker } from './assets/loadTracker.ts';
import { createAudioEngine, type AudioEngineHandle } from './audio/audioEngine.ts';
import rawNodes from './content/nodes.json';
import { validateNodes } from './content/validateNodes.ts';
import { attachInputRouter, type InputRouterHandle } from './input/inputRouter.ts';
import type { DiagRecorder } from './scene/placeholders.ts';
import { createSceneRenderer, type SceneRendererHandle } from './scene/renderer.ts';
import { createSceneController, type SceneController } from './scene/sceneController.ts';
import { createAppState } from './state/appState.ts';
import { createArchiveDrawer } from './ui/archiveDrawer.ts';
import { createHudControls } from './ui/hudControls.ts';
import { createLoadingScreen, type LoadingScreenHandle } from './ui/loadingScreen.ts';

function bootstrap(): void {
  const nodesDoc = validateNodes(rawNodes);
  const appState = createAppState();

  const canvas = document.getElementById('scene-canvas');
  const loadingRoot = document.getElementById('loading-screen');
  const hudRoot = document.getElementById('hud-root');
  const archiveDialog = document.getElementById('archive-dialog');
  const debugOverlay = document.getElementById('debug-overlay');

  if (
    !(canvas instanceof HTMLCanvasElement) ||
    !(loadingRoot instanceof HTMLElement) ||
    !(hudRoot instanceof HTMLElement) ||
    !(archiveDialog instanceof HTMLDialogElement) ||
    !(debugOverlay instanceof HTMLElement)
  ) {
    throw new Error('Required root DOM elements are missing from index.html');
  }

  let hud: ReturnType<typeof createHudControls> | null = null;
  let audioEngine: AudioEngineHandle | null = null;
  let rendererHandle: SceneRendererHandle | null = null;
  let loadingScreen: LoadingScreenHandle | null = null;
  const diagBridge: DiagRecorder = {
    assetSources: {},
    recordEvent(message) {
      rendererHandle?.recordEvent(message);
    },
  };

  loadingScreen = createLoadingScreen({
    root: loadingRoot,
    tracker: assetLoadTracker,
    isReducedMotion: () => appState.getState().reducedMotion,
    onContinue: () => {
      appState.wakeAudioFromIdle();
      if (appState.getState().audioStatus === 'PLAYING') {
        audioEngine?.unlockFromGesture();
      }
    },
  });

  const archive = createArchiveDrawer(archiveDialog, nodesDoc, appState, () => {
    hud?.focusArchiveButton();
  });
  hud = createHudControls(hudRoot, appState, () => {
    audioEngine?.unlockFromGesture();
  });

  let sceneController: SceneController | null = null;
  let inputRouter: InputRouterHandle | null = null;

  const triggerFallback = (): void => {
    loadingScreen?.dispose();
    loadingScreen = null;
    inputRouter?.dispose();
    inputRouter = null;
    audioEngine?.dispose();
    audioEngine = null;
    sceneController?.dispose();
    sceneController = null;
    appState.enterFallbackArchive();
  };

  try {
    rendererHandle = createSceneRenderer({
      canvas,
      debugOverlay,
      appState,
      onContextLostFallback: triggerFallback,
      onToggleDebugGuides: () => {
        sceneController?.toggleDebugGuides();
      },
    });
    diagBridge.assetSources = rendererHandle.assetSources;
    audioEngine = createAudioEngine({
      appState,
      diag: diagBridge,
    });

    sceneController = createSceneController({
      rendererHandle,
      appState,
      getInputRouter: () => {
        if (!inputRouter) {
          throw new Error('InputRouter accessed before initialization');
        }
        return inputRouter;
      },
    });

    const activeRenderer = rendererHandle;
    inputRouter = attachInputRouter({
      canvas,
      appState,
      getCamera: () => {
        if (!sceneController) {
          throw new Error('SceneController unavailable');
        }
        return sceneController.getCamera();
      },
      onMouseParallax: (nx, ny) => {
        sceneController?.setMouseParallaxTarget(nx, ny);
      },
      onToggleDebugGuides: () => {
        if (activeRenderer.debugEnabled) {
          sceneController?.toggleDebugGuides();
        }
      },
      onCloseArchive: () => {
        archive.closeDialogElement();
        hud?.focusArchiveButton();
      },
      onAudioGesture: () => {
        audioEngine?.unlockFromGesture();
      },
      isInputBlocked: () => loadingScreen?.isActive() ?? false,
    });

    sceneController.start();
  } catch (error) {
    console.warn('WebGL initialization failed, activating HTML Archive fallback.', error);
    triggerFallback();
  }
}

bootstrap();
