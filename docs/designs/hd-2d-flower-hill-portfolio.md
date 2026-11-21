# HD-2D Flower Hill Portfolio

*   **Author:** Pfftz
*   **Status:** Proposed
*   **Date:** 2026-11-21

--------------------------------------------------------------------------------

## Overview

This document specifies the design for an interactive 2.5D (HD-2D) personal portfolio built with Three.js, Vite, and TypeScript (`three` only; no React, R3F, or `EffectComposer` in v1). Drawing directly from the flower-covered hilltop scene in *Valkyrie Profile*, the opening frame places a lone 64px pixel-art character in vivid periwinkle-to-cobalt hair and royal blue tunic at the center of an overcast lily-of-the-valley ridge, gazing left across a desaturated valley framed by a distant silver-white citadel, a ghostly center castle, a right olive-grey watchtower and obelisk, drifting creamy clouds, and tumbling petals.

Target visitors are peers, collaborators, and curious readers exploring personal background, selected works, creative interests, and contact links. Rather than scrolling through a generic corporate resume, visitors walk the character left and right along a short curved hilltop ridge to read four quiet narrative landmarks through a minimal JRPG dialogue box, backed by a semantic HTML `Index/Archive` drawer for instant reading, keyboard navigation, and screen-reader access.

## The Problem

Personal portfolios on the web typically fail in one of two ways:

1. **Template Sameness:** Standard portfolio templates rely on corporate resume grids, skill bars, glassmorphism modals, and marketing buzzwords that erase personal mood and atmosphere.
2. **Broken 2.5D/3D Web Experiments:** Interactive 3D web portfolios routinely drop frames on integrated GPUs and phones due to heavy post-processing (`EffectComposer` breaking hardware MSAA or blooming white UI/sprites), shrink key subjects into unreadable dots on portrait mobile screens, stall behind blocking splash gates or broken Safari Web Audio autoplay, trap readers behind unskippable typewriter text, and lock keyboard or screen-reader users out of canvas-only content.

This design solves both problems together: a zero-post-processing, native-MSAA Three.js hilltop scene paired with an unobstructed whisper-cue opening, skippable JRPG dialogue, a vertical JRPG choice picker for Selected Works, one validated `src/content/nodes.json` driving both 3D landmarks and the HTML `Index/Archive` fallback, and a strict world-metric and placeholder manifest before final owner art is painted.

## Goals

*   **Opening Frame Fidelity:** Reproduce the *Valkyrie Profile* hilltop mood and silhouette on initial load: centered left-facing 64px hero in vivid blue as the sole color accent, desaturated sage/ivory/silver/olive environment, 5 depth parallax plates, swaying lilies, and tumbling petals, with no blocking splash modal.
*   **Brisk 1D Ridge Exploration:** Restrict traversal to left/right walking along a curved hilltop spline (~3x the 4:3 safe-area width, crossed in 8 to 12 seconds), supported by desktop (`A`/`D`/arrows + `E`/`Space`) and mobile tap-to-walk / tap-landmark controls.
*   **Responsive Cross-Device Framing & 60 FPS Target:** Fill `100vw x 100dvh` with Hor+ widescreen scaling (central 4:3 safe area) and moderate portrait mobile pullback keeping the 64px sprite readable above the dialogue box while walking reveals flanking landmarks. Render directly to `WebGLRenderer({ antialias: true })` so native MSAA drives `alphaToCoverage` at 60 FPS on integrated GPUs.
*   **Skippable JRPG Narrative & Works Picker:** Present 4 landmarks (`Lily cluster`, `Weathered stone/lantern`, `Cliffside overlook`, `Signpost/wind chime`) with in-range `[E]`/tap cues, a bottom dialogue box (instant sentence finish on first press, advance on second), and a vertical JRPG choice list (2 to 3 project titles with a cursor arrow) inside Selected Works leading to a plain `[Inspect]` card.
*   **Accessibility, Fallbacks & Reliable Audio:** Maintain 100% content and link parity in a corner HTML `Index/Archive` drawer driven by `src/content/nodes.json`, auto-fallback to `Index/Archive` on WebGL failure or `webglcontextlost`, respect `prefers-reduced-motion: reduce` (halting/minimizing wind, drift, parallax, and spring overshoot, with instant dialogue display), and play licensed `.mp3`/`.m4a` (optional `.ogg`) BGM via `AudioBufferSourceNode` with a 2s fade-in + 4s pink-noise wind bed on first pointer/tap gesture outside Mute.
*   **Zero-Code Asset Hot-Swapping:** Define one `layout.ts` world-metric contract and typed asset manifest so clean labeled placeholders match exact final dimensions (including 21:9 + pan, portrait overdraw, horizontally tileable `clouds.webp`, and 64px sprite pivot/padding).

## Non-Goals

*   **No `EffectComposer`, Runtime Bloom, or Runtime Tilt-Shift in v1:** Screen-space post passes disable default MSAA, add multi-pass GPU load, and blur/bleed into the crisp 64px sprite. Soft additive glow planes, a CSS vignette, and pre-softened foreground-lip/sky plates replace them.
*   **No `THREE.Points` Petals:** Tumbling petals use a single 150-to-250-quad `InstancedMesh` batch to avoid `gl_PointSize` limits and rotated square clipping.
*   **No Forced Simultaneous Flanking Landmarks on Portrait Mobile:** Deep portrait pullback shrinks the sprite and compresses the walk; walking reveals the citadel and watchtower.
*   **No Open 3D Free-Roam or Game Mechanics:** No Z-axis roaming, jumping, combat, inventory, RPG stats, or branching story trees.
*   **No Full-Screen Pixelation or Bokeh DOF:** Avoid shimmering stems and heavy mobile blur passes.
*   **No Corporate Portfolio Patterns or Frameworks:** No React, R3F, CMS backends, skill bars, timelines, glassmorphism modals, multi-tab `[Inspect]` case studies, top navbars, or third-party analytics.
*   **No Copyrighted *Valkyrie Profile* Audio:** Only `CC0`, `CC-BY`, commissioned, or original audio is permitted.

## Open Questions

None. All architectural, input, sprite, and framing questions were resolved prior to drafting the Technical Plan.

## Critical User Journeys (CUJs)

### CUJ 1: Opening Arrival and Unobstructed Audio Wake

*   **Given**: The visitor loads the portfolio URL on desktop or mobile in a WebGL-capable browser, starting centered on the left-facing hero in the exact reference composition with a quiet low-opacity whisper prompt near the lower frame (`"Click anywhere to begin"`).
*   **When**:
    *   *Path A (Pointer/Tap First):* The visitor clicks or taps anywhere outside the corner `Mute` and `Index/Archive` buttons.
    *   *Path B (Desktop Keyboard First):* A desktop visitor immediately presses `A`, `D`, or Left/Right Arrow before any pointer click.
