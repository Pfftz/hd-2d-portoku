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
  if (z >= 0) {
    return ridgeY - z * 0.28 - z * z * 0.032;
  }
  return ridgeY - Math.abs(z) * 0.18 - z * z * 0.015;
}

function createTerrainMesh(): {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  dispose: () => void;
} {
  const width = 64;
  const depth = 15;
  const geometry = new THREE.PlaneGeometry(width, depth, 64, 12);
  geometry.rotateX(-Math.PI * 0.5);
  geometry.translate(0, 0, 1.0);

  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const crestColor = new THREE.Color('#5b6e5d');
  const shadowColor = new THREE.Color('#39483b');
  const tmpColor = new THREE.Color();

  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, sampleHillY(x, z));

    // Gentle ambient shadow deepening down the front slope toward foreground leaves
    const depthShade = z > 0 ? clamp(z / 8.5, 0, 1) * 0.85 : clamp(Math.abs(z) / 6.5, 0, 1) * 0.25;
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
  count: number;
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
    count,
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

  const geometry = new THREE.PlaneGeometry(cardWidth, cardHeight);
  // Shift root pivot to y = 0 (uv.y = 0) so windSway bends tips upward without lifting roots
  geometry.translate(0, cardHeight * 0.5, 0);

  const cellIndices = new Float32Array(count);
  const phases = new Float32Array(count);
  geometry.setAttribute('aCellIndex', new THREE.InstancedBufferAttribute(cellIndices, 1));
  geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));

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
    shader.vertexShader =
      `attribute float aCellIndex;\nattribute float aPhase;\nuniform float uTime;\nuniform float uWindStrength;\n${WIND_SWAY_GLSL}\n` +
      shader.vertexShader
        .replace(
          '#include <uv_vertex>',
          `#include <uv_vertex>
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
          transformed += windSway(instWorld, uv.y, aPhase, uTime, uWindStrength);`,
        );
  };
  material.customProgramCacheKey = () => `lily-wind-${kind}-${activeAlphaTest}`;

  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.frustumCulled = false;

  const dummy = new THREE.Object3D();
  const halfSpanX = 29;

  for (let i = 0; i < count; i += 1) {
    let x = (rng() * 2 - 1) * halfSpanX;
    // Concentrate extra density near the central 4:3 hilltop viewing zone while keeping full ridge coverage
    if (i % 3 !== 0) {
      x *= 0.65;
    }
    const zUnit = Math.pow(rng(), 1.15);
    let z = -4.6 + zUnit * 12.2;

    // Keep an immediate clearance pocket at the hero's exact center foot anchor while enclosing ankles/knees
    if (Math.abs(x) < 0.52 && Math.abs(z) < 0.38) {
      z += z >= 0 ? 0.55 : -0.55;
    }

    const groundY = sampleHillY(x, z) - 0.04;
    const fgScale = 0.84 + clamp((z + 4.6) / 12.2, 0, 1) * 0.72;
    const uniformScale = fgScale * (0.85 + rng() * 0.36);

    dummy.position.set(x, groundY, z);
    dummy.rotation.set(
      (rng() - 0.5) * 0.24,
      (rng() - 0.5) * 0.95,
      (rng() - 0.5) * 0.28,
    );
    dummy.scale.set(uniformScale * (rng() > 0.5 ? 1 : -1), uniformScale, 1);
    dummy.updateMatrix();

    cellIndices[i] = Math.floor(rng() * cellCount);
    phases[i] = rng() * Math.PI * 2;
    mesh.setMatrixAt(i, dummy.matrix);
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
    count: 1800,
    cardWidth: 0.56,
    cardHeight: 0.78,
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
    count: 900,
    cardWidth: 0.42,
    cardHeight: 0.64,
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
