import * as THREE from 'three';
import { RIDGE_LENGTH, xToSplineT } from '../scene/layout.ts';
import type { AppStateController } from '../state/appState.ts';

export const REFOCUS_GUARD_MS = 150;
export const DRAG_GUARD_PX = 8;

export function isRefocusClick(nowMs: number, lastFocusMs: number): boolean {
  return nowMs - lastFocusMs < REFOCUS_GUARD_MS;
}

export function isDragGesture(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): boolean {
  return Math.hypot(endX - startX, endY - startY) > DRAG_GUARD_PX;
}

export interface InputRouterDeps {
  canvas: HTMLCanvasElement;
  appState: AppStateController;
  getCamera: () => THREE.PerspectiveCamera;
  onMouseParallax?: (normX: number, normY: number) => void;
  onToggleDebugGuides?: () => void;
  onCloseArchive?: () => void;
  onAudioGesture?: () => void;
  isInputBlocked?: () => boolean;
}

export interface InputRouterHandle {
  getAxis: () => -1 | 0 | 1;
  dispose: () => void;
}

export function attachInputRouter(deps: InputRouterDeps): InputRouterHandle {
  const {
    canvas,
    appState,
    getCamera,
    onMouseParallax,
    onToggleDebugGuides,
    onCloseArchive,
    onAudioGesture,
    isInputBlocked,
  } = deps;
  const raycaster = new THREE.Raycaster();
  const ridgePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const hitPoint = new THREE.Vector3();
  const ndc = new THREE.Vector2();

  let heldLeft = false;
  let heldRight = false;
  let lastFocusMs = -Infinity;
  let activePointerId: number | null = null;
  let pointerStartX = 0;
  let pointerStartY = 0;

  const clearKeys = (): void => {
    heldLeft = false;
    heldRight = false;
  };

  const onFocus = (): void => {
    lastFocusMs = appState.now();
  };

  const onBlur = (): void => {
    clearKeys();
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (isInputBlocked?.()) {
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    const { mode } = appState.getState();

    if (event.key === 'Escape') {
      if (mode === 'ARCHIVE_DRAWER') {
        event.preventDefault();
        onCloseArchive?.();
        appState.closeArchive();
      }
      return;
    }

    if (event.key.toLowerCase() === 'g' && !event.repeat) {
      onToggleDebugGuides?.();
    }

    if (mode !== 'TITLE_IDLE' && mode !== 'EXPLORING') {
      return;
    }

    const key = event.key.toLowerCase();
    const isLeft = key === 'a' || event.key === 'ArrowLeft';
    const isRight = key === 'd' || event.key === 'ArrowRight';
    if (!isLeft && !isRight) {
      return;
    }

    if (isLeft) {
      heldLeft = true;
    }
    if (isRight) {
      heldRight = true;
    }

    if (mode === 'TITLE_IDLE') {
      appState.startKeyboardExplore();
    }
    appState.cancelWalkTarget();
  };

  const onKeyUp = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();
    if (key === 'a' || event.key === 'ArrowLeft') {
      heldLeft = false;
    }
    if (key === 'd' || event.key === 'ArrowRight') {
      heldRight = false;
    }
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse' || !onMouseParallax) {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }
    const normX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const normY = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    onMouseParallax(normX, normY);
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (!event.isPrimary) {
      return;
    }
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }
    activePointerId = event.pointerId;
    pointerStartX = event.clientX;
    pointerStartY = event.clientY;
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (isInputBlocked?.()) {
      return;
    }
    if (!event.isPrimary || event.pointerId !== activePointerId) {
      return;
    }
    activePointerId = null;

    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }
    if (isRefocusClick(appState.now(), lastFocusMs)) {
      return;
    }
    if (isDragGesture(pointerStartX, pointerStartY, event.clientX, event.clientY)) {
      return;
    }

    const { mode, audioStatus } = appState.getState();
    if (mode === 'TITLE_IDLE') {
      appState.wakeAudioFromIdle();
      if (appState.getState().audioStatus === 'PLAYING') {
        onAudioGesture?.();
      }
      return;
    }
    if (mode !== 'EXPLORING') {
      return;
    }

    if (audioStatus === 'UNSTARTED') {
      appState.wakeAudioFromIdle();
      if (appState.getState().audioStatus === 'PLAYING') {
        onAudioGesture?.();
      }
    }

    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }
    ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);

    const camera = getCamera();
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.ray.intersectPlane(ridgePlane, hitPoint);
    if (hit) {
      appState.setWalkTarget(xToSplineT(hit.x));
    } else {
      const edgeX = raycaster.ray.direction.x >= 0 ? RIDGE_LENGTH * 0.5 : -RIDGE_LENGTH * 0.5;
      appState.setWalkTarget(xToSplineT(edgeX));
    }
  };

  const onPointerCancel = (event: PointerEvent): void => {
    if (event.pointerId === activePointerId) {
      activePointerId = null;
    }
  };

  window.addEventListener('focus', onFocus);
  window.addEventListener('blur', onBlur);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);

  return {
    getAxis() {
      const axis = (heldRight ? 1 : 0) - (heldLeft ? 1 : 0);
      return axis as -1 | 0 | 1;
    },
    dispose() {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
    },
  };
}
