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
    opus: string;
    primary: string;
    fallbackM4a: string;
    fallbackOgg: string;
  };
}

export function resolveAssetUrl(relativePath: string): string {
  const rawBase =
    (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? './';
  const normalizedBase = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
  const cleanRel = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
  return `${normalizedBase}${encodeURI(cleanRel)}`;
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
      z: -46,
      parallax: 0.7,
      horizonY: HORIZON_Y,
      fogMix: 0.05,
      tileX: false,
      offsetX: -20.25,
      offsetY: 6.838,
      worldWidth: 37.5,
      worldHeight: 25.925,
    },
    ghostCastle: {
      path: 'assets/backdrop/ghost-castle.webp',
      z: -62,
      parallax: 0.86,
      horizonY: HORIZON_Y,
      fogMix: 0.06,
      tileX: false,
      offsetX: 4.487,
      offsetY: 4.15,
      worldWidth: 108.925,
      worldHeight: 23.7,
    },
    watchtower: {
      path: 'assets/backdrop/watchtower.webp',
      z: -30,
      parallax: 0.48,
      horizonY: HORIZON_Y,
      fogMix: 0.04,
      tileX: false,
      offsetX: 23.163,
      offsetY: 6.0,
      worldWidth: 16.325,
      worldHeight: 26.0,
    },
    clouds: {
      path: 'assets/backdrop/clouds.webp',
      z: -22,
      parallax: 0.34,
      horizonY: HORIZON_Y,
      fogMix: 0.0,
      tileX: true,
      offsetX: 0.0,
      offsetY: 0.0,
      worldWidth: 96.0,
      worldHeight: 11.0,
    },
    foregroundLip: {
      path: 'assets/backdrop/foreground-lip.webp',
      z: 1.8,
      parallax: 0.0,
      horizonY: HORIZON_Y,
      fogMix: 0.0,
      tileX: false,
      offsetX: 0.0,
      offsetY: -2.8,
      worldWidth: 64.0,
      worldHeight: 8.0,
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
    opus: 'assets/Musics/Valkyrie Profile OST - To a World Becoming Impure.opus',
    primary: 'assets/audio/theme.mp3',
    fallbackM4a: 'assets/audio/theme.m4a',
    fallbackOgg: 'assets/audio/theme.ogg',
  },
};
