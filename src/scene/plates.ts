import * as THREE from 'three';
import { ASSET_MANIFEST, type PlateKey } from '../assets/manifest.ts';
import {
  BASE_CAMERA_Z,
  BASE_FOV,
  BASE_TARGET_Y,
  HORIZON_Y,
  SAFE_ASPECT,
} from './layout.ts';
import {
  createPlatePlaceholderTexture,
  loadTextureWithPlaceholder,
  type DiagRecorder,
} from './placeholders.ts';
import type { WindUniforms } from './shaders/wind.glsl.ts';

export interface PlatesController {
  group: THREE.Group;
  areGuidesVisible: () => boolean;
  setGuidesVisible: (visible: boolean) => void;
  toggleGuides: () => boolean;
  update: (cameraX: number) => void;
  dispose: () => void;
}

function createPlateMaterial(
  map: THREE.Texture,
  fogMix: number,
  debugKey: PlateKey,
  windUniforms: WindUniforms,
): { material: THREE.MeshBasicMaterial; setMap: (tex: THREE.Texture) => void } {
  const useFog = fogMix > 0;
  const isDriftCloud = debugKey === 'clouds';
  const material = new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    depthWrite: false,
    fog: useFog,
  });

  if (useFog) {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uFogMix = { value: fogMix };
      shader.fragmentShader =
        'uniform float uFogMix;\n' +
        shader.fragmentShader.replace(
          '#include <fog_fragment>',
          `#ifdef USE_FOG
            #ifdef FOG_EXP2
              float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
            #else
              float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
            #endif
            gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor * uFogMix );
          #endif`,
        );
    };
    material.customProgramCacheKey = () => `plate-fog-mix-${debugKey}`;
  } else if (isDriftCloud) {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uDriftOffset = windUniforms.uDriftOffset;
      shader.vertexShader =
        'uniform float uDriftOffset;\n' +
        shader.vertexShader.replace(
          '#include <uv_vertex>',
          `#include <uv_vertex>
          #ifdef USE_MAP
            vMapUv.x += uDriftOffset * 0.015;
          #endif`,
        );
    };
    material.customProgramCacheKey = () => 'cloud-drift';
  }

  return {
    material,
    setMap(tex) {
      material.map = tex;
      material.needsUpdate = true;
    },
  };
}

export function createPlatesController(
  diag: DiagRecorder,
  initialGuides: boolean,
  windUniforms: WindUniforms,
): PlatesController {
  const group = new THREE.Group();
  const guidesGroup = new THREE.Group();
  guidesGroup.visible = initialGuides;
  group.add(guidesGroup);

  const plateMeshes: Array<{
    key: PlateKey;
    mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
    currentTexture: THREE.Texture;
    dispose: () => void;
  }> = [];

  const keys: PlateKey[] = ['ghostCastle', 'citadel', 'watchtower', 'clouds', 'foregroundLip'];
  for (const key of keys) {
    const spec = ASSET_MANIFEST.plates[key];
    const geometry = new THREE.PlaneGeometry(spec.worldWidth, spec.worldHeight);
    const placeholder = createPlatePlaceholderTexture(key, spec);
    const { material, setMap } = createPlateMaterial(placeholder, spec.fogMix, key, windUniforms);
    const mesh = new THREE.Mesh(geometry, material);

    mesh.position.set(spec.offsetX, spec.offsetY, spec.z);
    if (key === 'foregroundLip') {
      mesh.renderOrder = 10;
    }
    group.add(mesh);

    const plateRecord = {
      key,
      mesh,
      currentTexture: placeholder as THREE.Texture,
      dispose() {
        geometry.dispose();
        plateRecord.currentTexture.dispose();
        material.dispose();
      },
    };
    plateMeshes.push(plateRecord);

    loadTextureWithPlaceholder({
      key,
      primaryPath: spec.path,
      placeholder,
      diag,
      tileX: spec.tileX,
      onApplied(tex) {
        plateRecord.currentTexture = tex;
        setMap(tex);
      },
    });

    // Cropped-plate wireframe bounding box for ?debug=1 alignment
    const edges = new THREE.EdgesGeometry(geometry);
    const lineMat = new THREE.LineBasicMaterial({
      color: key === 'foregroundLip' ? '#4e6cd4' : '#f2efe4',
    });
    const wireframe = new THREE.LineSegments(edges, lineMat);
    wireframe.position.copy(mesh.position);
    wireframe.userData = { key, edges, lineMat };
    guidesGroup.add(wireframe);
  }

  // HORIZON_Y world guideline and 4:3 safe-area framing box at z = 0
  const frustumH0 = 2 * Math.tan((BASE_FOV * Math.PI) / 360) * BASE_CAMERA_Z;
  const horizonWorldY = BASE_TARGET_Y - (0.5 - HORIZON_Y) * frustumH0;
  const horizonGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-48, horizonWorldY, 0.05),
    new THREE.Vector3(48, horizonWorldY, 0.05),
  ]);
  const horizonMat = new THREE.LineBasicMaterial({ color: '#e6c86e' });
  const horizonLine = new THREE.Line(horizonGeo, horizonMat);
  guidesGroup.add(horizonLine);

  const safeWidth0 = frustumH0 * SAFE_ASPECT;
  const safeGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(safeWidth0, frustumH0));
  const safeMat = new THREE.LineBasicMaterial({ color: '#6ec4e6' });
  const safeWire = new THREE.LineSegments(safeGeo, safeMat);
  safeWire.position.set(0, BASE_TARGET_Y, 0.05);
  guidesGroup.add(safeWire);

  return {
    group,
    areGuidesVisible: () => guidesGroup.visible,
    setGuidesVisible(visible) {
      guidesGroup.visible = visible;
    },
    toggleGuides() {
      guidesGroup.visible = !guidesGroup.visible;
      return guidesGroup.visible;
    },
    update(cameraX) {
      for (const item of plateMeshes) {
        const spec = ASSET_MANIFEST.plates[item.key];
        item.mesh.position.x = spec.offsetX + cameraX * spec.parallax;
      }
      for (const child of guidesGroup.children) {
        if (child instanceof THREE.LineSegments && child.userData.key) {
          const k = child.userData.key as PlateKey;
          const spec = ASSET_MANIFEST.plates[k];
          child.position.x = spec.offsetX + cameraX * spec.parallax;
        }
      }
      safeWire.position.x = cameraX;
    },
    dispose() {
      for (const item of plateMeshes) {
        item.dispose();
      }
      horizonGeo.dispose();
      horizonMat.dispose();
      safeGeo.dispose();
      safeMat.dispose();
      for (const child of guidesGroup.children) {
        if (child instanceof THREE.LineSegments && child.userData.edges) {
          (child.userData.edges as THREE.EdgesGeometry).dispose();
          (child.userData.lineMat as THREE.LineBasicMaterial).dispose();
        }
      }
    },
  };
}
