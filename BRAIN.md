# BRAIN.md: Active Working Memory

**Last Updated:** 2026-11-23
**Current Phase:** Slice 1 Complete: Awaiting User Framing & ?debug=1 Inspection Before Slice 2

## Today's Focus
- [x] Initialize repository context files (`AGENTS.md`, `BRAIN.md`, `CHANGELOG.md`, `llms.txt`, `.agents/rules/mcp-routing.md`).
- [x] Complete multi-lens Goldfish brainstorm and lock v1 architecture into `concepts_brief.md` and repo docs.
- [x] Complete formal design document (`docs/designs/hd-2d-flower-hill-portfolio.md`) and sync context files.
- [x] Finalize design document via `/egm-review` and implement Slice 1 (`Layout Contract, Framing & Movement Skeleton`).
- [ ] Inspect live Slice 1 framing (`21:9`, `16:9`, `4:3`, `9:16`) and `?debug=1` alignment overlay before starting Slice 2.

## Locked Decisions
- **Stack:** Vanilla TypeScript + Three.js + Vite (`three` only; no React/R3F).
- **Zero-Post-Processing v1 (Option A):** Render directly to `WebGLRenderer({ antialias: true })` backbuffer so native MSAA drives `alphaToCoverage` (`alphaTest: 0.3` with `customProgramCacheKey()`, falling back to `alphaTest: 0.5`) on `MeshBasicMaterial` + `onBeforeCompile` lily `InstancedMesh` cards (no `EffectComposer`, runtime bloom, or runtime tilt-shift in v1). Use soft additive glow planes on the 4 landmarks, CSS radial-gradient vignette, and pre-softened edges on the painted foreground-lip and sky plates.
- **Petals & Split Wind:** 150-to-250-quad `InstancedMesh` batch for tumbling petals (no `THREE.Points`). Split `wind.glsl` into oscillating `windSway` (lilies) and monotonic negative-X `windDrift` (horizontally tileable `clouds.webp` with `RepeatWrapping`, plus petals), with `fog: false` or light `uFogMix` on pre-graded architectural plates.
- **Movement, Hero Mirroring & Camera:** 1D left/right walking along a curved hilltop spline (~3x 4:3 safe-area width, 8 to 12s crossing, outer 5% cliff endpoint deceleration), horizontal sprite mirroring (`scale.x = -1`) with `side: THREE.DoubleSide`, Itay Keren horizontal deadzone spring camera, idle desktop mouse-look parallax, and centered left-facing spawn pose (`t = 0.50`, with `about` at `t = 0.43` outside `interactRadius = 2.0`).
- **Framing:** Full viewport (`100vw x 100dvh`), Hor+ widescreen with central 4:3 safe area. On portrait mobile, drop dual flanking-landmark visibility in favor of moderate pullback keeping the 64px hero readable above the dialogue box while walking reveals the citadel and watchtower.
- **Unified Input, Opening & Works UI:** Unobstructed lower-frame whisper cue (`"Click anywhere to begin"`) unlocking audio on pointer/tap without setting a `walkTarget`; pressing `A`/`D` first enters `EXPLORING` immediately leaving audio `UNSTARTED` (indicated on corner toggle) until a pointer gesture. Desktop click-to-walk/landmark unified with mobile tap using `150ms` refocus guard, `8px` drag guard, and immediate keyboard override. Selected Works uses a vertical JRPG `WORKS_PICKER` (`W`/`S`, arrows, click, or tap) leading to a short reflection and plain `[Inspect]` card/link; accessible corner `Index/Archive` drawer, WebGL-failure auto-fallback, and `prefers-reduced-motion` policy.
- **Audio:** Licensed (`CC0`/`CC-BY`/commissioned/own) orchestral loop (`.mp3`/`.m4a` primary, `.ogg` optional) decoded via Web Audio `AudioBufferSourceNode` for reliable iOS Safari 2s fade-in, paired with a pre-baked 4s pink-noise `AudioBuffer` wind bed on a separate gain node.
- **Plates, Crop Anchors & Placeholders:** Single `layout.ts` world-metric contract and typed `manifest.ts` using alpha `.webp` primary plates (`.png` accepted for local testing) with `offsetX`, `offsetY`, `worldWidth`, and `worldHeight` crop/placement offsets for tightly cropped `citadel`, `ghostCastle`, and `watchtower` (master-canvas workflow in `public/assets/README.md` + `?debug=1` `horizonY` guideline and cropped-plate wireframe toggle), plus exact-ratio labeled placeholders until final owner art arrives.

