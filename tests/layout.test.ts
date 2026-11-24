import { describe, expect, it } from 'vitest';
import { ASSET_MANIFEST } from '../src/assets/manifest.ts';
import { stepCameraDamper } from '../src/scene/camera.ts';
import {
  INTERACT_RADIUS,
  LANDMARK_T,
  RIDGE_LENGTH,
  computeCameraFraming,
  computeEndpointDamping,
  cropPixelsToManifest,
  frustumWidthAtZ,
  minPlateWidth,
  sampleRidge,
} from '../src/scene/layout.ts';

describe('layout spatial math', () => {
  it('keeps sampleRidge within RIDGE_LENGTH and |z| <= 0.4', () => {
    expect(sampleRidge(-0.5).x).toBeCloseTo(-RIDGE_LENGTH * 0.5);
    expect(sampleRidge(0.5).x).toBeCloseTo(0);
    expect(sampleRidge(1.5).x).toBeCloseTo(RIDGE_LENGTH * 0.5);

    for (let i = 0; i <= 20; i += 1) {
      const point = sampleRidge(i / 20);
      expect(Math.abs(point.z)).toBeLessThanOrEqual(0.300001);
      expect(Math.abs(point.z)).toBeLessThanOrEqual(0.4);
    }
  });

  it('brakes outward in outer 5% cliff zones while allowing 1.0x inward escape', () => {
    expect(computeEndpointDamping(0, -1)).toBe(0);
    expect(computeEndpointDamping(0.025, -1)).toBeGreaterThan(0);
    expect(computeEndpointDamping(0.025, -1)).toBeLessThan(1);
    expect(computeEndpointDamping(0, 1)).toBe(1);
    expect(computeEndpointDamping(0.02, 1)).toBe(1);

    expect(computeEndpointDamping(1, 1)).toBe(0);
    expect(computeEndpointDamping(0.975, 1)).toBeGreaterThan(0);
    expect(computeEndpointDamping(0.975, 1)).toBeLessThan(1);
    expect(computeEndpointDamping(1, -1)).toBe(1);
    expect(computeEndpointDamping(0.98, -1)).toBe(1);

    expect(computeEndpointDamping(0.5, -1)).toBe(1);
    expect(computeEndpointDamping(0.5, 0)).toBe(1);
  });

  it('keeps about landmark outside INTERACT_RADIUS from spawn t = 0.50', () => {
    const spawnX = sampleRidge(0.5).x;
    const aboutX = sampleRidge(LANDMARK_T.about).x;
    expect(Math.abs(spawnX - aboutX)).toBeGreaterThan(INTERACT_RADIUS);
  });

  it('computes minPlateWidth >= 21:9 frustum width plus pan', () => {
    const w = minPlateWidth(-42, 0.7);
    expect(w).toBeGreaterThan(frustumWidthAtZ(-42, 21 / 9));
    expect(ASSET_MANIFEST.plates.clouds.worldWidth).toBeGreaterThanOrEqual(w);
  });

  it('computes responsive camera framing across 21:9, 4:3, 1:1, and 9:16', () => {
    const wide = computeCameraFraming(21 / 9);
    const standard = computeCameraFraming(4 / 3);
    const square = computeCameraFraming(1);
    const portrait = computeCameraFraming(9 / 16);

    expect(wide.pullback).toBe(1);
    expect(standard.pullback).toBe(1);
    expect(square.pullback).toBeGreaterThan(1);
    expect(square.isPortrait).toBe(false);
    expect(portrait.isPortrait).toBe(true);
    expect(portrait.pullback).toBeGreaterThanOrEqual(1.15);
    expect(portrait.pullback).toBeLessThanOrEqual(1.45);
    expect(portrait.targetOffsetY).toBeLessThan(standard.targetOffsetY);
  });

  it('maps trimmed master-canvas pixel bounds cleanly via cropPixelsToManifest', () => {
    const centered = cropPixelsToManifest(1520, 840, 800, 400);
    expect(centered.offsetX).toBeCloseTo(0);
    expect(centered.offsetY).toBeCloseTo(0);
    expect(centered.worldWidth).toBeCloseTo(20);
    expect(centered.worldHeight).toBeCloseTo(10);
  });

  it('converges stepCameraDamper smoothly toward target', () => {
    let pos = 0;
    let vel = 0;
    for (let i = 0; i < 60; i += 1) {
      const next = stepCameraDamper(pos, vel, 4, 0.18, 1 / 60);
      pos = next.position;
      vel = next.velocity;
    }
    expect(pos).toBeCloseTo(4, 2);
  });

  it('maintains valid ASSET_MANIFEST plate and landmark invariants', () => {
    for (const plate of Object.values(ASSET_MANIFEST.plates)) {
      expect(plate.horizonY).toBeGreaterThanOrEqual(0);
      expect(plate.horizonY).toBeLessThanOrEqual(1);
      expect(plate.worldWidth).toBeGreaterThan(0);
      expect(plate.worldHeight).toBeGreaterThan(0);
    }
    const keys = Object.keys(ASSET_MANIFEST.landmarks).sort();
    expect(keys).toEqual(['about', 'contact', 'interests', 'works']);
    for (const landmark of Object.values(ASSET_MANIFEST.landmarks)) {
      expect(landmark.worldWidth).toBeGreaterThan(0);
      expect(landmark.worldHeight).toBeGreaterThan(0);
      expect(landmark.hitRadius).toBeGreaterThan(0);
    }
  });
});
