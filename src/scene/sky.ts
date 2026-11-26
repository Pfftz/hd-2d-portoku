import * as THREE from 'three';

export interface SkyController {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  dispose: () => void;
}

const SKY_VERTEX_SHADER = /* glsl */ `
varying vec2 vSkyUv;

void main() {
  vSkyUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SKY_FRAGMENT_SHADER = /* glsl */ `
varying vec2 vSkyUv;

float skyHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float skyNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(skyHash(i), skyHash(i + vec2(1.0, 0.0)), u.x),
    mix(skyHash(i + vec2(0.0, 1.0)), skyHash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float skyFbm(vec2 p) {
  float value = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    value += amp * skyNoise(p);
    p *= 2.03;
    amp *= 0.5;
  }
  return value;
}

void main() {
  float y = clamp(vSkyUv.y, 0.0, 1.0);

  // Luminous warm overcast ivory sky (#dfddd4 zenith -> #ebe8df mid -> #f3f1ea horizon)
  vec3 cZenith = vec3(0.7379, 0.7231, 0.6584);       // #dfddd4
  vec3 cMid = vec3(0.8228, 0.7991, 0.7379);          // #ebe8df
  vec3 cHorizon = vec3(0.8963, 0.8796, 0.8228);      // #f3f1ea
  vec3 cBacklightCrest = vec3(0.945, 0.928, 0.872);  // subtle warm ivory crest feeding bloom

  vec3 col = mix(cHorizon, cMid, smoothstep(0.18, 0.56, y));
  col = mix(col, cZenith, smoothstep(0.56, 0.98, y));

  // Faint upper atmospheric wisps in warm taupe-ivory
  vec2 streakUv = vec2(vSkyUv.x * 1.9, vSkyUv.y * 6.5);
  float wispA = skyFbm(streakUv * 2.1 + vec2(0.4, -0.3));
  float upperMask = smoothstep(0.38, 0.86, y);
  col = mix(col, cZenith * 0.97, smoothstep(0.42, 0.78, wispA) * 0.28 * upperMask);

  // Soft backlit horizon luminosity crest behind distant spires and hero silhouette
  float crestBand = smoothstep(0.16, 0.34, y) * (1.0 - smoothstep(0.38, 0.62, y));
  vec2 sunCenter = vec2(0.46, 0.38);
  float sunDist = length((vSkyUv - sunCenter) * vec2(1.05, 1.6));
  float sunGlow = smoothstep(0.48, 0.04, sunDist) * (0.72 + 0.28 * wispA);
  col = mix(col, cBacklightCrest, clamp(crestBand * 0.58 + sunGlow * 0.36, 0.0, 0.82));

  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

export function createSkyDome(): SkyController {
  // Sized 280x130u at z=-120 to cover 21:9 + max camera pan and 9:16 1.45 portrait pullback
  const geometry = new THREE.PlaneGeometry(280, 130);
  const material = new THREE.ShaderMaterial({
    vertexShader: SKY_VERTEX_SHADER,
    fragmentShader: SKY_FRAGMENT_SHADER,
    fog: false,
    depthWrite: false,
    depthTest: true,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(0, 6, -120);
  mesh.renderOrder = -12;

  return {
    mesh,
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
