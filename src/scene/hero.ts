import * as THREE from 'three';
import { ASSET_MANIFEST } from '../assets/manifest.ts';
import { HERO_WORLD_HEIGHT, HERO_WORLD_WIDTH, sampleRidge } from './layout.ts';
import {
  createHeroPlaceholderTexture,
  createSoftHaloTexture,
  loadTextureWithPlaceholder,
  type DiagRecorder,
} from './placeholders.ts';

export interface HeroController {
  group: THREE.Group;
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

  const group = new THREE.Group();
  const geometry = new THREE.PlaneGeometry(HERO_WORLD_WIDTH, HERO_WORLD_HEIGHT);
  const placeholder = createHeroPlaceholderTexture();
  const material = new THREE.MeshBasicMaterial({
    map: placeholder,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
    transparent: false,
    fog: false,
  });

  material.onBeforeCompile = (shader) => {
    shader.vertexShader =
      'varying vec2 vHeroLocalUv;\n' +
      shader.vertexShader.replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
        vHeroLocalUv = uv;`,
      );
    shader.fragmentShader =
      'varying vec2 vHeroLocalUv;\n' +
      shader.fragmentShader.replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        float heroLuma = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        diffuseColor.rgb = clamp(mix(vec3(heroLuma), diffuseColor.rgb, 1.06), 0.0, 1.0);
        float crown = smoothstep(0.56, 0.94, vHeroLocalUv.y);
        float brightMask = smoothstep(0.22, 0.78, heroLuma);
        diffuseColor.rgb = min(vec3(1.0), diffuseColor.rgb + vec3(0.11, 0.105, 0.085) * crown * brightMask);`,
      );
  };
  material.customProgramCacheKey = () => 'hero-overcast-lit-v2';

  const mesh = new THREE.Mesh(geometry, material);
  const footAnchorOffset = HERO_WORLD_HEIGHT * (0.5 - spriteSpec.footPivotY / spriteSpec.frameH);

  const backlightGeo = new THREE.PlaneGeometry(5.4, 4.8);
  const backlightTex = createSoftHaloTexture();
  const backlightMat = new THREE.MeshBasicMaterial({
    map: backlightTex,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    fog: false,
  });
  const backlightMesh = new THREE.Mesh(backlightGeo, backlightMat);
  backlightMesh.renderOrder = -1;

  group.add(backlightMesh);
  group.add(mesh);

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
    group,
    mesh,
    update({ t, facingDir, isMoving, reducedMotion, dt }) {
      const point = sampleRidge(t);
      mesh.position.set(point.x, point.y + footAnchorOffset, point.z);
      mesh.scale.x = facingDir === 1 ? -1 : 1;
      backlightMesh.position.set(point.x, point.y + footAnchorOffset + 0.2, point.z - 0.35);

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
      backlightGeo.dispose();
      backlightTex.dispose();
      backlightMat.dispose();
    },
  };
}
