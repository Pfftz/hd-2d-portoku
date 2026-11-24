export type LandmarkKey = 'about' | 'works' | 'interests' | 'contact';

export const SAFE_ASPECT = 4 / 3;
export const SAFE_WIDTH = 16;
export const RIDGE_LENGTH = 48;
export const WALK_SPEED = 4.8;
export const INTERACT_RADIUS = 2.0;
export const BASE_FOV = 38;
export const BASE_CAMERA_Z = 18;
export const CAMERA_NEAR = 0.5;
export const CAMERA_FAR = 200;
export const DEADZONE_HALF_WIDTH = 1.6;
export const MAX_CAMERA_PAN = 16;
export const BASE_TARGET_Y = 2.85;
export const HORIZON_Y = 0.35;
export const PORTRAIT_VERTICAL_OVERDRAW = 1.65;
export const HERO_WORLD_WIDTH = 3.0;
export const HERO_WORLD_HEIGHT = 3.0;

export const MASTER_CANVAS_WIDTH = 3840;
export const MASTER_CANVAS_HEIGHT = 1600;
export const MASTER_PX_PER_UNIT = 40;
export const MASTER_HORIZON_PX_Y = 1040;

// Spacing puts `about` at t=0.43 (3.36u from center spawn t=0.50, outside INTERACT_RADIUS=2.0).
export const LANDMARK_T: Record<LandmarkKey, number> = {
  interests: 0.14,
  about: 0.43,
  works: 0.68,
  contact: 0.86,
} as const;

export interface RidgePoint {
  x: number;
  y: number;
  z: number;
}

export interface CameraFraming {
  cameraZ: number;
  fov: number;
  targetOffsetY: number;
  pullback: number;
  isPortrait: boolean;
}

export interface CropManifestPlacement {
  offsetX: number;
  offsetY: number;
  worldWidth: number;
  worldHeight: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function xToSplineT(worldX: number): number {
  return clamp(worldX / RIDGE_LENGTH + 0.5, 0, 1);
}

export function sampleRidge(t: number): RidgePoint {
  const clamped = clamp(t, 0, 1);
  return {
    x: (clamped - 0.5) * RIDGE_LENGTH,
    y: 0.35 * (clamped - 0.5) + 0.25 * Math.sin(Math.PI * clamped),
    z: -0.3 * Math.sin(Math.PI * (clamped - 0.5)),
  };
}

export function computeEndpointDamping(t: number, dir: -1 | 0 | 1): number {
  if (dir === 0) {
    return 1.0;
  }
  const clamped = clamp(t, 0, 1);
  if (clamped < 0.05) {
    if (dir > 0) {
      return 1.0;
    }
    const u = clamp(clamped / 0.05, 0, 1);
    return u * u * (3 - 2 * u);
  }
  if (clamped > 0.95) {
    if (dir < 0) {
      return 1.0;
    }
    const u = clamp((1 - clamped) / 0.05, 0, 1);
    return u * u * (3 - 2 * u);
  }
  return 1.0;
}

export function frustumWidthAtZ(z: number, aspect: number): number {
  const halfRad = (BASE_FOV * Math.PI) / 360;
  const distance = BASE_CAMERA_Z - z;
  return 2 * Math.tan(halfRad) * distance * aspect;
}

export function minPlateWidth(z: number, parallax: number): number {
  return frustumWidthAtZ(z, 21 / 9) + MAX_CAMERA_PAN * (1 - parallax);
}

export function computeCameraFraming(aspect: number): CameraFraming {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : SAFE_ASPECT;
  if (safeAspect >= SAFE_ASPECT) {
    return {
      cameraZ: BASE_CAMERA_Z,
      fov: BASE_FOV,
      targetOffsetY: BASE_TARGET_Y,
      pullback: 1.0,
      isPortrait: false,
    };
  }
  if (safeAspect >= 1.0) {
    const t = clamp((SAFE_ASPECT - safeAspect) / (SAFE_ASPECT - 1.0), 0, 1);
    const pullback = 1.0 + t * 0.15;
    return {
      cameraZ: BASE_CAMERA_Z * pullback,
      fov: BASE_FOV,
      targetOffsetY: BASE_TARGET_Y,
      pullback,
      isPortrait: false,
    };
  }
  const pullback = clamp(1.15 + ((1.0 - safeAspect) / 0.44) * 0.3, 1.15, 1.45);
  return {
    cameraZ: BASE_CAMERA_Z * pullback,
    fov: BASE_FOV,
    targetOffsetY: BASE_TARGET_Y - (pullback - 1.0) * 1.4,
    pullback,
    isPortrait: true,
  };
}

export function cropPixelsToManifest(
  cropX: number,
  cropY: number,
  cropW: number,
  cropH: number,
): CropManifestPlacement {
  const centerX = cropX + cropW * 0.5;
  const centerY = cropY + cropH * 0.5;
  return {
    offsetX: (centerX - MASTER_CANVAS_WIDTH * 0.5) / MASTER_PX_PER_UNIT,
    offsetY: (MASTER_HORIZON_PX_Y - centerY) / MASTER_PX_PER_UNIT,
    worldWidth: cropW / MASTER_PX_PER_UNIT,
    worldHeight: cropH / MASTER_PX_PER_UNIT,
  };
}
