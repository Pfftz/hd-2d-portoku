import * as THREE from 'three';
import { ASSET_MANIFEST } from '../assets/manifest.ts';
import { HERO_WORLD_HEIGHT, HERO_WORLD_WIDTH, sampleRidge } from './layout.ts';
import {
  createHeroPlaceholderTexture,
  loadTextureWithPlaceholder,
  type DiagRecorder,
} from './placeholders.ts';

export interface HeroController {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  update: (params: {
    t: number;
    facingDir: -1 | 1;
    isMoving: boolean;
    reducedMotion: boolean;
    dt: number;
  }) => void;
  dispose: () => void;
}

export function createHeroController(diag: DiagRecorder): HeroController {
  const spriteSpec = ASSET_MANIFEST.sprite;
  const cols = Math.max(spriteSpec.idleFrames, spriteSpec.walkFrames);
  const rows = 2;
  const sheetWidthPx = cols * spriteSpec.cellStridePx;
  const sheetHeightPx = rows * spriteSpec.cellStridePx;

  const geometry = new THREE.PlaneGeometry(HERO_WORLD_WIDTH, HERO_WORLD_HEIGHT);
  const placeholder = createHeroPlaceholderTexture();
  const material = new THREE.MeshBasicMaterial({
    map: placeholder,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
    transparent: false,
    fog: false,
  });

  const mesh = new THREE.Mesh(geometry, material);
  const footAnchorOffset = HERO_WORLD_HEIGHT * (0.5 - spriteSpec.footPivotY / spriteSpec.frameH);

  let currentTexture: THREE.Texture = placeholder;
  const applyUvFrame = (row: number, col: number): void => {
    const uRepeat = spriteSpec.frameW / sheetWidthPx;
    const vRepeat = spriteSpec.frameH / sheetHeightPx;
    const uOffset = (spriteSpec.gutterPx + col * spriteSpec.cellStridePx) / sheetWidthPx;
    const vOffset =
      1 - (spriteSpec.gutterPx + row * spriteSpec.cellStridePx + spriteSpec.frameH) / sheetHeightPx;
    currentTexture.repeat.set(uRepeat, vRepeat);
    currentTexture.offset.set(uOffset, vOffset);
  };

  applyUvFrame(spriteSpec.idleRow, 0);

  loadTextureWithPlaceholder({
    key: 'hero',
    primaryPath: spriteSpec.path,
    placeholder,
    diag,
    isSprite: true,
    onApplied(tex) {
      currentTexture = tex;
      material.map = tex;
      material.needsUpdate = true;
      applyUvFrame(spriteSpec.idleRow, 0);
    },
  });

  let animTime = 0;
  let lastMoving = false;

  return {
    mesh,
    update({ t, facingDir, isMoving, reducedMotion, dt }) {
      const point = sampleRidge(t);
      mesh.position.set(point.x, point.y + footAnchorOffset, point.z);
      mesh.scale.x = facingDir === 1 ? -1 : 1;

      if (isMoving !== lastMoving) {
        animTime = 0;
        lastMoving = isMoving;
      }
      if (!reducedMotion || isMoving) {
        animTime += dt;
      }

      const row = isMoving ? spriteSpec.walkRow : spriteSpec.idleRow;
      const frameCount = isMoving ? spriteSpec.walkFrames : spriteSpec.idleFrames;
      const fps = isMoving ? spriteSpec.walkFps : spriteSpec.idleFps;
      const col = reducedMotion && !isMoving ? 0 : Math.floor(animTime * fps) % frameCount;
      applyUvFrame(row, col);
    },
    dispose() {
      geometry.dispose();
      currentTexture.dispose();
      material.dispose();
    },
  };
}
