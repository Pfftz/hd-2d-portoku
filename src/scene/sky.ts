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

  vec3 cUpper = vec3(0.816, 0.796, 0.753);   // #d0cbc0 overcast warm grey-beige
  vec3 cMid = vec3(0.902, 0.886, 0.843);     // #e6e2d7 warm pearl mid-sky
  vec3 cMistBand = vec3(0.957, 0.945, 0.902); // #f4f1e6 luminous valley horizon mist
  vec3 cHaze = vec3(0.788, 0.808, 0.839);    // #c9ced6 muted overcast horizon haze

  vec3 col = mix(cHaze, cMistBand, smoothstep(0.18, 0.42, y));
  col = mix(col, cMid, smoothstep(0.42, 0.70, y));
  col = mix(col, cUpper, smoothstep(0.70, 0.98, y));

  // Sweeping painterly diagonal overcast cloud strata (upper-right toward lower-left)
  vec2 streakUv = vec2(vSkyUv.x * 2.6 + vSkyUv.y * 1.65, vSkyUv.y * 4.4 - vSkyUv.x * 0.72);
  float streakPrimary = skyFbm(streakUv * 2.5);
  float streakFine = skyFbm(streakUv * 5.2 + vec2(3.1, -1.7));
  float strata = smoothstep(0.26, 0.78, streakPrimary * 0.72 + streakFine * 0.28);
  float upperMask = smoothstep(0.30, 0.84, y) * (1.0 - smoothstep(0.93, 1.0, y));
  col = mix(col, cUpper * 0.93, strata * 0.36 * upperMask);

  // Delicate bright overcast wisps catching diffused valley light
  float wispHighlight = smoothstep(0.56, 0.86, streakFine) * upperMask;
  col = mix(col, cMistBand, wispHighlight * 0.16);

  // Soft sunlit-pearl radiant valley glow behind the center horizon
  float glowDist = length((vSkyUv - vec2(0.44, 0.42)) * vec2(0.92, 1.55));
  float centerGlow = smoothstep(0.72, 0.04, glowDist);
  col = mix(col, cMistBand, centerGlow * 0.38);

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