*   **Then**:
    *   In *Path A*, the whisper prompt fades out permanently, Web Audio unlocks on the pointer gesture, BGM fades in over 2 seconds alongside the ultra-quiet 4s pink-noise wind bed, and the visitor can walk or click/tap freely.
    *   In *Path B*, the character enters `EXPLORING` immediately without blocking movement, the whisper prompt fades out (or updates to indicate sound is waiting on a click), and the corner audio toggle visibly remains in its muted/unstarted state until a pointer gesture unlocks Web Audio and starts the 2s fade-in.

### CUJ 2: Ridge Exploration and Selected Works JRPG Choice Picker

*   **Given**: The visitor is walking along the curved hilltop spline (`EXPLORING` state) with the damped deadzone spring camera following smoothly.
*   **When**: The visitor walks to the `Weathered stone / lantern` landmark, presses `E` or `Space` (or taps the diegetic `[E]`/tap cue), navigates the vertical JRPG choice list of 2 to 3 project titles (`W`/`S`, Up/Down arrows, click, or tap), selects one, reads its short reflection (pressing once to finish typing instantly, twice to advance), and activates `[Inspect]`.
*   **Then**: Movement and idle parallax pause cleanly while dialogue is open, the cursor arrow moves smoothly between project entries, `[Inspect]` displays a plain JRPG-styled card containing a single image/brief note and an external link (`Esc` or close button returns to dialogue/ridge without losing position), and closing dialogue restores normal walking.

### CUJ 3: Portrait Mobile Exploration (`100dvh`)

*   **Given**: A visitor opens the portfolio on a portrait phone (~9:16 viewport inside `100dvh`).
*   **When**: The scene initializes with moderate camera pullback keeping the 64px sprite crisp and readable above the dialogue box reserve; the visitor taps near the left or right side of the ridge to explore, then taps a glowing landmark from across the meadow.
*   **Then**: Tapping the ridge moves the character smoothly along the spline to reveal the far-left silver-white citadel and right-side olive-grey watchtower without shrinking the character into a speck or clipping the dialogue UI. Tapping an out-of-range landmark walks the hero into range and opens its dialogue on arrival, while tapping inside open dialogue advances text without queuing an unintended canvas walk target.

### CUJ 4: Accessible Archive, Reduced Motion, and WebGL Failure Fallback

*   **Given**: A visitor either relies on keyboard/screen-reader navigation, enables `prefers-reduced-motion: reduce`, or hits WebGL initialization failure / `webglcontextlost`.
*   **When**: The visitor activates the corner `Index/Archive` button (`Tab` + `Enter` or click), or WebGL fails/loses context on startup or mid-session.
*   **Then**: The semantic HTML `Index/Archive` drawer opens (or takes over automatically on WebGL failure), exposing all 4 landmark texts, Selected Works notes, and focusable outbound links directly from `src/content/nodes.json` with clean focus trapping and `Esc` return. Under `prefers-reduced-motion: reduce`, wind sway, cloud/petal drift, mouse parallax, and spring camera overshoot are halted or minimized, and JRPG dialogue text renders immediately without typewriter delay.

## Technical Plan (Architecture)

### 1. System Architecture & Component Boundaries

The application separates 3D scene rendering, spatial framing math, editorial data, DOM UI overlays, audio playback, and input routing into plain TypeScript modules driven by one central state machine.

```text
+-------------------------------------------------------------------------+
|                              src/main.ts                                |
|  (WebGL init guard -> webglcontextlost / error fallback -> rAF loop)    |
+-----+-------------------------+-------------------------+---------------+
      |                         |                         |
      v                         v                         v
+------------+          +---------------+         +----------------+
| src/state/ |<-------->|  src/input/   |         |  src/content/  |
| appState   |          |  inputRouter  |         |  nodes.json    |
+-----+------+          +---------------+         |  + validator   |
      |                                           +-------+--------+
      +-------------------+-------------------------------+
      |                   |                               |
      v                   v                               v
+-------------+   +---------------+               +---------------+
| src/scene/  |   |   src/ui/     |               |  src/audio/   |
| - layout.ts |   | - dialogueBox |               |  audioEngine  |
| - camera.ts |   | - worksPicker |               |  (BGM + 4s    |
| - sky /     |   | - inspectCard |               |   pink noise) |
|   plates    |   | - archive     |               +---------------+
| - foliage / |   | - hudControls |
|   petals    |   +---------------+
| - hero /    |
|   landmarks |   +---------------+
| - wind.glsl |<--| src/assets/   |
| - placehold |   | manifest.ts   |
+-------------+   +---------------+
```

If WebGL initialization fails or `webglcontextlost` fires without restoration, `main.ts` bypasses the canvas loop and enters `FALLBACK_ARCHIVE` directly using the same validated `nodes.json` data.

### 2. Spatial Layout Contract (`src/scene/layout.ts`) & Framing Math

All scene coordinates, parallax plate dimensions, camera bounds, and landmark positions derive from one metric contract in `src/scene/layout.ts` so owner art and code share identical proportions:

*   **World Metrics:** `SAFE_ASPECT = 4 / 3`, `SAFE_WIDTH = 16` world units at `z = 0`, `RIDGE_LENGTH = 48` (`x in [-24, +24]`, normalized parameter `t in [0, 1]`), `walkSpeed = 4.8` units/s (~10 seconds full ridge crossing), and `baseFov = 38` degrees.
*   **Curved Hilltop Spline (`sampleRidge(t)`):** Maps `t in [0, 1]` to `{ x, y, z }`, sloping gently downward from right to left across the lower third of the frame with minimal Z curvature (`|z| <= 0.4`) so the hero stays visually locked to the hill crest without perspective sprite-scale drift. Velocity applies soft cubic deceleration inside the outer 5% cliff endpoint zones (`t < 0.05` and `t > 0.95`).
*   **Landmark Mapping (`nodes.json` stays coordinate-free):** `layout.ts` owns all spline positions and fixes `interactRadius` at `1.8` to `2.2` world units: `about` (`Lily cluster`) sits slightly left of spawn (`t = 0.43`, ~3.36 world units from `t = 0.50`, outside `interactRadius` while still visible on load) so the centered spawn pose stays free of any `[E]` cue. `works` (`Weathered stone/lantern`), `interests` (`Cliffside overlook`), and `contact` (`Signpost/wind chime`) space naturally across the left and right wings of the ridge.
*   **Plate Sizing & Overdraw Formula:** Each parallax plate at depth `z_p` and parallax factor `p` uses `minPlateWidth(z_p, p) = frustumWidthAtZ(z_p, 21 / 9) + maxCameraPan * (1 - p)`, plus vertical portrait overdraw (`>= 1.6x` base height) and a fixed normalized `horizonY` anchor shared with placeholder generators.
*   **Responsive Framing (`100vw x 100dvh`):** On widescreen (`aspect >= 4 / 3`), Hor+ scaling keeps vertical FOV fixed at `baseFov` and expands horizontal meadow/sky naturally. On portrait mobile (`aspect < 1.0`), camera Z pulls back within a clamped multiplier (`1.0..1.45`) paired with a slight upward camera target offset so the 64px sprite remains legible above the dialogue box while walking reveals the left citadel and right watchtower.

