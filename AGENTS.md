# AGENTS.md: Operational & Aesthetic Rules

## 1. Project Identity & Creative Target
- **Project:** Interactive 2.5D (HD-2D) Personal Portfolio.
- **Visual Reference:** The flower-covered hilltop scene from *Valkyrie Profile* combined with Square Enix HD-2D layering (2D pixel-art sprite in a shader-driven 3D meadow with depth fog and parallax).
- **Tone:** Quiet, melancholic, personal, and atmospheric.
- **Anti-Goal:** This is NOT a corporate resume, SaaS landing page, or tech-stack showcase. Do not add skill bars, enterprise buzzwords, glassmorphism modals, or generic portfolio navbars.

## 2. Architecture & Tech Stack
- **Core:** Vanilla TypeScript + Three.js (Vite). Keep runtime dependencies minimal (no React or R3F). Post-processing uses a multisampled (`WebGLRenderTarget` `HalfFloatType`) `EffectComposer` + `RenderPass` + subtle `UnrealBloomPass` + `OutputPass` so native MSAA `alphaToCoverage` on the lily meadow stays intact.
- **Separation of Concerns:**
  - `src/scene/`: Three.js rendering (`WebGLRenderer({ antialias: true })`), `layout.ts` single world-metric contract, GLSL wind module (`windSway` and `windDrift`), camera rig (Itay Keren deadzone spring follow + idle desktop mouse-look parallax), `?debug=1` alignment overlay (`horizonY` guideline and cropped-plate wireframes), and placeholder generator.
  - `src/assets/manifest.ts`: Typed asset manifest defining 64px sprite grid, pivot, and 2px gutters, lily atlas cells, WebP-primary plate specs with silhouette crop/placement offsets (`offsetX`, `offsetY`, `worldWidth`, `worldHeight`) for tightly cropped `citadel`, `ghostCastle`, and `watchtower`, full-width `clouds` (`tileX: true`) and `foregroundLip`, horizon Y, and audio paths.
  - `src/content/nodes.json`: Validated portfolio copy, 4 landmark story entries (`about` at `t = 0.43`, `works`, `interests`, `contact`), Selected Works choice titles + `[Inspect]` data, and links driving both the 3D landmarks and the semantic HTML `Index/Archive` fallback. Never hardcode narrative copy in scene or UI code.
  - `src/ui/`, `src/audio/`, `src/state/`, `src/input/`: Plain TypeScript DOM controllers (JRPG dialogue box, vertical `WORKS_PICKER`, plain `[Inspect]` card, `Index/Archive` drawer, sound/mute toggle, CSS vignette), Web Audio engine, centralized mode/input state machine, and unified pointer/keyboard router (zero-walk wake click, `150ms` window-refocus guard, `8px` drag guard, keyboard override).
  - `public/assets/`: Hot-swappable owner art (`sprites/hero.png`, `foliage/lily-leaves.png`, `foliage/lily-bells.png`, `backdrop/citadel.webp`, `backdrop/ghost-castle.webp`, `backdrop/watchtower.webp`, `backdrop/clouds.webp`, `backdrop/cloud-wisps.webp`, `backdrop/cloud-bank-right.webp`, `backdrop/celestial-sky.webp`, `backdrop/foreground-lip.webp` with `.png` accepted during local testing, and `audio/theme.mp3` or `.m4a` with optional `.ogg`). See `public/assets/README.md` for master-canvas crop conversion rules.
- **Framing & Ridge Traversal:**
  - Full viewport (`100vw x 100dvh`), Hor+ scaling on widescreen with a central 4:3 safe area. Portrait mobile uses moderate camera pullback so the 64px hero stays readable above the dialogue box while ridge walking reveals the left citadel and right watchtower.
  - Movement is 1D left/right walking along a curved hilltop spline (~3x 4:3 safe-area width, crossed in 8 to 12 seconds) with soft deceleration in the outer 5% cliff endpoint zones; no open 3D free-roam.
