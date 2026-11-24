import * as THREE from 'three';
import { createMulberry32 } from './foliage.ts';
import { createPetalPlaceholderTexture } from './placeholders.ts';
import type { WindUniforms } from './shaders/wind.glsl.ts';

export interface PetalsController {
  mesh: THREE.InstancedMesh;
  update: (cameraX: number) => void;
  dispose: () => void;
}

const PETAL_COUNT = 200;

export function createPetalsController(windUniforms: WindUniforms): PetalsController {
  const geometry = new THREE.PlaneGeometry(0.24, 0.24);
  const seedData = new Float32Array(PETAL_COUNT * 4);
  const rng = createMulberry32(0x50455441);

  for (let i = 0; i < PETAL_COUNT; i += 1) {
    seedData[i * 4] = rng() * 44.0;
    seedData[i * 4 + 1] = rng() * 16.0;
    seedData[i * 4 + 2] = -7.5 + rng() * 11.5;
    seedData[i * 4 + 3] = rng() * Math.PI * 2;
  }
  geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seedData, 4));

  const texture = createPetalPlaceholderTexture();
  const cameraXUniform = { value: 0 };
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = windUniforms.uTime;
    shader.uniforms.uWindStrength = windUniforms.uWindStrength;
    shader.uniforms.uDriftOffset = windUniforms.uDriftOffset;
    shader.uniforms.uCameraX = cameraXUniform;

    shader.vertexShader =
      `attribute vec4 aSeed;
      uniform float uTime;
      uniform float uWindStrength;
      uniform float uDriftOffset;
      uniform float uCameraX;
      vec3 rotatePetal3D(vec3 p, float ax, float ay, float az) {
        float cx = cos(ax), sx = sin(ax);
        float cy = cos(ay), sy = sin(ay);
        float cz = cos(az), sz = sin(az);
        vec3 r1 = vec3(p.x, p.y * cx - p.z * sx, p.y * sx + p.z * cx);
        vec3 r2 = vec3(r1.x * cy + r1.z * sy, r1.y, -r1.x * sy + r1.z * cy);
        return vec3(r2.x * cz - r2.y * sz, r2.x * sz + r2.y * cz, r2.z);
      }\n` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float phase = aSeed.w;
        float speedScale = 0.8 + 0.5 * fract(phase * 1.732);
        float sizeScale = 0.65 + 0.85 * fract(phase * 3.14159);
        float animTime = uTime * uWindStrength;
        vec3 localRotated = rotatePetal3D(
          transformed * sizeScale,
          animTime * (1.2 + speedScale * 0.4) + phase,
          animTime * (0.95 + speedScale * 0.35) + phase * 1.7,
          animTime * (1.45 - speedScale * 0.25) + phase * 0.6
        );
        float driftX = uDriftOffset * (1.35 * speedScale);
        float fallY = uDriftOffset * (0.34 * speedScale);
        float wx = mod(aSeed.x - driftX - uCameraX + 22.0, 44.0) - 22.0 + uCameraX;
        float wy = mod(aSeed.y - fallY + sin(animTime * 0.9 + phase) * 0.55, 16.0) - 1.5;
        transformed = vec3(wx, wy, aSeed.z) + localRotated;`,
      );
  };
  material.customProgramCacheKey = () => 'petal-drift';

  const mesh = new THREE.InstancedMesh(geometry, material, PETAL_COUNT);
  mesh.frustumCulled = false;
  const identity = new THREE.Matrix4();
  for (let i = 0; i < PETAL_COUNT; i += 1) {
    mesh.setMatrixAt(i, identity);
  }
  mesh.instanceMatrix.needsUpdate = true;

  return {
    mesh,
    update(cameraX) {
      cameraXUniform.value = cameraX;
    },
    dispose() {
      geometry.dispose();
      texture.dispose();
      material.dispose();
    },
  };
}
