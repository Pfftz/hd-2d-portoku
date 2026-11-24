import * as THREE from 'three';
import { createMulberry32 } from './foliage.ts';
import { createPetalPlaceholderTexture } from './placeholders.ts';
import type { WindUniforms } from './shaders/wind.glsl.ts';

export interface PetalsController {
  mesh: THREE.InstancedMesh;
  update: (cameraX: number) => void;
  dispose: () => void;
}

const PETAL_COUNT = 480;

export function createPetalsController(windUniforms: WindUniforms): PetalsController {
  const geometry = new THREE.PlaneGeometry(0.24, 0.24);
  const seedData = new Float32Array(PETAL_COUNT * 4);
  const styleData = new Float32Array(PETAL_COUNT * 3);
  const rng = createMulberry32(0x50455441);

  for (let i = 0; i < PETAL_COUNT; i += 1) {
    const tierRoll = (i % 100) / 100;
    let z = 0;
    let sizeScale = 1;
    let speedScale = 1;
    let opacity = 0.85;

    if (tierRoll < 0.38) {
      // Far valley specks drifting past distant hills and hero background
      z = -14.0 + rng() * 10.5;
      sizeScale = 0.42 + rng() * 0.46;
      speedScale = 0.95 + rng() * 0.5;
      opacity = 0.65 + rng() * 0.23;
    } else if (tierRoll < 0.84) {
      // Mid-meadow wind-swept petals streaming above the flower ridge
      z = -3.5 + rng() * 8.3;
      sizeScale = 0.95 + rng() * 1.2;
      speedScale = 1.2 + rng() * 0.7;
      opacity = 0.85 + rng() * 0.13;
    } else {
      // Close-up foreground bokeh petals whipping rapidly past the camera lens
      z = 5.6 + rng() * 6.2;
      sizeScale = 2.2 + rng() * 2.5;
      speedScale = 1.65 + rng() * 0.9;
      opacity = 0.48 + rng() * 0.3;
    }

    seedData[i * 4] = rng() * 44.0;
    seedData[i * 4 + 1] = rng() * 16.0;
    seedData[i * 4 + 2] = z;
    seedData[i * 4 + 3] = rng() * Math.PI * 2;

    styleData[i * 3] = sizeScale;
    styleData[i * 3 + 1] = speedScale;
    styleData[i * 3 + 2] = opacity;
  }
  geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seedData, 4));
  geometry.setAttribute('aStyle', new THREE.InstancedBufferAttribute(styleData, 3));

  const texture = createPetalPlaceholderTexture();
  const cameraXUniform = { value: 0 };
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.94,
    depthWrite: false,
    depthTest: true,
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
      attribute vec3 aStyle;
      varying float vPetalOpacity;
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
        float sizeScale = aStyle.x;
        float speedScale = aStyle.y;
        vPetalOpacity = aStyle.z;
        float animTime = uTime * uWindStrength;
        vec3 localRotated = rotatePetal3D(
          transformed * sizeScale,
          animTime * (1.85 + speedScale * 0.55) + phase,
          animTime * (1.45 + speedScale * 0.45) + phase * 1.7,
          animTime * (2.1 - speedScale * 0.3) + phase * 0.6
        );
        float driftX = uDriftOffset * (4.8 * speedScale);
        float liftY = uDriftOffset * (1.75 * speedScale);
        float gustWave = sin(animTime * 1.9 + phase) * 0.55 + cos(animTime * 0.85 + phase * 1.7) * 0.25;
        float wx = mod(aSeed.x + driftX - uCameraX + 22.0, 44.0) - 22.0 + uCameraX;
        float wy = mod(aSeed.y + liftY + gustWave, 16.0) - 2.5;
        transformed = vec3(wx, wy, aSeed.z) + localRotated;`,
      );

    shader.fragmentShader =
      'varying float vPetalOpacity;\n' +
      shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
        gl_FragColor.a *= vPetalOpacity;`,
      );
  };
  material.customProgramCacheKey = () => 'petal-wind-depth-v3';

  const mesh = new THREE.InstancedMesh(geometry, material, PETAL_COUNT);
  mesh.frustumCulled = false;
  mesh.renderOrder = 12;
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
