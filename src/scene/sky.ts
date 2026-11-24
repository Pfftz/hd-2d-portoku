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

  vec3 cUpper = vec3(0.824, 0.808, 0.761);   // #d2cec2 overcast warm grey-beige
  vec3 cMid = vec3(0.902, 0.886, 0.843);     // #e6e2d7 warm pearl mid-sky
  vec3 cMistBand = vec3(0.949, 0.937, 0.894); // #f2efe4 luminous horizon mist
  vec3 cHaze = vec3(0.788, 0.808, 0.839);    // #c9ced6 muted overcast horizon haze

  vec3 col = mix(cHaze, cMistBand, smoothstep(0.18, 0.42, y));
  col = mix(col, cMid, smoothstep(0.42, 0.70, y));
  col = mix(col, cUpper, smoothstep(0.70, 0.98, y));

  // Subtle diagonal overcast cloud streaks inspired by the reference sky
  vec2 streakUv = vec2(vSkyUv.x * 2.2 + vSkyUv.y * 1.15, vSkyUv.y * 3.8 - vSkyUv.x * 0.45);
  float streak = skyFbm(streakUv * 2.4);
  float upperMask = smoothstep(0.32, 0.85, y) * (1.0 - smoothstep(0.92, 1.0, y));
  col = mix(col, cUpper * 0.96, streak * 0.22 * upperMask);

  // Soft radiant center-left overcast glow behind the valley
  float glowDist = length((vSkyUv - vec2(0.46, 0.48)) * vec2(0.95, 1.5));
  float centerGlow = smoothstep(0.65, 0.05, glowDist);
  col = mix(col, cMistBand, centerGlow * 0.28);

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
  mesh.renderOrder = -10;

  return {
    mesh,
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