### 3. Zero-Post-Processing Rendering Pipeline, Shaders & Alpha Contracts

*   **Direct Backbuffer Rendering:** Uses `new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })` with DPR capped (`<= 2.0` desktop, `<= 1.5` mobile), `SRGBColorSpace`, and `NoToneMapping`. No `EffectComposer`, runtime bloom, or runtime tilt-shift passes exist in v1.
*   **Foliage `alphaToCoverage` Contract:** Three.js's built-in `alphatest_fragment.glsl.js` wraps `#ifdef ALPHA_TO_COVERAGE` inside `#ifdef USE_ALPHATEST`. Therefore, `InstancedMesh` lily leaf and bell materials (`MeshBasicMaterial` + `onBeforeCompile`) must set `alphaToCoverage: true`, `transparent: false`, and `alphaTest: 0.3` whenever `renderer.getContextAttributes()?.antialias` is true (preserving smooth multisampled cutout edges), falling back cleanly to `alphaToCoverage: false` and `alphaTest: 0.5` if hardware MSAA is unavailable. Every `onBeforeCompile` material implements `customProgramCacheKey()` (`'lily-wind'`, `'plate-fog-mix'`, `'cloud-drift'`) so Three.js caches patched shader programs separately.
*   **Pixel-Art Hero Sprite (`z = 0`):** 64x64 frame cells (4 to 6 idle wind frames, 6 to 8 walk frames, 2px transparent UV gutters, bottom-center foot pivot), `NearestFilter` mag/min, `generateMipmaps: false`, `alphaTest: 0.5`, and `side: THREE.DoubleSide` on the hero `MeshBasicMaterial`. Walking right (`+X`) mirrors the sprite horizontally via `mesh.scale.x = -1` (no duplicate right-facing spritesheet rows required, and `DoubleSide` prevents winding-order culling when X scale is negative).
*   **Split Unified Wind (`src/scene/shaders/wind.glsl.ts`):** One shared `uTime` and Simplex gust envelope drives two distinct GLSL functions:
    *   `windSway`: Zero-centered oscillation anchored at leaf/stem base (`vUv.y = 0`) for `InstancedMesh` lily cards.
    *   `windDrift`: Strictly monotonic negative-X drift scrolling UVs on horizontally tileable `clouds.webp` (`RepeatWrapping`) and driving right-to-left translation plus 3D tumbling pitch/yaw/roll on a single 150-to-250-quad `InstancedMesh` petal batch (no `THREE.Points`).
*   **Back-to-Front Layer Stack & Haze Cohesion:**
    1.  **Sky Dome (`z = -120`, `fog: false`):** GLSL overcast pearl-ivory-beige gradient with a pre-softened horizon.
    2.  **Architectural & Cloud Plates (`z = -25` to `-60`):** `citadel.webp`, `ghost-castle.webp`, `watchtower.webp`, and `clouds.webp` (`.png` accepted for local testing) with `fog: false` or a tuned light `uFogMix` (`0.0..0.3`) via `onBeforeCompile` to prevent double-fogging pre-graded art.
    3.  **Foreground Hill & Lilies (`z = -5` to `+8`):** Curved hill mesh, `InstancedMesh` lily cards, `InstancedMesh` petal quads, and `THREE.FogExp2`.
    4.  **Hero & 4 Landmarks (`z = 0`):** Crisp 64px sprite plus landmark cutout planes highlighted by soft warm-ivory additive glow quads (`AdditiveBlending`, `depthWrite: false`).
    5.  **Foreground Flower Lip (`z > 0`):** Pre-softened `foreground-lip.webp` plate in front of the hero's knees for knee-deep occlusion and soft bottom framing.
    6.  **Viewport Vignette:** CSS `radial-gradient` overlay (`pointer-events: none`).

### 4. State Machine, Camera Rig & Unified Input Router (`src/state/`, `src/input/`)

```text
  [pointer outside HUD] --> wakes audio (no walkTarget) ---+
                                                           v
+------------+   A/D/Arrows (audio UNSTARTED)       +-------------+
| TITLE_IDLE |------------------------------------->|  EXPLORING  |
+------------+                                      +--+--+---+---+
                                                       ^  |   |
       close / Esc                                     |  |   | [E]/Space or
   +---------------------------------------------------+  |   | landmark arrive
   |                                                      |   v
+--+--------------+   [Archive] btn   +-------------------+----------+
| ARCHIVE_DRAWER  |<------------------| DIALOGUE  <--> WORKS_PICKER  |
+-----------------+                   +------------------------------+
                                                ^            |
  WebGL init fail / contextlost                 | Esc/Close  | [Inspect]
        --> FALLBACK_ARCHIVE                    +--- INSPECT_CARD
```

*   **Camera Rig (`src/scene/camera.ts`):** Uses an Itay Keren horizontal deadzone window with critically damped spring follow. Initial look-ahead starts at `0` at `t = 0.50` so the spawn frame matches the centered reference composition. Subtle idle parallax responds to mouse movement only when `(hover: hover)` matches and `prefers-reduced-motion` is off.
*   **Unified Pointer + Keyboard Guards (`src/input/inputRouter.ts`):**
    *   First `"Click anywhere to begin"` pointer/tap in `TITLE_IDLE` outside `Mute`/`Archive` unlocks Web Audio (starting the 2s fade-in) and enters `EXPLORING` **without setting a walk target**.
    *   Pressing `A`/`D` or Left/Right Arrow in `TITLE_IDLE` enters `EXPLORING` immediately without blocking movement, leaving audio in `UNSTARTED` (indicated visually on the corner sound toggle) until a pointer gesture unlocks Web Audio.
    *   **Refocus & Drag Guards:** Ignore canvas clicks occurring within `150ms` of a `window` `focus` event, and ignore `pointerup` events whose pointer travel exceeded `8px`.
    *   **Keyboard Override:** Any `A`/`D`/Arrow press immediately cancels an active click/tap `walkTarget` and `pendingInteractId`.
    *   **Hit Priority:** On valid canvas tap/click in `EXPLORING`, raycast landmark hit spheres first; if hit outside range, set `walkTarget` + `pendingInteractId` and auto-open dialogue on arrival. Otherwise project pointer X onto the `z = 0` ridge plane to set `walkTarget`.
    *   DOM overlays call `stopPropagation` on pointer events and gate scene keyboard bindings whenever `appState` is in `DIALOGUE`, `WORKS_PICKER`, `INSPECT_CARD`, `ARCHIVE_DRAWER`, or `FALLBACK_ARCHIVE`.

