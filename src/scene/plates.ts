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
  update: (cameraX: number, elapsedTime?: number) => void;
  dispose: () => void;
}

interface CloudDriftParams {
  driftSpeed: number;
  uvScale: number;
  uvPhase: number;
  opacity: number;
  topLightStrength: number;
  shadowTint: string;
  skyMistMix: number;
}

const PLATE_RENDER_ORDER: Record<PlateKey, number> = {
  ghostCastle: -10,
  citadel: -8,
  watchtower: -6,
  clouds: -4,
  foregroundLip: 10,
};

interface RightCloudBankLayerSpec {
  z: number;
  renderOrder: number;
  parallax: number;
  baseOffsetX: number;
  baseOffsetY: number;
  worldWidth: number;
  worldHeight: number;
  opacity: number;
  driftAmp: number;
  driftSpeed: number;
  bobAmp: number;
  bobSpeed: number;
  phase: number;
}

const RIGHT_CLOUD_BANK_LAYERS: readonly RightCloudBankLayerSpec[] = [
  {
    z: -27,
    renderOrder: -5,
    parallax: 0.45,
    baseOffsetX: 27.0,
    baseOffsetY: -1.6,
    worldWidth: 44,
    worldHeight: 15,
    opacity: 0.96,
    driftAmp: 0.85,
    driftSpeed: 0.16,
    bobAmp: 0.22,
    bobSpeed: 0.42,
    phase: 0.0,
  },
  {
    z: -24,
    renderOrder: -4,
    parallax: 0.41,
    baseOffsetX: 23.0,
    baseOffsetY: -2.4,
    worldWidth: 42,
    worldHeight: 14,
    opacity: 0.94,
    driftAmp: 1.15,
    driftSpeed: 0.21,
    bobAmp: 0.28,
    bobSpeed: 0.5,
    phase: 2.1,
  },
  {
    z: -20,
    renderOrder: -3,
    parallax: 0.35,
    baseOffsetX: 26.0,
    baseOffsetY: -3.0,
    worldWidth: 38,
    worldHeight: 13,
    opacity: 0.92,
    driftAmp: 1.35,
    driftSpeed: 0.25,
    bobAmp: 0.24,
    bobSpeed: 0.56,
    phase: 4.2,
  },
];

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
    z: -54,
    renderOrder: -9,
    parallax: 0.78,
    worldWidth: 140,
    worldHeight: 10.5,
    offsetX: 0,
    offsetY: -0.4,
    driftSpeed: 0.006,
    uvScale: 1.6,
    uvPhase: 0.15,
    opacity: 0.28,
    topLightStrength: 0.42,
    shadowTint: '#cfc9bc',
    skyMistMix: 0.12,
  },
  {
    id: 'cloudsMid',
    z: -38,
    renderOrder: -7,
    parallax: 0.58,
    worldWidth: 112,
    worldHeight: 9.5,
    offsetX: 0,
    offsetY: 0.2,
    driftSpeed: 0.013,
    uvScale: 1.4,
    uvPhase: 0.52,
    opacity: 0.38,
    topLightStrength: 0.68,
    shadowTint: '#d8d3c6',
    skyMistMix: 0.06,
  },
  {
    id: 'cloudsNear',
    z: -14,
    renderOrder: -2,
    parallax: 0.22,
    worldWidth: 88,
    worldHeight: 7.5,
    offsetX: 0,
    offsetY: 2.6,
    driftSpeed: 0.026,
    uvScale: 0.85,
    uvPhase: 0.34,
    opacity: 0.46,
    topLightStrength: 0.75,
    shadowTint: '#d8d3c6',
    skyMistMix: 0.04,
  },
];

