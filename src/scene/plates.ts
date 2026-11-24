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

interface CloudDriftParams {
  driftSpeed: number;
  uvScale: number;
  uvPhase: number;
  opacity: number;
}

const PLATE_RENDER_ORDER: Record<PlateKey, number> = {
  ghostCastle: -7,
  citadel: -6,
  watchtower: -4,
  clouds: -3,
  foregroundLip: 10,
};

interface DepthCloudLayerSpec extends CloudDriftParams {
  id: string;
  z: number;
  renderOrder: number;
  parallax: number;
  worldWidth: number;
  worldHeight: number;
  offsetX: number;
  offsetY: number;
}

const DEPTH_CLOUD_LAYERS: readonly DepthCloudLayerSpec[] = [
  {
    id: 'cloudsFar',
    z: -72,
    renderOrder: -8,
    parallax: 0.9,
    worldWidth: 156,
    worldHeight: 24,
    offsetX: 0,
    offsetY: 9.2,
    driftSpeed: 0.005,
    uvScale: 2.0,
    uvPhase: 0.15,
    opacity: 0.56,
  },
  {
    id: 'cloudsMid',
    z: -45,
    renderOrder: -5,
    parallax: 0.68,
    worldWidth: 116,
    worldHeight: 18,
    offsetX: 0,
    offsetY: 2.2,
    driftSpeed: 0.011,
    uvScale: 1.6,
    uvPhase: 0.52,
    opacity: 0.68,
  },
  {
    id: 'cloudsNear',
    z: -8.5,
    renderOrder: -2,
    parallax: 0.22,
    worldWidth: 72,
    worldHeight: 10,
    offsetX: 0,
    offsetY: 0.5,
    driftSpeed: 0.028,
    uvScale: 1.4,
    uvPhase: 0.83,
    opacity: 0.46,
  },
];

function createPlateMaterial(
  map: THREE.Texture,
  fogMix: number,
  layerId: string,
  windUniforms: WindUniforms,
  cloudParams?: CloudDriftParams,
): { material: THREE.MeshBasicMaterial; setMap: (tex: THREE.Texture) => void } {
  const useFog = fogMix > 0 && !cloudParams;
  const material = new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    opacity: cloudParams ? cloudParams.opacity : 1.0,
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
    material.customProgramCacheKey = () => `plate-fog-mix-${layerId}`;
  } else if (cloudParams) {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uDriftOffset = windUniforms.uDriftOffset;
      shader.uniforms.uDriftSpeed = { value: cloudParams.driftSpeed };
      shader.uniforms.uUvScale = { value: cloudParams.uvScale };
      shader.uniforms.uUvPhase = { value: cloudParams.uvPhase };
      shader.vertexShader =
        `uniform float uDriftOffset;
        uniform float uDriftSpeed;
        uniform float uUvScale;
        uniform float uUvPhase;\n` +
        shader.vertexShader.replace(
          '#include <uv_vertex>',
          `#include <uv_vertex>
          #ifdef USE_MAP
            vMapUv.x = vMapUv.x * uUvScale - uDriftOffset * uDriftSpeed + uUvPhase;
          #endif`,
        );
    };
    material.customProgramCacheKey = () => `cloud-drift-${layerId}`;
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
    offsetX: number;
    parallax: number;
    mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
    currentTexture: THREE.Texture;
    dispose: () => void;
  }> = [];

  const keys: PlateKey[] = ['ghostCastle', 'citadel', 'watchtower', 'clouds', 'foregroundLip'];
  for (const key of keys) {
    const spec = ASSET_MANIFEST.plates[key];
    const geometry = new THREE.PlaneGeometry(spec.worldWidth, spec.worldHeight);
    const placeholder = createPlatePlaceholderTexture(key, spec);
    const cloudParams: CloudDriftParams | undefined =
      key === 'clouds'
        ? { driftSpeed: 0.016, uvScale: 1.0, uvPhase: 0.0, opacity: 0.88 }
        : undefined;
    const { material, setMap } = createPlateMaterial(
      placeholder,
      spec.fogMix,
      key,
      windUniforms,
      cloudParams,
    );
    const mesh = new THREE.Mesh(geometry, material);

    mesh.position.set(spec.offsetX, spec.offsetY, spec.z);
    mesh.renderOrder = PLATE_RENDER_ORDER[key];
    group.add(mesh);

    const plateRecord = {
      offsetX: spec.offsetX,
      parallax: spec.parallax,
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

  // Interleaved depth cloud layers weaving behind castles, across valley, and behind meadow crest
  const baseCloudsSpec = ASSET_MANIFEST.plates.clouds;
  for (const layer of DEPTH_CLOUD_LAYERS) {
    const geometry = new THREE.PlaneGeometry(layer.worldWidth, layer.worldHeight);
    const placeholder = createPlatePlaceholderTexture('clouds', {
      ...baseCloudsSpec,
      worldWidth: layer.worldWidth,
      worldHeight: layer.worldHeight,
    });
    const { material, setMap } = createPlateMaterial(
      placeholder,
      0,
      layer.id,
      windUniforms,
      layer,
    );
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(layer.offsetX, layer.offsetY, layer.z);
    mesh.renderOrder = layer.renderOrder;
    group.add(mesh);

    const layerRecord = {
      offsetX: layer.offsetX,
      parallax: layer.parallax,
      mesh,
      currentTexture: placeholder as THREE.Texture,
      dispose() {
        geometry.dispose();
        layerRecord.currentTexture.dispose();
        material.dispose();
      },
    };
    plateMeshes.push(layerRecord);

    loadTextureWithPlaceholder({
      key: layer.id,
      primaryPath: 'assets/backdrop/cloud-wisps.webp',
      placeholder,
      diag,
      tileX: true,
      onApplied(tex) {
        layerRecord.currentTexture = tex;
        setMap(tex);
      },
    });
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
        item.mesh.position.x = item.offsetX + cameraX * item.parallax;
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