### 5. Asset Manifest (`src/assets/manifest.ts`), Content Schema (`src/content/nodes.json`) & DOM UI (`src/ui/`)

```ts
interface AssetManifest {
  sprite: { path: string; frameW: 64; frameH: 64; gutterPx: 2; idleFrames: number; walkFrames: number; footPivotY: number };
  foliage: { leavesPath: string; bellsPath: string; leafCells: number; bellCells: number };
  plates: Record<'citadel' | 'ghostCastle' | 'watchtower' | 'clouds' | 'foregroundLip', {
    path: string; z: number; parallax: number; horizonY: number; fogMix: number; tileX: boolean;
    offsetX: number; offsetY: number; worldWidth: number; worldHeight: number;
  }>;
  audio: { primary: string; fallbackOgg?: string };
}

interface NodesDocument {
  schemaVersion: 1;
  audioCredit?: string;
  nodes: Array<{
    landmarkKey: 'about' | 'works' | 'interests' | 'contact';
    title: string;
    lines: string[];
    works?: Array<{ id: string; title: string; reflection: string[]; inspect: { image?: string; note: string; url: string; linkLabel: string } }>;
    links?: Array<{ label: string; url: string }>;
  }>;
}
```

*   WebP with alpha is the primary plate format in `manifest.ts` (no dual PNG fallback is required because WebGL2 browsers natively support WebP; `.png` paths remain accepted during local art testing). Explicit crop and placement fields (`offsetX`, `offsetY`, `worldWidth`, `worldHeight`) let `citadel`, `ghostCastle`, and `watchtower` ship tightly cropped around their painted silhouettes while only `clouds` (`tileX: true`) and `foregroundLip` span the full width.
*   Runtime validation enforces required fields and restricts outbound URLs to `https:` or `mailto:`. When files in `public/assets/` are missing, `placeholders.ts` renders canvas textures using exact pixel/aspect dimensions from `layout.ts` and `manifest.ts` with clear coordinate labels.
*   DOM UI stays plain TypeScript + CSS (`1px` crisp borders, dark slate/parchment JRPG surface, zero glassmorphism):
    *   `dialogueBox.ts`: Typewriter output (`aria-live="polite"`), first press completes the sentence, second advances.
    *   `worksPicker.ts`: Vertical choice list (2 to 3 titles with cursor arrow, navigable via `W`/`S`, Up/Down, click, or tap).
    *   `inspectCard.ts`: Plain dismissible card displaying one thumbnail/note and external link (`Esc` restores focus to dialogue).
    *   `archiveDrawer.ts` + `hudControls.ts`: Semantic `<dialog>` drawer rendering all `nodes.json` entries and links, plus corner `Index/Archive` and `Mute` toggles distinguishing `UNSTARTED`, `PLAYING`, and `MUTED`.

### 6. Web Audio Engine (`src/audio/audioEngine.ts`), Reduced Motion & Failure Observability

*   **Web Audio Graph:** Pointer gestures outside `Mute` synchronously create/resume `AudioContext`. BGM (`theme.mp3` / `.m4a` primary, optional `.ogg` via `canPlayType`) decodes via `decodeAudioData` into a looping `AudioBufferSourceNode` routed to `bgmGain` (2s exponential/linear ramp on wake), preventing iOS Safari `<audio>` hardware volume locks and MP3 loop-boundary clicks. A pre-baked 4s Paul Kellet pink-noise `AudioBuffer` loops through a wind-modulated lowpass `BiquadFilterNode` on `windGain`. Both feed `masterMuteGain`. `visibilitychange` suspends/resumes cleanly.
*   **Reduced Motion (`prefers-reduced-motion: reduce`):** Halts or minimizes `windSway`, `windDrift`, petal tumble, idle mouse parallax, and camera spring overshoot, and displays JRPG dialogue lines immediately with zero typewriter delay.
*   **Observability & Fallbacks:** Records startup, asset load, WebGL capability, and audio state events into `window.__HD2D_DIAG__` (inspectable via `?debug=1` HUD without cluttering normal play) and switches automatically to `FALLBACK_ARCHIVE` on WebGL failure or `webglcontextlost`.

## Alternatives Considered

### Alternative 1: `EffectComposer` + Runtime `UnrealBloomPass` + Sprite-Masked Tilt-Shift

*   **Pros:** Adds screen-space glow bleed across bright highlights and shader-controlled top/bottom edge blur.
*   **Cons:** Three.js `EffectComposer` creates internal `HalfFloatType` render targets with `samples: 0` by default, silently disabling `alphaToCoverage` on `InstancedMesh` foliage. Forcing `samples: 4` on dual `HalfFloatType` buffers plus 10+ bloom mip passes and tilt-shift threatens the 60 FPS integrated GPU and mobile budget, while screen-space tilt-shift sprite masking collides with foreground flower lip occlusion.
*   **Reason for Rejection:** Rejected by author: for v1, rendering straight to the native MSAA backbuffer keeps `alphaToCoverage` working with zero offscreen render-target cost, while additive landmark glow planes, a CSS vignette, and pre-softened sky/foreground-lip plates replace runtime bloom and tilt-shift.

### Alternative 2: `THREE.Points` for Tumbling Petals

*   **Pros:** Simple vertex-only point sprite submission with minimal geometry setup.
*   **Cons:** Hardware `gl_PointSize` caps restrict large near-camera foreground petals on mobile/ANGLE drivers, and rotating UV coordinates inside fixed point sprites clips petal corners at square boundaries.
*   **Reason for Rejection:** Rejected by author: a single 150-to-250-quad `InstancedMesh` batch keeps all petals in one draw call while allowing full 3D pitch, yaw, and roll tumbling at any scale.

### Alternative 3: Forced Simultaneous Flanking-Landmark Framing on Portrait Mobile

*   **Pros:** Shows both the far-left citadel and right-side watchtower in the initial static portrait frame.
*   **Cons:** Fitting a 4:3 landmark span into a 9:16 screen above the dialogue box forces a deep camera pullback that shrinks the 64px hero sprite to roughly one-third height, collapses the 3x ridge walk, thickens foreground `FogExp2`, and exposes vertical plate edges.
*   **Reason for Rejection:** Rejected by author: moderate portrait pullback keeps the 64px hero legible while ridge walking reveals the left citadel and right watchtower.