- **Rendering Depth Stack (Back to Front):**
  1. **Sky Dome (`z = -120`, `fog: false`) & Celestial Sky (`z = -110`, `parallax: 0.99`, `NormalBlending`):** Custom GLSL warm overcast ivory gradient (`#dfddd4` zenith to `#f3f1ea` horizon) layered behind a horizontally tiling `celestial-sky.webp` cirrus/altostratus backdrop (`NearestFilter`, `RepeatWrapping`).
  2. **Architectural & Cloud Parallax Plates (`z = -14` to `-62`):** Separate alpha WebP plates (`citadel.webp`, `ghost-castle.webp`, crisp `NearestFilter` `watchtower.webp` with animated 3-layer `cloud-bank-right.webp` concealing its base cliff, and horizontally tileable `clouds.webp`/`cloud-wisps.webp` with `RepeatWrapping`), lightly graded (`fog: false` or per-plate `uFogMix`).
  3. **Foreground Hill (`z = -5` to `+8`):** Curved terrain + `THREE.InstancedMesh` lily leaf/bell cards (`MeshBasicMaterial` + `onBeforeCompile` wind, native MSAA `alphaToCoverage`) + warm `THREE.FogExp2` (`#e8e5dc`) + tumbling `InstancedMesh` petals.
  4. **Hero & 4 Interactive Landmarks (`z = 0`):** 64px alpha-cutout hero sprite + 4 landmarks (`Lily cluster`, `Weathered stone/lantern`, `Cliffside overlook`, `Signpost/wind chime`) highlighted by soft additive glow planes.
  5. **Foreground Flower Lip (`z > 0`, in front of hero knees):** Pre-softened painted lily strip providing knee-deep occlusion and soft bottom framing.
  6. **Post-Processing & Vignette:** Multisampled `HalfFloatType` `EffectComposer` (`RenderPass` -> subtle `UnrealBloomPass` with `threshold: 0.84`, `strength: 0.26`, `radius: 0.4` -> `OutputPass`) plus a lightweight CSS `radial-gradient` overlay (`pointer-events: none`).

## 3. Strict Anti-Slop Visual & Accessibility Rules
- **Color Palette Lock:** Keep the environment strictly desaturated and overcast, reserving vivid blue strictly for the hero as the single focal accent:
  - Foliage Base: `#5b6e5d` (desaturated sage)
  - Blossoms & Petals: `#f2efe4` (warm ivory)
  - Overcast Sky & Haze: warm pearl, ivory, and muted beige with `#c9ced6` misty horizon haze
  - Distant Citadel & Shadows: pale silver-white and `#4a5568` slate shadows; dark olive-grey watchtower and obelisk
  - Hero Single Accent: periwinkle-to-cobalt blue hair with pale silver highlights, royal blue and white upper tunic, warm tan-brown lower garments
- **No Primitive-Art Slop:** Characters, castles, watchtower, clouds, and foreground lip must use 2D alpha-cutout planes, never raw `BoxGeometry` or `SphereGeometry` primitives.
- **Sprite vs. Foliage Alpha Contracts:**
  - Pixel-art hero sprite (`64x64` frames, 2px transparent gutters, 4 to 6 idle wind frames, 6 to 8 walk frames): `texture.magFilter = THREE.NearestFilter`, `texture.minFilter = THREE.NearestFilter`, `texture.generateMipmaps = false`, `material.alphaTest = 0.5`, `material.side = THREE.DoubleSide`, horizontally mirrored via `mesh.scale.x = -1` when walking right.
  - Native-res 3D `InstancedMesh` lily cards: `MeshBasicMaterial` + `onBeforeCompile` with a unique `customProgramCacheKey()`, `alphaToCoverage = true`, `transparent = false`, and `alphaTest = 0.3` driven by `WebGLRenderer({ antialias: true })` native MSAA (falling back to `alphaToCoverage = false`, `alphaTest = 0.5` if hardware MSAA is unavailable).
