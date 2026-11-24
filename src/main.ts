import './ui/styles.css';
import rawNodes from './content/nodes.json';
import { validateNodes } from './content/validateNodes.ts';
import { attachInputRouter, type InputRouterHandle } from './input/inputRouter.ts';
import { createSceneRenderer } from './scene/renderer.ts';
import { createSceneController, type SceneController } from './scene/sceneController.ts';
import { createAppState } from './state/appState.ts';
import { createArchiveDrawer } from './ui/archiveDrawer.ts';
import { createHudControls } from './ui/hudControls.ts';

function bootstrap(): void {
  const nodesDoc = validateNodes(rawNodes);
  const appState = createAppState();

  const canvas = document.getElementById('scene-canvas');
  const hudRoot = document.getElementById('hud-root');
  const archiveDialog = document.getElementById('archive-dialog');
  const debugOverlay = document.getElementById('debug-overlay');

  if (
    !(canvas instanceof HTMLCanvasElement) ||
    !(hudRoot instanceof HTMLElement) ||
    !(archiveDialog instanceof HTMLDialogElement) ||
    !(debugOverlay instanceof HTMLElement)
  ) {
    throw new Error('Required root DOM elements are missing from index.html');
  }

  let hud: ReturnType<typeof createHudControls> | null = null;
  const archive = createArchiveDrawer(archiveDialog, nodesDoc, appState, () => {
    hud?.focusArchiveButton();
  });
  hud = createHudControls(hudRoot, appState);

  let sceneController: SceneController | null = null;
  let inputRouter: InputRouterHandle | null = null;

  const triggerFallback = (): void => {
    inputRouter?.dispose();
    inputRouter = null;
    sceneController?.dispose();
    sceneController = null;
    appState.enterFallbackArchive();
  };

  try {
    const rendererHandle = createSceneRenderer({
      canvas,
      debugOverlay,
      appState,
      onContextLostFallback: triggerFallback,
      onToggleDebugGuides: () => {
        sceneController?.toggleDebugGuides();
      },
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
        if (rendererHandle.debugEnabled) {
          sceneController?.toggleDebugGuides();
        }
      },
      onCloseArchive: () => {
        archive.closeDialogElement();
        hud?.focusArchiveButton();
      },
    });

    sceneController.start();
  } catch (error) {
    console.warn('WebGL initialization failed, activating HTML Archive fallback.', error);
    triggerFallback();
  }
}

bootstrap();