### Alternative 4: PixiJS / Pure 2D Static Painted Foreground

*   **Pros:** Lower mobile battery drain, smaller bundle size, and direct fidelity to a static painted PS1 foreground layer.
*   **Cons:** Cannot provide real 3D swaying `InstancedMesh` lily-of-the-valley foliage or true Z-axis perspective parallax and exponential distance fog.
*   **Reason for Rejection:** Rejected by author: swaying 3D lily foliage and depth perspective are wanted over a static painted foreground layer.

### Alternative 5: Full-Screen Low-Resolution Pixelation Pass

*   **Pros:** Forces hero sprite, 3D foliage, and plates onto one uniform pixel grid.
*   **Cons:** Downsampling and nearest-upscaling thin, swaying lily stems in motion produces distracting sub-pixel shimmering across the foreground hill.
*   **Reason for Rejection:** Rejected by author: mixed HD-2D density keeps the 64px sprite crisp via `NearestFilter` while rendering 3D foliage cleanly at native resolution.

### Alternative 6: Bokeh Depth of Field (DOF)

*   **Pros:** Softens midground/foreground transitions smoothly by camera depth.
*   **Cons:** Multi-tap bokeh shaders consume excessive mobile GPU and battery budgets and bleed blur halos across the crisp pixel edges of the hero sprite.
*   **Reason for Rejection:** Rejected by author: too costly for mobile and degrades sprite edge crispness.

### Alternative 7: Open 3D Free-Roam Movement

*   **Pros:** Allows exploring depth across the meadow floor freely.
*   **Cons:** Walking freely in Z lets visitors approach scene boundaries and exposes flat 2D parallax backdrop plates from oblique angles.
*   **Reason for Rejection:** Rejected by author: 1D curved hilltop spline walking protects the painterly composition in every frame.

### Alternative 8: Mobile Virtual On-Screen Joystick

*   **Pros:** Explicit thumb-control affordance familiar to action mobile games.
*   **Cons:** Clutters the quiet overcast hilltop composition with persistent arcade HUD elements.
*   **Reason for Rejection:** Rejected by author: tap-to-walk on the ridge and tap-landmark keep the frame clean.

### Alternative 9: Pillarboxed 4:3 Viewport on Widescreen

*   **Pros:** Locks composition strictly to the original 4:3 framing without plate overdraw.
*   **Cons:** Black sidebars on 16:9 and 21:9 monitors make a personal portfolio feel like an embedded emulator rather than an atmospheric full-screen world.
*   **Reason for Rejection:** Rejected by author: full `100vw x 100dvh` Hor+ scaling with a central 4:3 safe area preserves composition without letterboxing.

### Alternative 10: React Three Fiber (R3F)

*   **Pros:** Declarative component bindings for Three.js objects and React UI state.
*   **Cons:** Pulls in React, ReactDOM, and the R3F reconciler overhead for a single static-mesh scene, four landmarks, and one minimal JRPG DOM overlay.
*   **Reason for Rejection:** Rejected by author: violates the minimal-dependency rule; plain TypeScript DOM controllers and Three.js keep bundle size and complexity minimal.

### Alternative 11: Copyrighted *Valkyrie Profile* Soundtrack

*   **Pros:** Exact nostalgic match to the reference clip's orchestral score.
*   **Cons:** Hosting copyrighted commercial game audio on a public portfolio creates direct legal risk.
*   **Reason for Rejection:** Rejected by author: only `CC0`, `CC-BY`, commissioned, or original orchestral tracks may ship.

### Alternative 12: Draft-Phase Interaction and Sprite Choices

*   **Sequential forced dialogue pages for Selected Works:**
    *   *Pros:* Reuses a single linear dialogue controller for every landmark.
    *   *Cons:* Forces visitors to page linearly through multiple projects when they want to pick a specific piece.
    *   *Reason for Rejection:** Rejected by author: replaced with a vertical JRPG choice list of 2 to 3 project titles navigable via `W`/`S`, arrows, click, or tap, leading to a plain `[Inspect]` card.
*   **Blocking splash overlay for audio unlock:**
    *   *Pros:* Guarantees audio unlocks before any scene movement begins.
    *   *Cons:* Obstructs the opening *Valkyrie Profile* title-card composition with an artificial gate.
    *   *Reason for Rejection:** Rejected by author: replaced with an unobstructed lower-frame whisper cue (`"Click anywhere to begin"`) that unlocks audio on first pointer gesture without blocking immediate `A`/`D` walking.
*   **Keyboard-only desktop exploration:**
    *   *Pros:* Prevents stray clicks on desktop from disturbing the centered reference composition.
    *   *Cons:* Mouse-first desktop visitors who click a glowing landmark or ridge expect movement and receive no response.
    *   *Reason for Rejection:** Rejected by author: unified desktop click-to-walk and click-landmark with mobile touch using a `150ms` refocus guard, `8px` drag guard, and zero-walk wake guard.
*   **Dedicated right-facing spritesheet rows:**
    *   *Pros:* Preserves asymmetric hair parting and directional shading when facing right.
    *   *Cons:* Doubles pixel-art frame production for the owner (`16` to `28` frames instead of `10` to `14`).
    *   *Reason for Rejection:** Rejected by author: classic PS1/PSP horizontal mirroring via `scale.x = -1` with `side: THREE.DoubleSide` halves spritesheet art workload under diffused overcast lighting.

--------------------------------------------------------------------------------

## Non-Functional Requirements

*   **Performance & Asset Weight:** Target 60 FPS on integrated GPUs and steady mobile frame pacing via direct native MSAA rendering, DPR caps (`<= 2.0` desktop, `<= 1.5` mobile), and single-draw-call `InstancedMesh` batches for lilies and 150-to-250 petal quads. Use WebP with alpha as the primary plate format (no dual PNG fallback needed; `.png` accepted for local art testing), with tight silhouette cropping via `manifest.ts` placement offsets (`offsetX`, `offsetY`, `worldWidth`, `worldHeight`) for `citadel`, `ghostCastle`, and `watchtower` (targeting `< 2.5 MB` combined payload across all 5 plates) and a compact looping BGM track (`45` to `90` seconds, `<= 15 MB` decoded PCM memory).
*   **Accessibility & Resilience:** Enforce WCAG AA contrast (`>= 4.5:1`) across the JRPG dialogue box, works picker, `[Inspect]` card, and `Index/Archive` drawer. Maintain logical `Tab` navigation, visible focus rings, `Esc` dismissal restoring prior focus, `prefers-reduced-motion: reduce` calming (halted/minimized wind, drift, parallax, spring overshoot, and instant dialogue text), and automatic fallback to the semantic HTML `Index/Archive` on WebGL initialization failure or `webglcontextlost`.
*   **Security & Privacy:** Include zero third-party analytics, tracking scripts, or cookies. Validate `src/content/nodes.json` at load time, allow only `https:` and `mailto:` outbound URL schemes, and populate all DOM text with `textContent` and safe element builders (zero untrusted `innerHTML`).

