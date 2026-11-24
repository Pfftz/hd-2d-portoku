import * as THREE from 'three';
import {
  CAMERA_FAR,
  CAMERA_NEAR,
  DEADZONE_HALF_WIDTH,
  MAX_CAMERA_PAN,
  clamp,
  computeCameraFraming,
} from './layout.ts';
import type { AppMode } from '../state/appState.ts';

export interface DamperResult {
  position: number;
  velocity: number;
}

// Critically damped spring damper (Game Programming Gems 4)
export function stepCameraDamper(
  current: number,
  velocity: number,
  target: number,
  smoothTime: number,
  dt: number,
): DamperResult {
  if (smoothTime <= 0 || dt <= 0) {
    return { position: target, velocity: 0 };
  }
  const omega = 2 / smoothTime;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const delta = current - target;
  const temp = (velocity + omega * delta) * dt;
  const nextVelocity = (velocity - omega * temp) * exp;
  const nextPosition = target + (delta + temp) * exp;
  return { position: nextPosition, velocity: nextVelocity };
}

export interface CameraRig {
  camera: THREE.PerspectiveCamera;
  getBaseCameraX: () => number;
  setMouseParallaxTarget: (normX: number, normY: number) => void;
  resize: (width: number, height: number) => void;
  update: (params: {
    heroX: number;
    heroY: number;
    facingDir: -1 | 1;
    isMoving: boolean;
    mode: AppMode;
    reducedMotion: boolean;
    dt: number;
  }) => void;
}

export function createCameraRig(initialWidth: number, initialHeight: number): CameraRig {
  const initialAspect = initialHeight > 0 ? initialWidth / initialHeight : 4 / 3;
  const initialFraming = computeCameraFraming(initialAspect);

  const camera = new THREE.PerspectiveCamera(
    initialFraming.fov,
    initialAspect,
    CAMERA_NEAR,
    CAMERA_FAR,
  );
  camera.position.set(0, initialFraming.targetOffsetY + 0.6, initialFraming.cameraZ);
  camera.lookAt(0, initialFraming.targetOffsetY, 0);

  let framing = initialFraming;
  let deadzoneCenterX = 0;
  let lookAheadX = 0;
  let hasMovedOnce = false;
  let camX = 0;
  let camVelX = 0;
  let camY = initialFraming.targetOffsetY + 0.6;
  let rawMouseX = 0;
  let rawMouseY = 0;
  let parallaxX = 0;
  let parallaxY = 0;

  const canHover =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(hover: hover)').matches;

  const maxPanHalf = MAX_CAMERA_PAN * 0.5;

  return {
    camera,
    getBaseCameraX: () => camX,
    setMouseParallaxTarget(normX, normY) {
      rawMouseX = clamp(normX, -1, 1);
      rawMouseY = clamp(normY, -1, 1);
    },
    resize(width, height) {
      if (width <= 0 || height <= 0) {
        return;
      }
      const aspect = width / height;
      framing = computeCameraFraming(aspect);
      camera.fov = framing.fov;
      camera.aspect = aspect;
      camera.position.z = framing.cameraZ;
      camera.updateProjectionMatrix();
    },
    update({ heroX, facingDir, isMoving, mode, reducedMotion, dt }) {
      if (isMoving) {
        hasMovedOnce = true;
      }

      if (heroX > deadzoneCenterX + DEADZONE_HALF_WIDTH) {
        deadzoneCenterX = heroX - DEADZONE_HALF_WIDTH;
      } else if (heroX < deadzoneCenterX - DEADZONE_HALF_WIDTH) {
        deadzoneCenterX = heroX + DEADZONE_HALF_WIDTH;
      }

      const targetLookAhead = hasMovedOnce && !reducedMotion ? facingDir * 1.2 : 0;
      const lookAlpha = reducedMotion ? 1 : 1 - Math.exp(-3.5 * dt);
      lookAheadX += (targetLookAhead - lookAheadX) * lookAlpha;

      const targetCamX = clamp(deadzoneCenterX + lookAheadX, -maxPanHalf, maxPanHalf);
      if (reducedMotion) {
        camX = targetCamX;
        camVelX = 0;
      } else {
        const damped = stepCameraDamper(camX, camVelX, targetCamX, 0.18, dt);
        camX = clamp(damped.position, -maxPanHalf, maxPanHalf);
        camVelX = damped.velocity;
      }

      const allowParallax =
        canHover && !reducedMotion && (mode === 'EXPLORING' || mode === 'TITLE_IDLE');
      const targetParallaxX = allowParallax ? rawMouseX * 0.45 : 0;
      const targetParallaxY = allowParallax ? rawMouseY * 0.25 : 0;
      const pAlpha = reducedMotion ? 1 : 1 - Math.exp(-(1 / 0.12) * dt);
      parallaxX += (targetParallaxX - parallaxX) * pAlpha;
      parallaxY += (targetParallaxY - parallaxY) * pAlpha;

      const desiredBaseY = framing.targetOffsetY + 0.6;
      const yAlpha = reducedMotion ? 1 : 1 - Math.exp(-8 * dt);
      camY += (desiredBaseY - camY) * yAlpha;

      camera.position.set(camX + parallaxX, camY + parallaxY, framing.cameraZ);
      camera.lookAt(camX + parallaxX * 0.25, framing.targetOffsetY, 0);
    },
  };
}
