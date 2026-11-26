import * as THREE from 'three';
import { ASSET_MANIFEST } from '../assets/manifest.ts';
import { RIDGE_LENGTH, clamp, sampleRidge } from './layout.ts';
import {
  createFoliagePlaceholderTexture,
  loadTextureWithPlaceholder,
  type DiagRecorder,
} from './placeholders.ts';
import { WIND_SWAY_GLSL, type WindUniforms } from './shaders/wind.glsl.ts';

export interface FoliageController {
  group: THREE.Group;
  dispose: () => void;
}

export interface FoliageOptions {
  diag: DiagRecorder;
  windUniforms: WindUniforms;
  activeAlphaTest: 0.3 | 0.5;
}

export function createMulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sampleHillY(x: number, z: number): number {
  const t = clamp(x / RIDGE_LENGTH + 0.5, 0, 1);
  const ridgeY = sampleRidge(t).y;
  const mound = 0.08 * Math.sin(x * 0.22) * (1 - Math.exp(-Math.abs(x) * 0.5));
  if (z >= 0) {
    return ridgeY + mound - z * 0.155 - z * z * 0.012;
  }
  return ridgeY + mound - Math.abs(z) * 0.15 - z * z * 0.015;
}

function createTerrainMesh(): {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  dispose: () => void;
} {
  const width = 64;
  const depth = 24;
  const geometry = new THREE.PlaneGeometry(width, depth, 72, 18);
  geometry.rotateX(-Math.PI * 0.5);
  geometry.translate(0, 0, 4.5);

  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const crestColor = new THREE.Color('#2e3c30');
  const shadowColor = new THREE.Color('#1c271e');
  const tmpColor = new THREE.Color();

  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, sampleHillY(x, z) - 0.1);

    // Deep shaded undergrowth bed so no flat ground ever shows between dense lily blades
    const depthShade = clamp(
      (z > 0 ? clamp(z / 10.5, 0, 1) * 0.88 : clamp(Math.abs(z) / 7.5, 0, 1) * 0.3) +
        Math.sin(x * 0.7) * Math.cos(z * 0.8) * 0.08,
      0,
      1,
    );
    tmpColor.copy(crestColor).lerp(shadowColor, depthShade);
    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }
  pos.needsUpdate = true;
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    fog: true,
  });
  const mesh = new THREE.Mesh(geometry, material);

  return {
    mesh,
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

function createLilyLayer(params: {
  kind: 'leaves' | 'bells';
  cols: number;
  rows: number;
  cardWidth: number;
  cardHeight: number;
  cellCount: number;
  primaryPath: string;
  diagKey: string;
  rng: () => number;
  windUniforms: WindUniforms;
  activeAlphaTest: 0.3 | 0.5;
  diag: DiagRecorder;
}): {
  mesh: THREE.InstancedMesh;
  dispose: () => void;
} {
  const {
    kind,
    cols,
    rows,
    cardWidth,
    cardHeight,
    cellCount,
    primaryPath,
    diagKey,
    rng,
    windUniforms,
    activeAlphaTest,
    diag,
  } = params;

  const count = cols * rows;
  const geometry = new THREE.PlaneGeometry(cardWidth, cardHeight);
  // Shift root pivot to y = 0 (uv.y = 0) so windSway bends tips upward without lifting roots
  geometry.translate(0, cardHeight * 0.5, 0);

  const cellIndices = new Float32Array(count);
  const phases = new Float32Array(count);
  const tones = new Float32Array(count * 2);
  geometry.setAttribute('aCellIndex', new THREE.InstancedBufferAttribute(cellIndices, 1));
  geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
  geometry.setAttribute('aTone', new THREE.InstancedBufferAttribute(tones, 2));

  const placeholder = createFoliagePlaceholderTexture(kind);
  let currentTexture: THREE.Texture = placeholder;
  const material = new THREE.MeshBasicMaterial({
    map: placeholder,
    side: THREE.DoubleSide,
    fog: true,
    transparent: false,
    alphaTest: activeAlphaTest,
    alphaToCoverage: activeAlphaTest === 0.3,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = windUniforms.uTime;
    shader.uniforms.uWindStrength = windUniforms.uWindStrength;
    shader.uniforms.uDriftOffset = windUniforms.uDriftOffset;
    shader.vertexShader =
      `attribute float aCellIndex;
      attribute float aPhase;
      attribute vec2 aTone;
      varying float vLeafUvY;
      varying vec2 vLeafTone;
      varying vec3 vWorldPos;
      uniform float uTime;
      uniform float uWindStrength;
      uniform float uDriftOffset;
      ${WIND_SWAY_GLSL}\n` +
      shader.vertexShader
        .replace(
          '#include <uv_vertex>',
          `#include <uv_vertex>
          vLeafUvY = uv.y;
          vLeafTone = aTone;
          #ifdef USE_MAP
            float cellCol = mod(aCellIndex, 2.0);
            float cellRow = floor(aCellIndex * 0.5);
            vMapUv = vMapUv * 0.488 + vec2(cellCol * 0.5 + 0.006, 0.5 - cellRow * 0.5 + 0.006);
          #endif`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vec3 instWorld = instanceMatrix[3].xyz;
          transformed += windSway(instWorld, uv.y, aPhase, uTime, uWindStrength);
          vWorldPos = (instanceMatrix * vec4(transformed, 1.0)).xyz;`,
        );

    const fragmentShade =
      kind === 'leaves'
        ? `
          float beamAxis = vWorldPos.x * 0.135 - vWorldPos.z * 0.085 - uDriftOffset * 0.045;
          float primarySun = exp(-pow((vWorldPos.x + 1.5 - vWorldPos.z * 0.28) / 8.5, 2.0));
          float dappleWave = 0.5 + 0.5 * sin(beamAxis * 1.85 + cos(vWorldPos.z * 0.24 - beamAxis * 0.6) * 0.8);
          float sunPool = clamp(primarySun * 0.68 + dappleWave * 0.42, 0.0, 1.0);
          float ao = mix(0.36, 0.96, smoothstep(0.0, 0.88, vLeafUvY));
          float fgDeep = mix(1.0, 0.72, smoothstep(0.58, 1.0, vLeafTone.x) * (1.0 - vLeafUvY * 0.65));
          vec3 shadowTint = mix(vec3(0.90, 0.96, 1.02), vec3(1.0), sunPool);
          float sunScale = mix(0.64, 1.22, sunPool);
          diffuseColor.rgb = diffuseColor.rgb * ao * fgDeep * vLeafTone.y * sunScale * shadowTint
            + vec3(0.045, 0.048, 0.024) * sunPool * smoothstep(0.42, 1.0, vLeafUvY);
          float backMist = smoothstep(0.18, 0.0, vLeafTone.x) * 0.14;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.68, 0.71, 0.70), backMist);
        `
        : `
          float beamAxis = vWorldPos.x * 0.135 - vWorldPos.z * 0.085 - uDriftOffset * 0.045;
          float primarySun = exp(-pow((vWorldPos.x + 1.5 - vWorldPos.z * 0.28) / 8.5, 2.0));
          float dappleWave = 0.5 + 0.5 * sin(beamAxis * 1.85 + cos(vWorldPos.z * 0.24 - beamAxis * 0.6) * 0.8);
          float sunPool = clamp(primarySun * 0.68 + dappleWave * 0.42, 0.0, 1.0);
          float stemAo = mix(0.48, 1.06, smoothstep(0.0, 0.48, vLeafUvY));
          float luma = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          float bloomMask = smoothstep(0.45, 0.72, luma);
          vec3 bellTarget = mix(vec3(0.56, 0.60, 0.58), vec3(0.96, 0.94, 0.86), sunPool);
          vec3 litBell = diffuseColor.rgb * stemAo * vLeafTone.y * mix(0.76, 1.18, sunPool) * mix(1.0, 1.32, bloomMask);
          diffuseColor.rgb = min(vec3(1.0), mix(litBell, bellTarget, bloomMask * (0.28 + 0.18 * sunPool)));
        `;

    shader.fragmentShader =
      `varying float vLeafUvY;
      varying vec2 vLeafTone;
      varying vec3 vWorldPos;
      uniform float uDriftOffset;\n` +
      shader.fragmentShader.replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        ${fragmentShade}`,
      );
  };
  material.customProgramCacheKey = () => `lily-sunlit-v5-${kind}-${activeAlphaTest}`;

  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.frustumCulled = false;

  const dummy = new THREE.Object3D();
  const xSpan = 28.5;
  const zMin = kind === 'leaves' ? -4.6 : -4.2;
  const zMax = kind === 'leaves' ? 12.8 : 11.6;

  let idx = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const u = (col + rng()) / cols;
      const s = u * 2 - 1;
      const x = Math.sign(s) * Math.pow(Math.abs(s), 1.08) * xSpan;

      const v = (row + rng()) / rows;
      const zNorm = Math.pow(v, 1.06);
      let z = zMin + zNorm * (zMax - zMin);

      // Keep only a tight foot-anchor pocket so surrounding lilies naturally overlap the hero's ankles
      if (Math.abs(x) < 0.28 && Math.abs(z) < 0.22) {
        z += z >= 0 ? 0.28 : -0.28;
      }

      const groundY = sampleHillY(x, z) + (kind === 'bells' ? 0.07 : -0.05);
      const depthScale =
        kind === 'leaves'
          ? 0.72 + Math.pow(zNorm, 1.3) * 1.35
          : 0.78 + Math.pow(zNorm, 1.25) * 1.38;
      const jitter = kind === 'leaves' ? 0.86 + rng() * 0.3 : 0.84 + rng() * 0.34;
      const uniformScale = depthScale * jitter;

      dummy.position.set(x, groundY, z);
      dummy.rotation.set(
        (rng() - 0.5) * 0.18,
        (rng() - 0.5) * 0.72,
        (rng() - 0.5) * 0.24,
      );
      dummy.scale.set(uniformScale * (rng() > 0.5 ? 1 : -1), uniformScale, 1);
      dummy.updateMatrix();

      cellIndices[idx] = Math.floor(rng() * cellCount);
      phases[idx] = rng() * Math.PI * 2;
      tones[idx * 2] = zNorm;
      tones[idx * 2 + 1] = 0.84 + rng() * 0.32;
      mesh.setMatrixAt(idx, dummy.matrix);
      idx += 1;
    }
  }
  mesh.instanceMatrix.needsUpdate = true;

  loadTextureWithPlaceholder({
    key: diagKey,
    primaryPath,
    placeholder,
    diag,
    onApplied(tex) {
      currentTexture = tex;
      material.map = tex;
      material.needsUpdate = true;
    },
  });

  return {
    mesh,
    dispose() {
      geometry.dispose();
      currentTexture.dispose();
      material.dispose();
    },
  };
}