--------------------------------------------------------------------------------

### Additional Resources

*   [AGENTS.md](../../AGENTS.md): Project identity, rendering contracts, palette lock, and workflow rules.
*   [BRAIN.md](../../BRAIN.md): Active working memory, asset tracking, and reordered 4-slice roadmap.
*   [llms.txt](../../llms.txt): Repository layout and reading map.
*   `concepts_brief.md` (conversation brainstorm artifact): Finalized Goldfish brainstorm synthesis and decision record.

### Future Improvements

*   **Desktop-Only Post-Processing Evaluation:** Re-evaluate adding an optional HDR-gated `EffectComposer` bloom pass strictly on desktop GPUs after final painted owner plates are integrated, if screenshot inspection reveals a visual gap.
*   **Automated Plate Cropping & WebP Pipeline:** Add an optional build-time or asset-prep script to crop transparent margins, compute manifest offsets, and export WebP plate assets automatically.

--------------------------------------------------------------------------------

## Detailed Implementation Plan

### Target Files to Create/Modify

#### 1. `package.json` (`Create`, `[Slice 1]`)

*   **Type / Scope**: Build configuration.
*   **Proposed Changes**: Declares `three` as the sole runtime dependency and `vite`, `typescript`, `@types/three`, `eslint`, `@eslint/js`, `typescript-eslint`, and `vitest` as devDependencies, with `dev`, `build`, `lint`, and `test` scripts. Enforces the minimal-dependency architecture without React or `EffectComposer`.

#### 2. `tsconfig.json` (`Create`, `[Slice 1]`)

*   **Type / Scope**: TypeScript compiler configuration.
*   **Proposed Changes**: Enables `strict: true`, `noUncheckedIndexedAccess: true`, `moduleResolution: "bundler"`, and `target: "ES2022"` so schema boundaries and scene math stay type-safe across slices.

#### 3. `vite.config.ts` (`Create`, `[Slice 1]`)

*   **Type / Scope**: Bundler and test runner configuration.
*   **Proposed Changes**: Configures `base: './'` for static hosting portability and sets `test: { environment: 'node' }` for Vitest unit tests on pure logic modules.

#### 4. `eslint.config.js` (`Create`, `[Slice 1]`)

*   **Type / Scope**: Static analysis and lint rules.
*   **Proposed Changes**: Configures flat TypeScript ESLint rules for type discipline, import hygiene, and unused-variable checks so the `ESLint` MCP runs from Slice 1 onward.

#### 5. `index.html` (`Create`, `[Slice 1]`)

*   **Type / Scope**: Root HTML document.
*   **Proposed Changes**: Hosts the full-viewport (`100vw x 100dvh`) `<canvas id="scene-canvas">`, CSS vignette layer, semantic DOM containers for JRPG UI overlays and the `Index/Archive` `<dialog>`, plus a `<noscript>` fallback notice.

#### 6. `src/scene/layout.ts` (`Create`, `[Slice 1]`)

*   **Type / Scope**: Spatial world-metric contract module.
*   **Proposed Changes**: Exports `SAFE_ASPECT = 4 / 3`, `SAFE_WIDTH = 16`, `RIDGE_LENGTH = 48`, `walkSpeed = 4.8`, `interactRadius = 2.0`, `baseFov = 38`, `LANDMARK_T` (`about: 0.43` outside spawn `0.50` range, plus `works`, `interests`, `contact`), `sampleRidge(t)`, `computeEndpointDamping(t)` (outer 5% soft deceleration), `minPlateWidth(z, parallax)`, and `computeCameraFraming(aspect)` (Hor+ desktop and clamped `1.0..1.45` portrait pullback + dialogue vertical offset). Ensures owner art, camera, and spline code share one metric source.

#### 7. `src/assets/manifest.ts` (`Create`, `[Slice 1]`)

*   **Type / Scope**: Typed asset manifest.
*   **Proposed Changes**: Defines hero 64x64 sprite metadata (`gutterPx: 2`, idle/walk frame counts, `footPivotY`), lily leaf/bell atlas grids, the 5 parallax plates (`citadel`, `ghostCastle`, `watchtower` tightly cropped via `offsetX`, `offsetY`, `worldWidth`, `worldHeight`; full-width `clouds` with `tileX: true`; full-width pre-softened `foregroundLip`) using `.webp` primary (allowing `.png` locally), and audio paths (`.mp3`/`.m4a` primary, optional `.ogg`).

#### 8. `src/scene/placeholders.ts` (`Create`, `[Slice 1]`)

*   **Type / Scope**: Procedural calibration texture generator.
*   **Proposed Changes**: Reads `layout.ts` and `manifest.ts` to paint palette-matched, exact-ratio labeled canvas textures (64px hero grid, 5 parallax plates with crop/safe-area rulers, lily atlases, and landmark cutouts) whenever files in `public/assets/` are absent.

#### 9. `src/state/appState.ts` (`Create`, `[Slice 1]`, expanded `[Slice 3]`)

*   **Type / Scope**: Centralized application state machine.
*   **Proposed Changes**: Manages modes (`TITLE_IDLE`, `EXPLORING`, `DIALOGUE`, `WORKS_PICKER`, `INSPECT_CARD`, `ARCHIVE_DRAWER`, `FALLBACK_ARCHIVE`), `AudioStatus` (`UNSTARTED`, `PLAYING`, `MUTED`), hero `t`, `walkTarget`, `pendingInteractId`, active landmark/work IDs, and reactive `prefers-reduced-motion` state subscriptions.

#### 10. `src/input/inputRouter.ts` (`Create`, `[Slice 1]`, expanded `[Slice 3]`)

*   **Type / Scope**: Unified pointer and keyboard input controller.
*   **Proposed Changes**: Enforces zero-walk first wake clicks in `TITLE_IDLE`; immediate non-blocking `A`/`D`/Arrow transitions to `EXPLORING` leaving audio `UNSTARTED`; `150ms` window-refocus guard; `8px` pointer drag guard; immediate keyboard cancel of active click/tap walk targets; landmark hit-sphere priority ahead of `z = 0` spline X-projection; and DOM overlay propagation/focus isolation.

#### 11. `src/scene/renderer.ts` (`Create`, `[Slice 1]`)

