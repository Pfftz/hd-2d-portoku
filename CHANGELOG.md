# Changelog

All notable changes, milestones, and revisions to this interactive portfolio repository are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initialized AI context engineering workflow (`AGENTS.md`, `BRAIN.md`, `CHANGELOG.md`).
- Defined 2.5D / HD-2D Z-depth scene architecture, overcast color palette lock, and pixel-art rendering contracts.
- Outlined 4-slice vertical development roadmap and decoupled asset pipeline.
- Added MCP tool routing profile (`.agents/rules/mcp-routing.md`) and `llms.txt` navigation map.
- Initialized rtk for Antigravity; ignored `graphify-out/`.
- Finalized formal design document (`docs/designs/hd-2d-flower-hill-portfolio.md`) covering CUJs, architecture, alternatives, NFRs, and the 35-file Slice 1 to 4 implementation and verification plan.
- Implemented Slice 1 (`Layout Contract, Framing & Movement Skeleton`): Vite + TypeScript + Three.js (`^0.170.0`) + ESLint + Vitest scaffold, `src/scene/layout.ts` spatial/crop contract, `src/assets/manifest.ts`, `src/content/nodes.json` + `validateNodes.ts`, `src/state/appState.ts`, `src/input/inputRouter.ts`, `src/scene/{placeholders,renderer,camera,hero,plates,sceneController}.ts`, `src/ui/{styles.css,hudControls.ts,archiveDrawer.ts}`, `src/main.ts`, `public/assets/README.md`, and 19 unit tests across `tests/{layout,appState,validateNodes}.test.ts`.

### Changed
- Applied the `/egm-review` Consolidated Proposed Replacement to `docs/designs/hd-2d-flower-hill-portfolio.md` and marked its status `Finalized`.
- Widened `clouds` plate `worldWidth` from `96.0` to `104.0` in `src/assets/manifest.ts`, `public/assets/README.md`, and the design spec so the plate exceeds `minPlateWidth(-42, 0.70) = 101.21` across 21:9 + max camera pan.
- Finalized v1 architecture from multi-lens Goldfish brainstorm: dropped `EffectComposer`, runtime bloom, and runtime tilt-shift in favor of native MSAA driving `alphaToCoverage` on `InstancedMesh` lilies, additive landmark glow planes, CSS vignette, and pre-softened foreground-lip/sky plates.
- Replaced `THREE.Points` petals with a 150-to-250-quad `InstancedMesh` batch and split `wind.glsl` into oscillating `windSway` and monotonic negative-X `windDrift` (requiring horizontally tileable `clouds.webp` and `fog: false` or light `uFogMix` on pre-graded plates).
- Updated portrait mobile framing (`100dvh` with moderate pullback to preserve 64px sprite legibility, revealing citadel and watchtower via ridge walking).
- Expanded asset and layout contracts (`layout.ts`, typed asset manifest, 5 parallax plates + 2 lily atlases, exact-ratio labeled placeholders, `.mp3`/`.m4a` `AudioBufferSourceNode` + 4s pink-noise `AudioBuffer`, WebGL-failure HTML `Index/Archive` auto-fallback, and `prefers-reduced-motion` policy).
- Reordered vertical slices so Slice 1 validates spline metrics, camera framing, hero scale, and exact-ratio placeholder plates before dense foliage and dialogue/audio integration.
- Locked WebP-with-alpha primary plate format (`.png` accepted for local art testing) with silhouette crop/placement offsets (`offsetX`, `offsetY`, `worldWidth`, `worldHeight`) and master-canvas crop guide, `side: THREE.DoubleSide` hero mirroring (`scale.x = -1`), vertical `WORKS_PICKER` choice menu, unobstructed whisper cue with `150ms` refocus and `8px` drag guards, `alphaTest: 0.3` + `customProgramCacheKey()` foliage shader contract, and `?debug=1` `horizonY`/wireframe alignment overlay.