export function createFoliageController(options: FoliageOptions): FoliageController {
  const { diag, windUniforms, activeAlphaTest } = options;
  const group = new THREE.Group();
  const rng = createMulberry32(0x56504844);

  const terrain = createTerrainMesh();
  group.add(terrain.mesh);

  const leaves = createLilyLayer({
    kind: 'leaves',
    cols: 130,
    rows: 42,
    cardWidth: 0.84,
    cardHeight: 0.72,
    cellCount: ASSET_MANIFEST.foliage.leafCells,
    primaryPath: ASSET_MANIFEST.foliage.leavesPath,
    diagKey: 'lilyLeaves',
    rng,
    windUniforms,
    activeAlphaTest,
    diag,
  });
  group.add(leaves.mesh);

  const bells = createLilyLayer({
    kind: 'bells',
    cols: 110,
    rows: 20,
    cardWidth: 0.5,
    cardHeight: 0.78,
    cellCount: ASSET_MANIFEST.foliage.bellCells,
    primaryPath: ASSET_MANIFEST.foliage.bellsPath,
    diagKey: 'lilyBells',
    rng,
    windUniforms,
    activeAlphaTest,
    diag,
  });
  group.add(bells.mesh);

  return {
    group,
    dispose() {
      terrain.dispose();
      leaves.dispose();
      bells.dispose();
    },
  };
}