*   **Type / Scope**: WebGL renderer and failure-guard module.
*   **Proposed Changes**: Creates `WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })` with bounded DPR (`<= 2.0` desktop, `<= 1.5` mobile), `SRGBColorSpace`, and `NoToneMapping`; attaches `webglcontextlost` and init guards that trigger `FALLBACK_ARCHIVE`; records events in `window.__HD2D_DIAG__`; and serves optional `?debug=1` runtime readouts.

#### 12. `src/scene/camera.ts` (`Create`, `[Slice 1]`)

*   **Type / Scope**: Camera rig controller.
*   **Proposed Changes**: Implements the Itay Keren horizontal deadzone spring camera (zero initial look-ahead at `t = 0.50`, critically damped follow, `prefers-reduced-motion` overshoot bypass), responsive Hor+ and moderate portrait pullback framing from `layout.ts`, and idle desktop `(hover: hover)` mouse-look parallax.

#### 13. `src/scene/hero.ts` (`Create`, `[Slice 1]`)

*   **Type / Scope**: Hero pixel-art sprite controller.
*   **Proposed Changes**: Renders the 64px sprite plane with `NearestFilter`, `generateMipmaps = false`, `alphaTest = 0.5`, and `side: THREE.DoubleSide`; mirrors horizontally (`scale.x = -1`) on `+X` walk; locks bottom-center foot pivot to `sampleRidge(t)`; and steps UV frames respecting 2px transparent gutters.

#### 14. `src/scene/plates.ts` (`Create`, `[Slice 1]`, wind UV hook `[Slice 2]`)

*   **Type / Scope**: Parallax backdrop and foreground-lip layer builder.
*   **Proposed Changes**: Places all 5 parallax plates from `manifest.ts` (`offsetX`, `offsetY`, `worldWidth`, `worldHeight`), applying `fog: false` or tuned `uFogMix` (`onBeforeCompile` + `customProgramCacheKey('plate-fog-mix')`), `RepeatWrapping` plus monotonic `windDrift` UV scroll on `clouds` (`customProgramCacheKey('cloud-drift')`), and knee-deep front ordering for `foregroundLip`. Exposes a lightweight `horizonY` guideline and cropped-plate wireframe bounding-box toggle under `?debug=1` so re-crop realignment is immediate.

#### 15. `src/scene/shaders/wind.glsl.ts` (`Create`, `[Slice 2]`)

*   **Type / Scope**: Shared GLSL wind module.
*   **Proposed Changes**: Provides one shared `uTime`, `uWindStrength`, and Simplex gust system exporting oscillating `windSway` (for foliage) and monotonic negative-X `windDrift` (for clouds and petals).

#### 16. `src/scene/sky.ts` (`Create`, `[Slice 2]`)

*   **Type / Scope**: Atmospheric sky dome shader.
*   **Proposed Changes**: Renders the overcast pearl-ivory-beige sky gradient plane/dome at `z = -120` with `fog: false` and a pre-softened upper horizon.

#### 17. `src/scene/foliage.ts` (`Create`, `[Slice 2]`)

*   **Type / Scope**: Curved meadow terrain and `InstancedMesh` lily field.
*   **Proposed Changes**: Builds the curved hill mesh and instanced lily leaf/bell cards using `MeshBasicMaterial` + `onBeforeCompile` (`customProgramCacheKey('lily-wind')`), enabling `alphaToCoverage: true`, `transparent: false`, and `alphaTest: 0.3` when MSAA is active (falling back to `alphaToCoverage: false`, `alphaTest: 0.5` otherwise), blended with `THREE.FogExp2`.

#### 18. `src/scene/petals.ts` (`Create`, `[Slice 2]`)

*   **Type / Scope**: Tumbling petal `InstancedMesh` system.
*   **Proposed Changes**: Renders a single 150-to-250-quad `InstancedMesh` batch across multiple Z depths driven by `windDrift` with 3D tumbling pitch/yaw/roll and camera-frustum wrapping (halted or minimized under `prefers-reduced-motion`).

#### 19. `src/content/nodes.json` (`Create`, `[Slice 3]`, final copy `[Slice 4]`)

*   **Type / Scope**: Editorial narrative and portfolio data.
*   **Proposed Changes**: Stores schema-version-1 copy for the 4 landmarks (`about`, `works` with 2-3 projects + `inspect` payloads, `interests`, `contact`) and optional `audioCredit`, using explicitly labeled `[PLACEHOLDER]` copy until final owner writing arrives.

#### 20. `src/content/validateNodes.ts` (`Create`, `[Slice 3]`)

*   **Type / Scope**: Content schema and URL validator.
*   **Proposed Changes**: Validates loaded `nodes.json` structure, required landmark keys, and strict `https:`/`mailto:` URL protocol allowlisting, providing clear diagnostic errors on malformed entries.

#### 21. `src/scene/landmarks.ts` (`Create`, `[Slice 3]`)

*   **Type / Scope**: Interactive 3D landmark cutouts and proximity cues.
*   **Proposed Changes**: Places the 4 landmark planes along `layout.ts` `LANDMARK_T`, attaches soft warm-ivory additive glow quads (`AdditiveBlending`, `depthWrite: false`), builds generous raycast hit spheres, and projects screen-space coordinates for the in-range `[E]`/tap cue.

#### 22. `src/scene/sceneController.ts` (`Create`, `[Slice 1]`, expanded `[Slice 2-3]`)

*   **Type / Scope**: Three.js scene lifecycle orchestrator.
*   **Proposed Changes**: Wires renderer, camera, sky, plates, foliage, petals, hero, and landmarks; manages `resize` framing updates, clamped-delta `rAF` animation ticks, and complete GPU `.dispose()` teardown.

#### 23. `src/ui/styles.css` (`Create`, `[Slice 1]`, expanded `[Slice 3]`)

*   **Type / Scope**: UI and vignette stylesheet.
*   **Proposed Changes**: Locks `100vw x 100dvh` layout, adds the `pointer-events: none` CSS `radial-gradient` vignette, and styles the PS1/PSP JRPG dialogue box, works picker, `[Inspect]` card, and `Index/Archive` `<dialog>` with `1px` crisp borders, WCAG AA `>= 4.5:1` contrast, `44px` minimum mobile tap targets, visible focus indicators, and zero glassmorphism.

#### 24. `src/ui/hudControls.ts` (`Create`, `[Slice 1]`, expanded `[Slice 3]`)

*   **Type / Scope**: Corner HUD, whisper prompt, and diegetic cue controller.
*   **Proposed Changes**: Renders and manages the lower-frame `"Click anywhere to begin"` whisper prompt, in-range `[E]`/tap cue, corner `Index/Archive` trigger, and corner sound toggle distinguishing `UNSTARTED`, `PLAYING`, and `MUTED`.

#### 25. `src/ui/dialogueBox.ts` (`Create`, `[Slice 3]`)