function createPlateMaterial(
  map: THREE.Texture,
  fogMix: number,
  layerId: string,
  windUniforms: WindUniforms,
  cloudParams?: CloudDriftParams,
  layerOpacity?: number,
): { material: THREE.MeshBasicMaterial; setMap: (tex: THREE.Texture) => void } {
  const useFog = fogMix > 0 && !cloudParams;
  const material = new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    opacity: cloudParams ? cloudParams.opacity : (layerOpacity ?? 1.0),
    depthWrite: false,
    fog: useFog,
  });

  if (useFog) {
    const baseFadeHeight = layerId === 'watchtower' ? 0.0 : 0.06;
    const washLift = fogMix * 0.12;
    const sunStyle = layerId === 'citadel' ? 1.0 : layerId === 'watchtower' ? 2.0 : 0.0;
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uFogMix = { value: fogMix };
      shader.uniforms.uWashColor = { value: new THREE.Color('#e8e5dc') };
      shader.uniforms.uWashLift = { value: washLift };
      shader.uniforms.uBaseFadeHeight = { value: baseFadeHeight };
      shader.uniforms.uSunStyle = { value: sunStyle };
      shader.vertexShader =
        'varying vec2 vPlateUv;\n' +
        shader.vertexShader.replace(
          '#include <uv_vertex>',
          `#include <uv_vertex>
          vPlateUv = uv;`,
        );
      shader.fragmentShader =
        `varying vec2 vPlateUv;
        uniform float uFogMix;
        uniform vec3 uWashColor;
        uniform float uWashLift;
        uniform float uBaseFadeHeight;
        uniform float uSunStyle;\n` +
        shader.fragmentShader.replace(
          '#include <fog_fragment>',
          `#ifdef USE_FOG
            #ifdef FOG_EXP2
              float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
            #else
              float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
            #endif
            float luma = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
            vec3 compressed = mix(gl_FragColor.rgb, vec3(luma), uWashLift * 0.18);
            gl_FragColor.rgb = mix(compressed, uWashColor, clamp(fogFactor * uFogMix + uWashLift * 0.18, 0.0, 0.14));
          #endif
          if (uSunStyle > 0.5 && uSunStyle < 1.5) {
            float sunWash = smoothstep(0.28, 0.92, vPlateUv.y) * smoothstep(0.05, 0.78, vPlateUv.x);
            gl_FragColor.rgb = min(vec3(1.0), gl_FragColor.rgb * mix(0.96, 1.03, sunWash) + vec3(0.045, 0.040, 0.024) * sunWash);
          } else if (uSunStyle >= 1.5) {
            float leftRim = smoothstep(0.55, 0.12, vPlateUv.x) * smoothstep(0.25, 0.88, vPlateUv.y);
            float rightShade = smoothstep(0.45, 0.90, vPlateUv.x);
            gl_FragColor.rgb = min(vec3(1.0), gl_FragColor.rgb * mix(1.0, 0.90, rightShade) + vec3(0.055, 0.048, 0.030) * leftRim);
          } else {
            float topGleam = smoothstep(0.45, 0.95, vPlateUv.y);
            gl_FragColor.rgb = min(vec3(1.0), gl_FragColor.rgb * 0.94 + vec3(0.035, 0.032, 0.022) * topGleam);
          }
          gl_FragColor.a *= smoothstep(0.0, uBaseFadeHeight, vPlateUv.y);`,
        );
    };
    material.customProgramCacheKey = () => `plate-panorama-v6-${layerId}`;
  } else if (cloudParams) {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uDriftOffset = windUniforms.uDriftOffset;
      shader.uniforms.uDriftSpeed = { value: cloudParams.driftSpeed };
      shader.uniforms.uUvScale = { value: cloudParams.uvScale };
      shader.uniforms.uUvPhase = { value: cloudParams.uvPhase };
      shader.uniforms.uTopLightStrength = { value: cloudParams.topLightStrength };
      shader.uniforms.uShadowTint = { value: new THREE.Color(cloudParams.shadowTint) };
      shader.uniforms.uSkyMistMix = { value: cloudParams.skyMistMix };
      shader.vertexShader =
        `varying vec2 vCloudLocalUv;
        uniform float uDriftOffset;
        uniform float uDriftSpeed;
        uniform float uUvScale;
        uniform float uUvPhase;\n` +
        shader.vertexShader.replace(
          '#include <uv_vertex>',
          `#include <uv_vertex>
          vCloudLocalUv = uv;
          #ifdef USE_MAP
            vMapUv.x = vMapUv.x * uUvScale - uDriftOffset * uDriftSpeed + uUvPhase;
          #endif`,
        );
      shader.fragmentShader =
        `varying vec2 vCloudLocalUv;
        uniform float uTopLightStrength;
        uniform vec3 uShadowTint;
        uniform float uSkyMistMix;\n` +
        shader.fragmentShader.replace(
          '#include <map_fragment>',
          `#include <map_fragment>
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92, 0.91, 0.86), 0.35);
          float cloudLuma = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          float crown = smoothstep(0.24, 0.88, vCloudLocalUv.y);
          float sunBias = 1.0 - 0.18 * vCloudLocalUv.x;
          float puffShade = smoothstep(0.18, 0.82, cloudLuma);
          vec3 shadowedCloud = mix(uShadowTint * (0.82 + 0.18 * cloudLuma), diffuseColor.rgb, puffShade);
          vec3 sunlitCrown = vec3(0.97, 0.96, 0.91);
          float topMask = crown * sunBias * (0.35 + 0.65 * puffShade);
          vec3 litCloud = mix(shadowedCloud, sunlitCrown, clamp(topMask * uTopLightStrength, 0.0, 0.85));
          diffuseColor.rgb = mix(litCloud, vec3(0.84, 0.82, 0.76), uSkyMistMix);`,
        );
    };
    material.customProgramCacheKey = () => `cloud-sunlit-v7-${layerId}`;
  }

  return {
    material,
    setMap(tex) {
      material.map = tex;
      material.needsUpdate = true;
    },
  };
}

