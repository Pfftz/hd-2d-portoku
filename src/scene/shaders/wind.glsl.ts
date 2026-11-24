export interface WindUniforms {
  uTime: { value: number };
  uWindStrength: { value: number };
  uDriftOffset: { value: number };
}

export interface WindClock {
  uniforms: WindUniforms;
  update: (dt: number, reducedMotion: boolean) => void;
}

/**
 * Integrates strictly monotonic horizontal wind drift so clouds and petals
 * never reverse direction when gust speed dips.
 */
export function advanceDriftOffset(
  prevOffset: number,
  dt: number,
  windStrength: number,
  time: number,
): number {
  const safeDt = Math.max(0, dt);
  const safeStrength = Math.max(0, windStrength);
  const gust = 1.0 + 0.35 * Math.sin(time * 0.4);
  return prevOffset + safeDt * gust * safeStrength;
}

export function createWindClock(): WindClock {
  const uniforms: WindUniforms = {
    uTime: { value: 0 },
    uWindStrength: { value: 1 },
    uDriftOffset: { value: 0 },
  };

  return {
    uniforms,
    update(dt, reducedMotion) {
      const safeDt = Math.max(0, dt);
      const strength = reducedMotion ? 0 : 1;
      uniforms.uWindStrength.value = strength;
      if (strength <= 0) {
        return;
      }
      uniforms.uTime.value += safeDt;
      uniforms.uDriftOffset.value = advanceDriftOffset(
        uniforms.uDriftOffset.value,
        safeDt,
        strength,
        uniforms.uTime.value,
      );
    },
  };
}

export const WIND_SWAY_GLSL = /* glsl */ `
float windHash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float windNoise2D(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = windHash21(i);
  float b = windHash21(i + vec2(1.0, 0.0));
  float c = windHash21(i + vec2(0.0, 1.0));
  float d = windHash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float windGust(vec2 p, float t) {
  vec2 flow = p * 0.18 + vec2(t * 0.45, t * 0.12);
  float n1 = windNoise2D(flow);
  float n2 = windNoise2D(flow * 2.1 - vec2(t * 0.28, 0.0));
  return n1 * 0.65 + n2 * 0.35;
}

vec3 windSway(
  vec3 worldPos,
  float tipFactor,
  float phase,
  float uTime,
  float uWindStrength
) {
  float bendWeight = tipFactor * tipFactor * uWindStrength;
  if (bendWeight <= 0.0001) {
    return vec3(0.0);
  }
  float gust = windGust(worldPos.xz, uTime);
  float sway = sin(uTime * 1.65 + phase + worldPos.x * 0.35) * 0.085;
  float sweep = (gust - 0.32) * 0.19;
  float flutterZ = cos(uTime * 2.15 + phase * 1.3 + worldPos.z * 0.4) * 0.035;
  return vec3((sweep + sway) * bendWeight, -abs(sweep) * 0.18 * bendWeight, flutterZ * bendWeight);
}
`;