*   **Type / Scope**: JRPG dialogue box controller.
*   **Proposed Changes**: Streams text into an `aria-live="polite"` bottom container via `textContent`, completing the current line on first press, advancing on second press, and displaying instantly under `prefers-reduced-motion`.

#### 26. `src/ui/worksPicker.ts` (`Create`, `[Slice 3]`)

*   **Type / Scope**: Selected Works vertical JRPG choice menu.
*   **Proposed Changes**: Lists 2 to 3 project titles with a cursor arrow inside the dialogue flow, navigable via `W`/`S`, Up/Down arrows, click, or tap before opening a project's reflection and `[Inspect]` action.

#### 27. `src/ui/inspectCard.ts` (`Create`, `[Slice 3]`)

*   **Type / Scope**: Plain Selected Works preview overlay.
*   **Proposed Changes**: Displays a single thumbnail image/note and validated outbound link inside a dismissible JRPG-bordered card, returning focus cleanly to dialogue on `Esc` or close.

#### 28. `src/ui/archiveDrawer.ts` (`Create`, `[Slice 1]` skeleton + fallback, full data `[Slice 3]`)

*   **Type / Scope**: Accessible semantic HTML `Index/Archive` drawer.
*   **Proposed Changes**: Populates a `<dialog>` view directly from validated `nodes.json` with focus trapping and `Esc` dismissal, and promotes itself into a full-page readable layout automatically in `FALLBACK_ARCHIVE`.

#### 29. `src/audio/audioEngine.ts` (`Create`, `[Slice 3]`)

*   **Type / Scope**: Web Audio BGM and pink-noise engine.
*   **Proposed Changes**: Synchronously creates/resumes `AudioContext` on first pointer gesture outside Mute; decodes `.mp3`/`.m4a` primary (optional `.ogg`) via `decodeAudioData` into a looping `AudioBufferSourceNode` on `bgmGain` with a 2s fade-in; loops a pre-baked 4s Paul Kellet pink-noise `AudioBuffer` through a wind-modulated lowpass `BiquadFilterNode` on `windGain`; routes both through `masterMuteGain`; and handles `visibilitychange` suspend/resume.

#### 30. `src/main.ts` (`Create`, `[Slice 1]`, expanded `[Slice 2-3]`)

*   **Type / Scope**: Application bootstrap entry point.
*   **Proposed Changes**: Loads and validates `nodes.json`, initializes `appState` and `archiveDrawer`, creates the WebGL renderer inside a failure guard (falling back directly to `FALLBACK_ARCHIVE` on error), and binds `sceneController`, `inputRouter`, `ui`, and `audioEngine`.

#### 31. `tests/layout.test.ts` (`Create`, `[Slice 1]`)

*   **Type / Scope**: Unit test suite for spatial layout math.
*   **Proposed Changes**: Tests `sampleRidge(t)` bounds and outer 5% endpoint damping, `minPlateWidth` >= 21:9 + pan, portrait pullback clamp (`1.0..1.45`), and `about` (`t = 0.43`) separation outside `interactRadius` from spawn (`t = 0.50`).

#### 32. `tests/appState.test.ts` (`Create`, `[Slice 1]`, expanded `[Slice 3]`)

*   **Type / Scope**: Unit test suite for state machine and input guards.
*   **Proposed Changes**: Tests `TITLE_IDLE` transitions, zero-walk wake click, `A`/`D`-first keeping audio `UNSTARTED`, `150ms` refocus guard, `8px` drag guard, keyboard canceling `walkTarget`, and `FALLBACK_ARCHIVE` failover.

#### 33. `tests/validateNodes.test.ts` (`Create`, `[Slice 3]`)

*   **Type / Scope**: Unit test suite for `nodes.json` schema validation.
*   **Proposed Changes**: Verifies valid 4-node documents pass, missing landmarks/fields fail loudly, and unsafe URL protocols (such as `javascript:`) are rejected.

#### 34. `public/assets/README.md` (`Create`, `[Slice 1]`)

*   **Type / Scope**: Owner art and audio drop-in specification.
*   **Proposed Changes**: Documents a shared master-canvas workflow (painting `citadel`, `ghostCastle`, and `watchtower` on one reference canvas with a marked `horizonY` line), the exact conversion formula mapping trimmed layer pixel bounds (`cropX`, `cropY`, `cropW`, `cropH`) onto `offsetX`, `offsetY`, `worldWidth`, and `worldHeight` in `manifest.ts`, `.webp` primary plate export rules (`.png` accepted for local testing), horizontally tileable `clouds.webp`, 64px sprite gutters/pivot, and licensed `.mp3`/`.m4a` audio rules.

#### 35. `AGENTS.md`, `BRAIN.md`, `CHANGELOG.md`, `llms.txt` (`Modify`, `[Slice 1-4]`)

*   **Type / Scope**: Project governance and working-memory docs.
*   **Proposed Changes**: Sync WebP primary plate format and crop/placement manifest metadata at Slice 1 start, update completed slice status and `[Unreleased]` entries after each slice, and build/refresh git-ignored `graphify-out/` after Slice 1.

### Verification Plan

*   **Compilation / Build:** `npm run build` (`tsc --noEmit && vite build`) exits `0` with zero TypeScript or Vite bundling errors.
*   **Unit Tests:** `npm test` (`vitest run`) passes all cases in `tests/layout.test.ts`, `tests/appState.test.ts`, and `tests/validateNodes.test.ts`.
*   **Static Analysis & Linting:** `npm run lint` (`eslint .`) and `ESLint` MCP `lint-files` pass with zero errors or warnings on all edited TypeScript files.
*   **Cross-Device & Runtime Integration Checks:**
    *   Inspect `21:9`, `16:9`, `4:3`, and `9:16` (`100dvh`) viewports: zero plate edge clipping, readable 64px sprite above dialogue reserve on portrait, and smooth 5% endpoint deceleration.
    *   Confirm `?debug=1` holds ~60 FPS on integrated GPU with native MSAA `alphaToCoverage` active on `InstancedMesh` lilies, and verify crisp `alphaTest: 0.5` fallback when MSAA is disabled.
    *   Exercise CUJs 1 to 4 end to end: zero-walk first wake click vs. `A`/`D`-first audio `UNSTARTED` corner indicator, `150ms` refocus and `8px` drag guards, JRPG `WORKS_PICKER` + plain `[Inspect]` card, WCAG AA contrast and `Tab`/`Esc` flow in `Index/Archive`, `prefers-reduced-motion: reduce`, simulated `webglcontextlost` failover to `FALLBACK_ARCHIVE`, and iOS Safari Web Audio 2s fade-in + `Mute` toggle.

--------------------------------------------------------------------------------

*Drafted with EGM*