- **UI & Accessibility Contract:** All text interaction uses a minimal PS1/PSP JRPG-style bottom dialogue box (instant sentence finish on first press, advance on second), a diegetic `[E]`/tap cue only in range (`interactRadius` ~2.0u), a vertical JRPG `WORKS_PICKER` choice menu (`W`/`S`, arrows, click, or tap) for 2 to 3 Selected Works, and a plain JRPG-styled `[Inspect]` preview card (no glassmorphism). Keep the opening idle screen clear of HUD clutter except an unobstructed lower-frame whisper cue (`"Click anywhere to begin"`), a low-opacity corner `Index/Archive` button (semantic HTML fallback with real focusable links from `nodes.json`), and a corner sound toggle distinguishing `UNSTARTED`, `PLAYING`, and `MUTED`. Auto-fallback to `Index/Archive` on WebGL failure or `webglcontextlost`. Under `prefers-reduced-motion: reduce`, halt or minimize wind sway, cloud/petal drift, mouse parallax, and spring overshoot, and render dialogue text immediately.

## 4. Performance, Shader & Audio Standards
- **Foliage & Petals:** Always use `THREE.InstancedMesh` for lily leaf/bell cards and a single 150-to-250-quad `InstancedMesh` batch for tumbling petals (never create individual `Mesh` loops and never use `THREE.Points` for petals; target 60 FPS on integrated GPUs with bounded DPR).
- **Split Unified Wind (`wind.glsl`):** Drive all motion from one shared `uTime` + Simplex gust system split into oscillating `windSway` (lilies) and monotonic negative-X `windDrift` (tileable clouds and petals).
- **Audio:** Use licensed (`CC0`/`CC-BY`/commissioned/own; never copyrighted *VP* audio) orchestral BGM (`.mp3`/`.m4a` primary, optional `.ogg`) decoded via Web Audio `AudioBufferSourceNode` for reliable iOS Safari 2s fade-in on the first pointer/click gesture outside Mute, paired with a pre-baked 4s pink-noise `AudioBuffer` wind bed on a separate gain node (an intentional departure from the silent-wind reference). Pressing `A`/`D` first without clicking allows immediate movement while keeping audio `UNSTARTED` until a pointer gesture.

## 5. Agent Workflow Rules
- **Read First:** Always read `BRAIN.md` before writing or modifying code.
- **Vertical Slices Only:** Build strictly one approved slice at a time. Do not scaffold future slices or unrequested features.
- **Exact-Ratio Placeholders:** Before final assets exist in `public/assets/`, generate clean labeled placeholder sprites and plates directly from `layout.ts` and `manifest.ts` ratios rather than failing silently or generating throwaway procedural art.
- **Documentation Sync:** After completing any milestone or architectural change, update `BRAIN.md` (current state) and `CHANGELOG.md` (under `[Unreleased]`).

## 6. MCP Tool Routing
Always follow the tool routing matrix, chaining protocols, and operational restrictions defined in [`.agents/rules/mcp-routing.md`](.agents/rules/mcp-routing.md).
Check live session MCP availability before calling routed servers and fall back cleanly if a server is not exposed.
Never skip `context7` for library/API specs or `sequential-thinking` before complex multi-file architecture or refactors.

## 7. Context Files
- **Recommended read order:** `llms.txt` -> `AGENTS.md` -> `BRAIN.md` -> [docs/designs/hd-2d-flower-hill-portfolio.md](docs/designs/hd-2d-flower-hill-portfolio.md).
- **Milestone history:** Update `CHANGELOG.md` under `[Unreleased]` after every completed milestone or architectural change.
- **RTK CLI rules:** Token-saving CLI wrapper rules installed by `rtk init --agent antigravity` live in [`.agents/rules/antigravity-rtk-rules.md`](.agents/rules/antigravity-rtk-rules.md).
