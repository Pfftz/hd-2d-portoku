import {
  HERO_WORLD_HEIGHT,
  HERO_WORLD_WIDTH,
  HORIZON_Y,
  type LandmarkKey,
} from '../scene/layout.ts';

export type PlateKey =
  | 'citadel'
  | 'ghostCastle'
  | 'watchtower'
  | 'clouds'
  | 'foregroundLip';

export interface PlateSpec {
  path: string;
  z: number;
  parallax: number;
  horizonY: number;
  fogMix: number;
  tileX: boolean;
  offsetX: number;
  offsetY: number;
  worldWidth: number;
  worldHeight: number;
}

export interface LandmarkAssetSpec {
  path: string;
  worldWidth: number;
  worldHeight: number;
  zOffset: number;
  hitRadius: number;
  glowSize: number;
}

export interface AssetManifest {
  sprite: {
    path: string;
    frameW: 64;
    frameH: 64;
    gutterPx: 2;
    cellStridePx: 68;
    idleRow: number;
    idleFrames: number;
    idleFps: number;
    walkRow: number;
    walkFrames: number;
    walkFps: number;
    footPivotY: number;
    worldWidth: number;
    worldHeight: number;
  };
  foliage: {
    leavesPath: string;
    bellsPath: string;
    cols: number;
    rows: number;
    cellPx: number;
    leafCells: number;
    bellCells: number;
  };
  plates: Record<PlateKey, PlateSpec>;
  landmarks: Record<LandmarkKey, LandmarkAssetSpec>;
  audio: {
    primary: string;
    fallbackOgg: string;
  };
}

export function resolveAssetUrl(relativePath: string): string {
  const rawBase =
    (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? './';
  const normalizedBase = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
  const cleanRel = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
  return `${normalizedBase}${cleanRel}`;
}

export const ASSET_MANIFEST: AssetManifest = {
  sprite: {
    path: 'assets/sprites/hero.png',
    frameW: 64,
    frameH: 64,
    gutterPx: 2,
    cellStridePx: 68,
    idleRow: 0,
    idleFrames: 4,
    idleFps: 6,
    walkRow: 1,
    walkFrames: 6,
    walkFps: 10,
    footPivotY: 4,
    worldWidth: HERO_WORLD_WIDTH,
    worldHeight: HERO_WORLD_HEIGHT,
  },
  foliage: {
    leavesPath: 'assets/foliage/lily-leaves.png',
    bellsPath: 'assets/foliage/lily-bells.png',
    cols: 2,
    rows: 2,
    cellPx: 128,
    leafCells: 4,
    bellCells: 4,
  },
  plates: {
    citadel: {
      path: 'assets/backdrop/citadel.webp',
      z: -55,
      parallax: 0.78,
      horizonY: HORIZON_Y,
      fogMix: 0.18,
      tileX: false,
      offsetX: -14.0,
      offsetY: 4.5,
      worldWidth: 20.0,
      worldHeight: 15.0,
    },
    ghostCastle: {
      path: 'assets/backdrop/ghost-castle.webp',
      z: -60,
      parallax: 0.85,
      horizonY: HORIZON_Y,
      fogMix: 0.25,
      tileX: false,
      offsetX: 0.0,
      offsetY: 5.5,
      worldWidth: 16.0,
      worldHeight: 14.0,
    },
    watchtower: {
      path: 'assets/backdrop/watchtower.webp',
      z: -32,
      parallax: 0.55,
      horizonY: HORIZON_Y,
      fogMix: 0.12,
      tileX: false,
      offsetX: 15.5,
      offsetY: 3.5,
      worldWidth: 14.0,
      worldHeight: 14.0,
    },
    clouds: {
      path: 'assets/backdrop/clouds.webp',
      z: -42,
      parallax: 0.7,
      horizonY: HORIZON_Y,
      fogMix: 0.0,
      tileX: true,
      offsetX: 0.0,
      offsetY: 4.0,
      worldWidth: 104.0,
      worldHeight: 28.0,
    },
    foregroundLip: {
      path: 'assets/backdrop/foreground-lip.webp',
      z: 1.8,
      parallax: 0.0,
      horizonY: HORIZON_Y,
      fogMix: 0.0,
      tileX: false,
      offsetX: 0.0,
      offsetY: -3.1,
      worldWidth: 64.0,
      worldHeight: 5.0,
    },
  },
  landmarks: {
    about: {
      path: 'assets/landmarks/about.png',
      worldWidth: 1.8,
      worldHeight: 1.8,
      zOffset: -0.15,
      hitRadius: 1.4,
      glowSize: 2.4,
    },
    works: {
      path: 'assets/landmarks/works.png',
      worldWidth: 1.8,
      worldHeight: 1.8,
      zOffset: -0.15,
      hitRadius: 1.4,
      glowSize: 2.4,
    },
    interests: {
      path: 'assets/landmarks/interests.png',
      worldWidth: 1.8,
      worldHeight: 1.8,
      zOffset: -0.15,
      hitRadius: 1.4,
      glowSize: 2.4,
    },
    contact: {
      path: 'assets/landmarks/contact.png',
      worldWidth: 1.8,
      worldHeight: 1.8,
      zOffset: -0.15,
      hitRadius: 1.4,
      glowSize: 2.4,
    },
  },
  audio: {
    primary: 'assets/audio/theme.mp3',
    fallbackOgg: 'assets/audio/theme.ogg',
  },
};