## Asset Status
- `public/assets/sprites/hero.png` (64px grid, 2px gutters, 4 to 6 idle + 6 to 8 walk frames) - Pending owner art (exact-ratio labeled placeholder active in Slice 1).
- `public/assets/foliage/lily-leaves.png` - Pending owner art (placeholder in Slice 2).
- `public/assets/foliage/lily-bells.png` - Pending owner art (placeholder in Slice 2).
- `public/assets/backdrop/citadel.webp` (tight silhouette crop, `.png` local ok) - Pending owner art (exact-ratio placeholder active in Slice 1).
- `public/assets/backdrop/ghost-castle.webp` (tight silhouette crop, `.png` local ok) - Pending owner art (exact-ratio placeholder active in Slice 1).
- `public/assets/backdrop/watchtower.webp` (tight silhouette crop, `.png` local ok) - Pending owner art (exact-ratio placeholder active in Slice 1).
- `public/assets/backdrop/clouds.webp` (`worldWidth: 104.0` >= `minPlateWidth(-42, 0.70) = 101.21`, horizontally tileable, `.png` local ok) - Pending owner art (exact-ratio placeholder active in Slice 1).
- `public/assets/backdrop/foreground-lip.webp` (full width, pre-softened bottom lip, `.png` local ok) - Pending owner art (exact-ratio placeholder active in Slice 1).
- `public/assets/audio/theme.mp3` (primary `.mp3`/`.m4a`, optional `.ogg`) - Pending owner licensed track (Slice 3).

## Planned Vertical Slices
1. [x] **Slice 1 (Layout Contract, Framing & Movement Skeleton):** Vite + TS + Three.js (`^0.170.0`) + ESLint + Vitest scaffold, `layout.ts` world-metric contract, `manifest.ts` (WebP primary + silhouette crop offsets, `clouds.worldWidth = 104.0`), `public/assets/README.md` master-canvas conversion guide, exact-ratio labeled placeholders, Hor+ widescreen and moderate portrait `100dvh` camera, deadzone spring follow + idle mouse parallax, unified keyboard + click/tap-to-walk with refocus/drag/wake guards, `?debug=1` `horizonY`/wireframe toggle, CSS vignette, WebGL-failure HTML Archive fallback, and 19 passing unit tests.
2. [ ] **Slice 2 (Living Meadow & Unified Wind):** Overcast sky dome shader, tuned `FogExp2` (light/no fog on pre-graded plates), shared `wind.glsl` (`windSway` + `windDrift`), `MeshBasicMaterial` + `onBeforeCompile` (`alphaTest: 0.3` + `customProgramCacheKey()`) lily `InstancedMesh` cards with native MSAA `alphaToCoverage`, 150-to-250-quad `InstancedMesh` tumbling petals, tileable `clouds.webp` drift, `prefers-reduced-motion` policy.
3. [ ] **Slice 3 (Narrative UI, Landmarks & Audio):** Validated `src/content/nodes.json`, 4 landmarks with additive soft-glow planes + proximity `[E]`/tap cue, centralized state machine (`src/state/`), skippable JRPG dialogue box + vertical `WORKS_PICKER` + plain `[Inspect]` works card, semantic HTML `Index/Archive` drawer + sound/mute toggle (`UNSTARTED`/`PLAYING`/`MUTED`), Web Audio `AudioBufferSourceNode` BGM 2s fade-in + pre-baked 4s pink-noise wind bed.
4. [ ] **Slice 4 (Owner Art Integration & Polish):** Drop in owner sprite, lily atlases, 5 painted/cropped WebP plates, final `nodes.json` copy, and licensed BGM loop; verify 60 FPS on integrated GPU and mobile viewports.

## Next Step
- Inspect the live Slice 1 framing (`npm run dev`, `?debug=1` with `[G]` wireframes, `?noMsaa=1`, `?loseContext=1`, across `21:9`, `16:9`, `4:3`, and `9:16`) before approving Slice 2.
