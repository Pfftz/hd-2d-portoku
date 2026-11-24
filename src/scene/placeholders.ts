import * as THREE from 'three';
import { ASSET_MANIFEST, resolveAssetUrl, type PlateKey, type PlateSpec } from '../assets/manifest.ts';
import type { LandmarkKey } from './layout.ts';

export type AssetSourceKind = 'webp' | 'png' | 'placeholder';

export interface DiagRecorder {
  assetSources: Record<string, AssetSourceKind>;
  recordEvent: (message: string) => void;
}

const MAX_PLACEHOLDER_PX = 2048;

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.min(MAX_PLACEHOLDER_PX, Math.round(width)));
  canvas.height = Math.max(1, Math.min(MAX_PLACEHOLDER_PX, Math.round(height)));
  return canvas;
}

export function createHeroPlaceholderTexture(): THREE.CanvasTexture {
  const { frameW, frameH, gutterPx, cellStridePx, idleFrames, walkFrames, footPivotY } =
    ASSET_MANIFEST.sprite;
  const cols = Math.max(idleFrames, walkFrames);
  const rows = 2;
  const canvas = makeCanvas(cols * cellStridePx, rows * cellStridePx);
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let row = 0; row < rows; row += 1) {
      const count = row === 0 ? idleFrames : walkFrames;
      for (let col = 0; col < count; col += 1) {
        const ox = col * cellStridePx + gutterPx;
        const oy = row * cellStridePx + gutterPx;

        // Cell frame guide
        ctx.strokeStyle = 'rgba(201, 206, 214, 0.55)';
        ctx.lineWidth = 1;
        ctx.strokeRect(ox + 0.5, oy + 0.5, frameW - 1, frameH - 1);

        // Lower tan-brown boots / skirt
        ctx.fillStyle = '#9c7a54';
        ctx.fillRect(ox + 24, oy + 40, 16, 18);

        // Upper white + royal-blue tunic
        ctx.fillStyle = '#f2efe4';
        ctx.fillRect(ox + 22, oy + 24, 20, 16);
        ctx.fillStyle = '#2b4c9b';
        ctx.fillRect(ox + 25, oy + 25, 14, 15);

        // Head + flowing cobalt/periwinkle hair (trailing right in wind)
        ctx.fillStyle = '#e8d8c8';
        ctx.fillRect(ox + 26, oy + 12, 10, 12);
        const sway = row === 0 ? (col % 2) * 2 : (col % 3) - 1;
        ctx.fillStyle = '#4e6cd4';
        ctx.fillRect(ox + 26, oy + 9, 14, 7);
        ctx.fillRect(ox + 33 + sway, oy + 14, 14, 20);
        ctx.fillStyle = '#c8d6f8';
        ctx.fillRect(ox + 27, oy + 10, 8, 2);

        // Foot pivot line
        ctx.fillStyle = '#f2efe4';
        ctx.fillRect(ox + 20, oy + frameH - footPivotY, 24, 1);

        ctx.fillStyle = '#141820';
        ctx.font = 'bold 9px monospace';
        ctx.fillText(`${row === 0 ? 'I' : 'W'}${col}`, ox + 4, oy + 11);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

export function createPlatePlaceholderTexture(
  key: PlateKey,
  spec: PlateSpec,
): THREE.CanvasTexture {
  const pxScale = Math.min(
    40,
    MAX_PLACEHOLDER_PX / spec.worldWidth,
    MAX_PLACEHOLDER_PX / spec.worldHeight,
  );
  const w = Math.max(128, Math.round(spec.worldWidth * pxScale));
  const h = Math.max(64, Math.round(spec.worldHeight * pxScale));
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.clearRect(0, 0, w, h);
    if (key === 'citadel') {
      ctx.fillStyle = 'rgba(220, 225, 232, 0.88)';
      ctx.fillRect(w * 0.08, h * 0.25, w * 0.72, h * 0.55);
      ctx.fillStyle = 'rgba(74, 85, 104, 0.85)';
      ctx.fillRect(w * 0.05, h * 0.65, w * 0.85, h * 0.35);
      ctx.fillStyle = 'rgba(235, 238, 242, 0.92)';
      ctx.fillRect(w * 0.22, h * 0.08, w * 0.08, h * 0.3);
      ctx.fillRect(w * 0.45, h * 0.12, w * 0.1, h * 0.28);
    } else if (key === 'ghostCastle') {
      ctx.fillStyle = 'rgba(201, 206, 214, 0.52)';
      ctx.fillRect(w * 0.25, h * 0.35, w * 0.5, h * 0.55);
      ctx.fillRect(w * 0.42, h * 0.14, w * 0.14, h * 0.3);
    } else if (key === 'watchtower') {
      ctx.fillStyle = 'rgba(78, 84, 74, 0.9)';
      ctx.fillRect(w * 0.25, h * 0.32, w * 0.08, h * 0.58);
      ctx.fillRect(w * 0.48, h * 0.22, w * 0.24, h * 0.68);
      ctx.beginPath();
      ctx.moveTo(w * 0.44, h * 0.22);
      ctx.lineTo(w * 0.6, h * 0.06);
      ctx.lineTo(w * 0.76, h * 0.22);
      ctx.closePath();
      ctx.fill();
    } else if (key === 'clouds') {
      ctx.fillStyle = 'rgba(242, 239, 228, 0.78)';
      for (let i = 0; i < 6; i += 1) {
        ctx.beginPath();
        ctx.arc((i + 0.5) * (w / 6), h * 0.58, w / 9, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (key === 'foregroundLip') {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, 'rgba(91, 110, 93, 0)');
      grad.addColorStop(0.38, 'rgba(91, 110, 93, 0.72)');
      grad.addColorStop(1, 'rgba(74, 90, 76, 0.96)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(242, 239, 228, 0.72)';
      for (let x = 24; x < w; x += 48) {
        ctx.fillRect(x, h * 0.32, 6, 8);
      }
    }

    // Calibration frame + label
    ctx.strokeStyle = 'rgba(74, 85, 104, 0.65)';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, w - 4, h - 4);

    const horizonPx = Math.round((1 - spec.horizonY) * h);
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = 'rgba(242, 239, 228, 0.75)';
    ctx.beginPath();
    ctx.moveTo(0, horizonPx);
    ctx.lineTo(w, horizonPx);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(20, 24, 32, 0.78)';
    ctx.fillRect(8, 8, Math.min(w - 16, 290), 26);
    ctx.fillStyle = '#f2efe4';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(
      `[PLACEHOLDER: ${key}] ${spec.worldWidth.toFixed(1)}x${spec.worldHeight.toFixed(1)}u`,
      14,
      26,
    );
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  if (spec.tileX) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
  }
  texture.needsUpdate = true;
  return texture;
}

export function createLandmarkPlaceholderTexture(key: LandmarkKey): THREE.CanvasTexture {
  const canvas = makeCanvas(128, 128);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 128, 128);
    ctx.fillStyle = 'rgba(74, 85, 104, 0.9)';
    ctx.fillRect(42, 30, 44, 86);
    ctx.strokeStyle = '#f2efe4';
    ctx.lineWidth = 2;
    ctx.strokeRect(42, 30, 44, 86);
    ctx.fillStyle = '#f2efe4';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(key.toUpperCase(), 32, 22);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export interface TextureLoadOptions {
  key: string;
  primaryPath: string;
  placeholder: THREE.Texture;
  diag: DiagRecorder;
  onApplied: (texture: THREE.Texture, source: AssetSourceKind) => void;
  isSprite?: boolean;
  tileX?: boolean;
}

export function loadTextureWithPlaceholder(options: TextureLoadOptions): void {
  const { key, primaryPath, placeholder, diag, onApplied, isSprite = false, tileX = false } =
    options;
  diag.assetSources[key] = 'placeholder';
  onApplied(placeholder, 'placeholder');

  const loader = new THREE.TextureLoader();

  const applyLoaded = (loaded: THREE.Texture, source: 'webp' | 'png'): void => {
    loaded.colorSpace = THREE.SRGBColorSpace;
    if (isSprite) {
      loaded.magFilter = THREE.NearestFilter;
      loaded.minFilter = THREE.NearestFilter;
      loaded.generateMipmaps = false;
    }
    if (tileX) {
      loaded.wrapS = THREE.RepeatWrapping;
      loaded.wrapT = THREE.ClampToEdgeWrapping;
    }
    loaded.needsUpdate = true;
    diag.assetSources[key] = source;
    diag.recordEvent(`Loaded ${key} (${source})`);
    onApplied(loaded, source);
    placeholder.dispose();
  };

  loader.load(
    resolveAssetUrl(primaryPath),
    (tex) => applyLoaded(tex, primaryPath.endsWith('.webp') ? 'webp' : 'png'),
    undefined,
    () => {
      if (primaryPath.endsWith('.webp')) {
        const pngPath = primaryPath.replace(/\.webp$/i, '.png');
        loader.load(
          resolveAssetUrl(pngPath),
          (tex) => applyLoaded(tex, 'png'),
          undefined,
          () => {
            diag.recordEvent(`Using placeholder for ${key} (asset not found)`);
          },
        );
        return;
      }
      diag.recordEvent(`Using placeholder for ${key} (asset not found)`);
    },
  );
}