function createSunbeamsMesh(windUniforms: WindUniforms): {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  dispose: () => void;
} {
  const geometry = new THREE.PlaneGeometry(76, 32);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: windUniforms.uTime,
      uWindStrength: windUniforms.uWindStrength,
    },
    vertexShader: /* glsl */ `
      varying vec2 vBeamUv;
      void main() {
        vBeamUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vBeamUv;
      uniform float uTime;
      uniform float uWindStrength;

      void main() {
        float t = uTime * uWindStrength;
        float u = vBeamUv.x * 1.15 - (1.0 - vBeamUv.y) * 0.58;
        float s1 = exp(-pow((u - 0.12) / 0.075, 2.0)) * (0.85 + 0.15 * sin(t * 0.28));
        float s2 = exp(-pow((u - 0.30) / 0.095, 2.0)) * (0.85 + 0.15 * sin(t * 0.24 + 1.9));
        float s3 = exp(-pow((u - 0.52) / 0.085, 2.0)) * (0.85 + 0.15 * sin(t * 0.31 + 3.7));
        float s4 = exp(-pow((u - 0.72) / 0.065, 2.0)) * (0.85 + 0.15 * sin(t * 0.22 + 5.1));
        float shafts = clamp(s1 * 0.95 + s2 * 1.0 + s3 * 0.8 + s4 * 0.55, 0.0, 1.0);

        float edgeFade =
          smoothstep(0.0, 0.24, vBeamUv.x) *
          smoothstep(1.0, 0.62, vBeamUv.x) *
          smoothstep(0.25, 0.45, vBeamUv.y) *
          smoothstep(1.0, 0.65, vBeamUv.y);
        float alpha = shafts * edgeFade * 0.035;
        gl_FragColor = vec4(1.0, 0.93, 0.74, alpha);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(0, 6.5, -18);
  mesh.renderOrder = -1;

  return {
    mesh,
    dispose() {
      geometry.dispose();
      material.dispose();
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

  const keys: PlateKey[] = ['ghostCastle', 'watchtower', 'clouds', 'foregroundLip'];
  for (const key of keys) {
    const spec = ASSET_MANIFEST.plates[key];
    const geometry = new THREE.PlaneGeometry(spec.worldWidth, spec.worldHeight);
    const placeholder = createPlatePlaceholderTexture(key, spec);
    const cloudParams: CloudDriftParams | undefined =
      key === 'clouds'
        ? {
            driftSpeed: 0.02,
            uvScale: 1.0,
            uvPhase: 0.0,
            opacity: 0.36,
            topLightStrength: 0.68,
            shadowTint: '#d8d3c6',
            skyMistMix: 0.05,
          }
        : undefined;
    const { material, setMap } = createPlateMaterial(
      placeholder,
      spec.fogMix,
      key,
      windUniforms,
      cloudParams,
      key === 'foregroundLip' ? 0.92 : 1.0,
    );
    const mesh = new THREE.Mesh(geometry, material);

    mesh.position.set(spec.offsetX, spec.offsetY, spec.z);
    if (key === 'foregroundLip') {
      mesh.rotation.z = 0.034;
    }
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
      nearestFilter: key === 'watchtower',
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
    wireframe.rotation.copy(mesh.rotation);
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

  // Far-back seamless horizontal-tiling celestial sky (near-zero parallax ~0.01 relative to camera)
  const celestialSpec = {
    ...baseCloudsSpec,
    path: 'assets/backdrop/celestial-sky.webp',
    z: -110,
    parallax: 0.99,
    offsetX: 0,
    offsetY: 12,
    worldWidth: 260,
    worldHeight: 115,
  };
  const celestialGeo = new THREE.PlaneGeometry(celestialSpec.worldWidth, celestialSpec.worldHeight);
  const celestialPlaceholder = createPlatePlaceholderTexture('clouds', celestialSpec);
  celestialPlaceholder.wrapS = THREE.RepeatWrapping;
  celestialPlaceholder.wrapT = THREE.ClampToEdgeWrapping;
  celestialPlaceholder.repeat.set(2, 1);
  const celestialMat = new THREE.MeshBasicMaterial({
    map: celestialPlaceholder,
    transparent: true,
    opacity: 0.62,
    blending: THREE.NormalBlending,
    depthWrite: false,
    fog: false,
  });
  const celestialMesh = new THREE.Mesh(celestialGeo, celestialMat);
  celestialMesh.position.set(celestialSpec.offsetX, celestialSpec.offsetY, celestialSpec.z);
  celestialMesh.renderOrder = -11;
  group.add(celestialMesh);
  const celestialRecord = {
    offsetX: celestialSpec.offsetX,
    parallax: celestialSpec.parallax,
    mesh: celestialMesh,
    currentTexture: celestialPlaceholder as THREE.Texture,
    dispose() {
      celestialGeo.dispose();
      celestialRecord.currentTexture.dispose();
      celestialMat.dispose();
    },
  };
  plateMeshes.push(celestialRecord);
  loadTextureWithPlaceholder({
    key: 'celestialSky',
    primaryPath: celestialSpec.path,
    placeholder: celestialPlaceholder,
    diag,
    nearestFilter: true,
    tileX: true,
    onApplied(tex) {
      tex.repeat.set(2, 1);
      celestialRecord.currentTexture = tex;
      celestialMat.map = tex;
      celestialMat.needsUpdate = true;
    },
  });

  // Animated right-side billowing cloud bank concealing watchtower cliff base
  const rightCloudBankPlaceholder = createPlatePlaceholderTexture('clouds', {
    ...baseCloudsSpec,
    worldWidth: 30,
    worldHeight: 14,
  });
  let sharedRightCloudBankTexture: THREE.Texture = rightCloudBankPlaceholder;
  const rightCloudBankMeshes: Array<{
    layer: RightCloudBankLayerSpec;
    mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
    dispose: () => void;
  }> = [];

  for (const layer of RIGHT_CLOUD_BANK_LAYERS) {
    const geometry = new THREE.PlaneGeometry(layer.worldWidth, layer.worldHeight);
    const material = new THREE.MeshBasicMaterial({
      map: sharedRightCloudBankTexture,
      transparent: true,
      opacity: layer.opacity,
      depthWrite: false,
      fog: true,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(layer.baseOffsetX, layer.baseOffsetY, layer.z);
    mesh.renderOrder = layer.renderOrder;
    group.add(mesh);
    rightCloudBankMeshes.push({
      layer,
      mesh,
      dispose() {
        geometry.dispose();
        material.dispose();
      },
    });
  }

  loadTextureWithPlaceholder({
    key: 'cloudBankRight',
    primaryPath: 'assets/backdrop/cloud-bank-right.webp',
    placeholder: rightCloudBankPlaceholder,
    diag,
    nearestFilter: true,
    onApplied(tex) {
      sharedRightCloudBankTexture = tex;
      for (const entry of rightCloudBankMeshes) {
        entry.mesh.material.map = tex;
        entry.mesh.material.needsUpdate = true;
      }
    },
  });

  const sunbeams = createSunbeamsMesh(windUniforms);
  group.add(sunbeams.mesh);

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
    update(cameraX, elapsedTime = 0) {
      for (const item of plateMeshes) {
        item.mesh.position.x = item.offsetX + cameraX * item.parallax;
      }
      for (const { layer, mesh } of rightCloudBankMeshes) {
        mesh.position.x =
          layer.baseOffsetX +
          cameraX * layer.parallax +
          Math.sin(elapsedTime * layer.driftSpeed + layer.phase) * layer.driftAmp;
        mesh.position.y =
          layer.baseOffsetY + Math.sin(elapsedTime * layer.bobSpeed + layer.phase) * layer.bobAmp;
        mesh.scale.y = 1 + 0.015 * Math.sin(elapsedTime * layer.bobSpeed * 0.8 + layer.phase);
      }
      sunbeams.mesh.position.x = cameraX * 0.35;
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
      for (const item of rightCloudBankMeshes) {
        item.dispose();
      }
      sharedRightCloudBankTexture.dispose();
      sunbeams.dispose();
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
