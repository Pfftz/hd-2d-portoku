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
  const { frameH, gutterPx, cellStridePx, idleFrames, walkFrames, footPivotY } =
    ASSET_MANIFEST.sprite;
  const cols = Math.max(idleFrames, walkFrames);
  const rows = 2;
  const footY = frameH - footPivotY;
  const canvas = makeCanvas(cols * cellStridePx, rows * cellStridePx);
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let row = 0; row < rows; row += 1) {
      const count = row === 0 ? idleFrames : walkFrames;
      for (let col = 0; col < count; col += 1) {
        const ox = col * cellStridePx + gutterPx;
        const oy = row * cellStridePx + gutterPx;
        const stride = row === 1 ? ((col % 3) - 1) * 2 : 0;
        const sway = row === 0 ? (col % 2) * 2 : (col % 3) - 1;

        // Lower tan-brown boots / hem anchored to footPivotY
        ctx.fillStyle = '#6e5136';
        ctx.fillRect(ox + 26 + stride, oy + footY - 11, 5, 11);
        ctx.fillRect(ox + 33 - stride, oy + footY - 11, 5, 11);
        ctx.fillStyle = '#9c7a54';
        ctx.fillRect(ox + 24, oy + 39, 16, 11);

        // Upper white + royal-blue tunic (left 3/4 profile)
        ctx.fillStyle = '#f2efe4';
        ctx.fillRect(ox + 23, oy + 25, 17, 15);
        ctx.fillStyle = '#2b4c9b';
        ctx.fillRect(ox + 25, oy + 26, 13, 14);
        ctx.fillStyle = '#d4b468';
        ctx.fillRect(ox + 25, oy + 38, 14, 2);

        // Head + flowing periwinkle-to-cobalt hair trailing right
        ctx.fillStyle = '#ebd8c7';
        ctx.fillRect(ox + 25, oy + 14, 10, 11);
        ctx.fillStyle = '#4e6cd4';
        ctx.fillRect(ox + 24, oy + 10, 14, 6);
        ctx.fillRect(ox + 33, oy + 14, 10, 16);
        ctx.fillRect(ox + 39 + sway, oy + 19, 10, 18);
        ctx.fillRect(ox + 44 + sway, oy + 26, 7, 13);
        ctx.fillStyle = '#c8d6f8';
        ctx.fillRect(ox + 26, oy + 12, 8, 2);
        ctx.fillRect(ox + 36, oy + 17, 4, 8);
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
      // Tiered silver-white Gothic citadel spires descending right toward sage foothills
      ctx.fillStyle = 'rgba(220, 224, 232, 0.9)';
      ctx.fillRect(0, h * 0.24, w * 0.62, h * 0.44);
      ctx.fillRect(w * 0.48, h * 0.36, w * 0.26, h * 0.34);
      ctx.fillStyle = 'rgba(236, 238, 242, 0.94)';
      const spires = [0.06, 0.16, 0.28, 0.41, 0.56];
      for (const sx of spires) {
        ctx.fillRect(w * sx, h * 0.08, w * 0.06, h * 0.22);
        ctx.beginPath();
        ctx.moveTo(w * (sx - 0.01), h * 0.08);
        ctx.lineTo(w * (sx + 0.03), h * 0.01);
        ctx.lineTo(w * (sx + 0.07), h * 0.08);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(74, 85, 104, 0.72)';
      ctx.fillRect(0, h * 0.44, w * 0.72, h * 0.24);
      ctx.fillStyle = 'rgba(91, 110, 93, 0.85)';
      ctx.beginPath();
      ctx.moveTo(0, h * 0.6);
      ctx.lineTo(w * 0.42, h * 0.64);
      ctx.lineTo(w * 0.94, h * 0.92);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();
    } else if (key === 'ghostCastle') {
      const grad = ctx.createLinearGradient(0, h * 0.1, 0, h * 0.92);
      grad.addColorStop(0, 'rgba(201, 206, 214, 0.52)');
      grad.addColorStop(1, 'rgba(242, 239, 228, 0.05)');
      ctx.fillStyle = grad;
      ctx.fillRect(w * 0.24, h * 0.36, w * 0.52, h * 0.54);
      ctx.fillRect(w * 0.42, h * 0.12, w * 0.16, h * 0.26);
      ctx.fillRect(w * 0.28, h * 0.22, w * 0.09, h * 0.18);
      ctx.fillRect(w * 0.63, h * 0.25, w * 0.09, h * 0.16);
    } else if (key === 'watchtower') {
      // Slender dark olive-grey obelisk (left) + tall stepped watchtower (right)
      ctx.fillStyle = 'rgba(74, 80, 70, 0.9)';
      ctx.beginPath();
      ctx.moveTo(w * 0.12, h * 0.92);
      ctx.lineTo(w * 0.15, h * 0.44);
      ctx.lineTo(w * 0.18, h * 0.44);
      ctx.lineTo(w * 0.21, h * 0.92);
      ctx.closePath();
      ctx.fill();

      ctx.fillRect(w * 0.48, h * 0.28, w * 0.36, h * 0.68);
      ctx.fillStyle = 'rgba(92, 98, 86, 0.92)';
      ctx.fillRect(w * 0.54, h * 0.16, w * 0.24, h * 0.14);
      ctx.beginPath();
      ctx.moveTo(w * 0.52, h * 0.16);
      ctx.lineTo(w * 0.66, h * 0.03);
      ctx.lineTo(w * 0.8, h * 0.16);
      ctx.closePath();
      ctx.fill();
    } else if (key === 'clouds') {
      // Single continuous periodic cloud-bank contour so WrapS repeats cleanly with zero arc seams
      const cloudGrad = ctx.createLinearGradient(0, h * 0.16, 0, h);
      cloudGrad.addColorStop(0, 'rgba(242, 239, 228, 0.0)');
      cloudGrad.addColorStop(0.24, 'rgba(242, 239, 228, 0.86)');
      cloudGrad.addColorStop(0.84, 'rgba(235, 231, 220, 0.94)');
      cloudGrad.addColorStop(1, 'rgba(235, 231, 220, 0.0)');
      ctx.fillStyle = cloudGrad;

      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 6) {
        const u = x / w;
        const crestY =
          h *
          (0.45 -
            0.14 * Math.sin(2 * Math.PI * (u - 0.5)) -
            0.05 * Math.sin(4 * Math.PI * u + 0.7) -
            0.03 * Math.cos(6 * Math.PI * u));
        ctx.lineTo(x, crestY);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
    } else if (key === 'foregroundLip') {
      // Soft pre-feathered bottom lip framing foreground leaves without occluding back-slope lilies
      const meadowGrad = ctx.createLinearGradient(0, h * 0.38, 0, h);
      meadowGrad.addColorStop(0, 'rgba(78, 96, 80, 0.0)');
      meadowGrad.addColorStop(0.32, 'rgba(66, 82, 68, 0.28)');
      meadowGrad.addColorStop(0.7, 'rgba(54, 68, 56, 0.62)');
      meadowGrad.addColorStop(1, 'rgba(44, 56, 46, 0.84)');
      ctx.fillStyle = meadowGrad;
      ctx.fillRect(0, h * 0.38, w, h * 0.62);

      for (let i = 0; i < w; i += 22) {
        const hash = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
        const tipY = h * (0.44 + hash * 0.14);
        const lean = (hash - 0.5) * 24;
        ctx.fillStyle =
          i % 44 === 0 ? 'rgba(84, 102, 86, 0.48)' : 'rgba(62, 78, 64, 0.55)';
        ctx.beginPath();
        ctx.moveTo(i - 9, h);
        ctx.quadraticCurveTo(i + lean * 0.3 - 10, tipY + h * 0.16, i + lean, tipY);
        ctx.quadraticCurveTo(i + lean * 0.5 + 10, tipY + h * 0.18, i + 10, h);
        ctx.closePath();
        ctx.fill();
      }

      for (let x = 18; x < w; x += 36) {
        const seed = Math.abs(Math.sin(x * 78.233) * 19341.1) % 1;
        const topY = h * (0.58 + seed * 0.24);
        ctx.fillStyle = 'rgba(242, 239, 228, 0.55)';
        for (let b = 0; b < 2; b += 1) {
          ctx.beginPath();
          ctx.arc(x + b * 7, topY + b * 10, 4.2 - b * 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    if (key !== 'foregroundLip' && key !== 'clouds') {
      const labelX = key === 'citadel' ? Math.round(w * 0.28) : 8;
      const boxW = Math.min(w - labelX - 8, 250);
      ctx.fillStyle = 'rgba(20, 24, 32, 0.65)';
      ctx.fillRect(labelX, 8, boxW, 22);
      ctx.fillStyle = '#f2efe4';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(
        `[PLACEHOLDER: ${key}] ${spec.worldWidth.toFixed(0)}x${spec.worldHeight.toFixed(0)}u`,
        labelX + 6,
        23,
      );
    }
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

export function createFoliagePlaceholderTexture(
  kind: 'leaves' | 'bells',
): THREE.CanvasTexture {
  const { cols, rows, cellPx } = ASSET_MANIFEST.foliage;
  const canvas = makeCanvas(cols * cellPx, rows * cellPx);
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const drawBlade = (
      ox: number,
      oy: number,
      rootX: number,
      tipX: number,
      tipY: number,
      halfW: number,
      color: string,
      veinColor?: string,
    ): void => {
      const baseY = oy + cellPx - 2;
      const midY = (baseY + tipY) * 0.5;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(ox + rootX - 4, baseY);
      ctx.quadraticCurveTo(ox + (rootX + tipX) * 0.5 - halfW, midY - 6, ox + tipX, oy + tipY);
      ctx.quadraticCurveTo(ox + (rootX + tipX) * 0.5 + halfW, midY + 4, ox + rootX + 4, baseY);
      ctx.closePath();
      ctx.fill();

      if (veinColor) {
        ctx.strokeStyle = veinColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(ox + rootX, baseY - 2);
        ctx.quadraticCurveTo(ox + (rootX + tipX) * 0.5, midY, ox + tipX, oy + tipY + 6);
        ctx.stroke();
      }
    };

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const ox = col * cellPx;
        const oy = row * cellPx;
        const variant = row * cols + col;

        if (kind === 'leaves') {
          const leanSign = variant % 2 === 0 ? 1 : -1;
          drawBlade(ox, oy, 56, 36 + leanSign * 14, 16, 17, '#4c604f');
          drawBlade(
            ox,
            oy,
            66,
            78 + leanSign * 12,
            10,
            18,
            '#5b6e5d',
            'rgba(182, 198, 180, 0.38)',
          );
          drawBlade(
            ox,
            oy,
            74,
            96 - leanSign * 16,
            24,
            15,
            '#6c806d',
            'rgba(196, 210, 192, 0.34)',
          );
          drawBlade(ox, oy, 62, 54 - leanSign * 12, 34, 14, '#546856');
        } else {
          const lean = variant % 2 === 0 ? 1 : -1;
          const archTipX = 64 + lean * 28;
          const archTipY = 18 + (variant % 3) * 4;

          // Subtle support leaf behind the bell raceme
          drawBlade(ox, oy, 58, 44 - lean * 10, 26, 14, '#4e6250');

          // Slender arching stem
          ctx.strokeStyle = '#5c705e';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(ox + 64, oy + cellPx - 2);
          ctx.quadraticCurveTo(ox + 62 + lean * 8, oy + 52, ox + archTipX, oy + archTipY);
          ctx.stroke();

          // Nodding ivory lily-of-the-valley bells along the stem
          const bellCount = 4;
          for (let b = 0; b < bellCount; b += 1) {
            const t = 0.36 + (b / (bellCount - 1)) * 0.58;
            const inv = 1 - t;
            const sx =
              inv * inv * (ox + 64) +
              2 * inv * t * (ox + 62 + lean * 8) +
              t * t * (ox + archTipX);
            const sy =
              inv * inv * (oy + cellPx - 2) +
              2 * inv * t * (oy + 52) +
              t * t * (oy + archTipY);
            const dropY = sy + 9;
            const dropX = sx + lean * (4 + b * 2);

            ctx.strokeStyle = '#627664';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(dropX, dropY - 4);
            ctx.stroke();

            ctx.fillStyle = '#f2efe4';
            ctx.beginPath();
            ctx.arc(dropX, dropY, 7.2 - b * 0.5, Math.PI, 0, false);
            ctx.lineTo(dropX + (7 - b * 0.5), dropY + 7);
            ctx.lineTo(dropX + (3.5 - b * 0.3), dropY + 4.5);
            ctx.lineTo(dropX, dropY + 7.5);
            ctx.lineTo(dropX - (3.5 - b * 0.3), dropY + 4.5);
            ctx.lineTo(dropX - (7 - b * 0.5), dropY + 7);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = 'rgba(201, 206, 214, 0.55)';
            ctx.beginPath();
            ctx.arc(dropX, dropY + 2.5, 2.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

export function createPetalPlaceholderTexture(): THREE.DataTexture {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  const cos = Math.cos(0.42);
  const sin = Math.sin(0.42);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x - 31.5;
      const dy = y - 31.5;
      const rx = dx * cos - dy * sin;
      const ry = dx * sin + dy * cos;

      // Tapered curved lily-petal silhouette (narrower tip on +rx, cupped slight bend along ry)
      const u = rx / 24.0;
      const bend = 2.6 * u * u;
      const widthAtU = 13.5 * Math.max(0.18, 1.0 - 0.55 * Math.max(0.0, u) - 0.25 * u * u);
      const dist = Math.hypot(u, (ry - bend) / widthAtU);
      const t = Math.min(1, dist);

      // Luminous warm-ivory core with subtle warm-taupe rim so airborne petals pop cleanly over bright sky
      const r = Math.round(252 - t * 24);
      const g = Math.round(250 - t * 27);
      const b = Math.round(242 - t * 32);
      const edge = Math.max(0, 1 - dist);
      const smoothAlpha = edge * edge * (3 - 2 * edge);
      const a = dist >= 1 ? 0 : Math.round(255 * Math.min(1, smoothAlpha * 2.1));

      const idx = (y * size + x) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = a;
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
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
