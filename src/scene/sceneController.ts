import * as THREE from 'three';
import type { AppStateController } from '../state/appState.ts';
import type { InputRouterHandle } from '../input/inputRouter.ts';
import { createCameraRig } from './camera.ts';
import { createHeroController } from './hero.ts';
import { RIDGE_LENGTH, WALK_SPEED, computeEndpointDamping, sampleRidge } from './layout.ts';
import { createPlatesController } from './plates.ts';
import type { SceneRendererHandle } from './renderer.ts';

export interface SceneController {
  getCamera: () => THREE.PerspectiveCamera;
  setMouseParallaxTarget: (normX: number, normY: number) => void;
  toggleDebugGuides: () => boolean;
  start: () => void;
  dispose: () => void;
}

export interface SceneControllerDeps {
  rendererHandle: SceneRendererHandle;
  appState: AppStateController;
  getInputRouter: () => InputRouterHandle;
}

export function createSceneController(deps: SceneControllerDeps): SceneController {
  const { rendererHandle, appState, getInputRouter } = deps;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#ddd8cc');

  const cameraRig = createCameraRig(window.innerWidth, window.innerHeight);
  const plates = createPlatesController(rendererHandle, rendererHandle.debugEnabled);
  const hero = createHeroController(rendererHandle);

  scene.add(plates.group);
  scene.add(hero.mesh);

  let rafId = 0;
  let lastTimeMs = 0;
  let disposed = false;

  const onResize = (): void => {
    if (disposed) {
      return;
    }
    const width = window.visualViewport?.width ?? window.innerWidth;
    const height = window.visualViewport?.height ?? window.innerHeight;
    rendererHandle.resize(width, height);
    cameraRig.resize(width, height);
  };

  window.addEventListener('resize', onResize);
  window.visualViewport?.addEventListener('resize', onResize);

  const stepHero = (dt: number): boolean => {
    const state = appState.getState();
    if (state.mode !== 'EXPLORING') {
      return false;
    }

    const axis = getInputRouter().getAxis();
    if (axis !== 0) {
      const damping = computeEndpointDamping(state.heroT, axis);
      const nextT = state.heroT + ((axis * WALK_SPEED * damping) / RIDGE_LENGTH) * dt;
      appState.setHeroPosition(nextT, axis);
      return damping > 0.01;
    }

    if (state.walkTargetT !== null) {
      const diff = state.walkTargetT - state.heroT;
      const dir: -1 | 1 = diff >= 0 ? 1 : -1;
      const damping = computeEndpointDamping(state.heroT, dir);
      const maxStep = ((WALK_SPEED * Math.max(0.2, damping)) / RIDGE_LENGTH) * dt;
      if (Math.abs(diff) <= maxStep) {
        appState.setHeroPosition(state.walkTargetT, dir);
        appState.clearWalkTargetOnArrival();
        return false;
      }
      appState.setHeroPosition(state.heroT + dir * maxStep, dir);
      return true;
    }

    return false;
  };

  const tick = (nowMs: number): void => {
    if (disposed) {
      return;
    }
    rafId = requestAnimationFrame(tick);

    const rawDt = lastTimeMs === 0 ? 1 / 60 : (nowMs - lastTimeMs) / 1000;
    lastTimeMs = nowMs;
    const dt = Math.min(Math.max(rawDt, 0), 0.05);

    const isMoving = stepHero(dt);
    const state = appState.getState();
    const ridgePoint = sampleRidge(state.heroT);

    hero.update({
      t: state.heroT,
      facingDir: state.facingDir,
      isMoving,
      reducedMotion: state.reducedMotion,
      dt,
    });

    cameraRig.update({
      heroX: ridgePoint.x,
      heroY: ridgePoint.y,
      facingDir: state.facingDir,
      isMoving,
      mode: state.mode,
      reducedMotion: state.reducedMotion,
      dt,
    });

    plates.update(cameraRig.getBaseCameraX());
    rendererHandle.renderer.render(scene, cameraRig.camera);
    rendererHandle.updateDebugReadout({
      heroT: state.heroT,
      guidesVisible: plates.areGuidesVisible(),
    });
  };

  return {
    getCamera: () => cameraRig.camera,
    setMouseParallaxTarget(normX, normY) {
      cameraRig.setMouseParallaxTarget(normX, normY);
    },
    toggleDebugGuides: () => plates.toggleGuides(),
    start() {
      if (disposed) {
        return;
      }
      onResize();
      lastTimeMs = performance.now();
      rafId = requestAnimationFrame(tick);
      rendererHandle.triggerSimulatedContextLossIfRequested();
    },
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
      hero.dispose();
      plates.dispose();
      rendererHandle.dispose();
    },
  };
}
