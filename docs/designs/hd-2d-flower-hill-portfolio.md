# HD-2D Flower Hill Portfolio

*   **Author:** Pfftz
*   **Status:** Finalized
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

### Slice Checkpoints

Work proceeds strictly one vertical slice at a time. Each slice leaves the repository compilable (`npm run build`), lint-clean (`npm run lint`), and green on unit tests (`npm test`), plus a `graphify-out/` refresh at slice completion per `.agents/rules/mcp-routing.md`:

*   **Slice 1 (Layout Contract, Framing & Movement Skeleton):** Creates items `1` to `14`, `19` (`[PLACEHOLDER]` `nodes.json`), `20`, `22` (core Slice 1 composition), `23` (core viewport, vignette, corner controls, whisper prompt, archive CSS), `24` (Archive button + whisper prompt), `28`, `30` (Slice 1 bootstrap), `31`, `32` (Slice 1 state/guard tests), `33`, and `34`. Produces a runnable, camera-framed ridge walk with exact-ratio placeholder hero and 5 plates, `?debug=1` alignment overlay, and working `FALLBACK_ARCHIVE` without importing Slice 2 or Slice 3 scene modules.
*   **Slice 2 (Living Meadow & Unified Wind):** Creates items `15` to `18` and expands items `8`, `9` (`prefers-reduced-motion` scene consumers), `14` (cloud UV drift), `22` (sky, foliage, petals, `scene.fog`), and `30` (Slice 2 wind/meadow tick).
*   **Slice 3 (Narrative UI, Landmarks & Audio):** Creates items `21`, `25`, `26`, `27`, `29` and expands items `8` (landmark placeholder cutouts), `9` (dialogue/picker/inspect/audio states), `10` (landmark hit-test, `[E]`/`Space`/`Esc` bindings), `22` (landmark projection and arrival trigger), `23` (dialogue/picker/inspect styles), `24` (`[E]`/tap badge and Sound/Mute button), `30` (wires `dialogueBox`, `worksPicker`, `inspectCard`, `audioEngine`), and `32` (Slice 3 state tests).
*   **Slice 4 (Owner Art Integration & Polish):** Replaces `[PLACEHOLDER]` copy in item `19` and drops final owner assets into item `36` (`public/assets/*`), running the full verification plan across desktop and mobile.

### Target Files to Create/Modify

#### 1. `package.json` (`Create`, `[Slice 1]`)

*   **Type / Scope**: Build and package manifest.
*   **Proposed Changes**: Sets `"type": "module"`, declares `"three": "^0.170.0"` as the sole runtime dependency, and adds `"vite": "^6.0.0"`, `"typescript": "^5.7.0"`, `"@types/three": "^0.170.0"`, `"eslint": "^9.15.0"`, `"@eslint/js": "^9.15.0"`, `"typescript-eslint": "^8.15.0"`, and `"vitest": "^2.1.0"` in `devDependencies`. Defines scripts `"dev": "vite"`, `"build": "tsc --noEmit && vite build"`, `"preview": "vite preview"`, `"lint": "eslint ."`, and `"test": "vitest run"`. Excludes React, R3F, and external post-processing packages.

#### 2. `tsconfig.json` (`Create`, `[Slice 1]`)

*   **Type / Scope**: TypeScript compiler configuration.
*   **Proposed Changes**: Sets `"target": "ES2022"`, `"module": "ESNext"`, `"moduleResolution": "bundler"`, `"lib": ["ES2022", "DOM", "DOM.Iterable"]`, `"types": ["vite/client"]`, `"strict": true`, `"noUncheckedIndexedAccess": true`, `"resolveJsonModule": true`, `"isolatedModules": true`, `"noEmit": true`, and `"include": ["src", "tests", "vite.config.ts", "eslint.config.js"]`.

#### 3. `vite.config.ts` (`Create`, `[Slice 1]`)

*   **Type / Scope**: Bundler and test runner configuration.
*   **Proposed Changes**: Imports `defineConfig` from `'vitest/config'`, sets `base: './'` for static subpath hosting portability, and configures `test: { environment: 'node', include: ['tests/**/*.test.ts'] }`.

#### 4. `eslint.config.js` (`Create`, `[Slice 1]`)

*   **Type / Scope**: Flat ESLint configuration.
*   **Proposed Changes**: Uses `@eslint/js` and `typescript-eslint` recommended type-checked rules (`@typescript-eslint/no-unused-vars`, `@typescript-eslint/no-explicit-any`, `no-console: ['warn', { allow: ['warn', 'error'] }]`) with inline `languageOptions.globals` for ES2022/browser APIs (plus Node globals in `tests/**` and config files, avoiding unlisted packages) so both `npm run lint` and the `ESLint` MCP check all JS/TS files from Slice 1 onward.

#### 5. `index.html` (`Create`, `[Slice 1]`)

*   **Type / Scope**: Root HTML document.
*   **Proposed Changes**: Includes `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">`, `<div id="app-root">` hosting `<canvas id="scene-canvas">`, `<div id="vignette-overlay" aria-hidden="true">`, `<div id="hud-root">`, `<div id="dialogue-root">`, `<dialog id="archive-dialog">`, `<div id="debug-overlay" hidden>`, and a static `<noscript>` notice explaining that JavaScript is required for interactive mode.

#### 6. `src/scene/layout.ts` (`Create`, `[Slice 1]`)

*   **Type / Scope**: Spatial world-metric contract and crop-math module.
*   **Proposed Changes**: Exports uniform `UPPER_SNAKE_CASE` constants: `SAFE_ASPECT = 4 / 3`, `SAFE_WIDTH = 16`, `RIDGE_LENGTH = 48`, `WALK_SPEED = 4.8`, `INTERACT_RADIUS = 2.0`, `BASE_FOV = 38`, `BASE_CAMERA_Z = 18`, `CAMERA_NEAR = 0.5`, `CAMERA_FAR = 200`, `DEADZONE_HALF_WIDTH = 1.6`, `MAX_CAMERA_PAN = 16`, `BASE_TARGET_Y = 2.85`, `HORIZON_Y = 0.35`, `PORTRAIT_VERTICAL_OVERDRAW = 1.65`, `HERO_WORLD_WIDTH = 3.0`, `HERO_WORLD_HEIGHT = 3.0`, `MASTER_CANVAS_WIDTH = 3840`, `MASTER_CANVAS_HEIGHT = 1600`, `MASTER_PX_PER_UNIT = 40`, `MASTER_HORIZON_PX_Y = 1040`, and `LANDMARK_T = { interests: 0.14, about: 0.43, works: 0.68, contact: 0.86 }` (spacing `about` `3.36` units left of spawn `0.50`, outside `INTERACT_RADIUS = 2.0`, with minimum neighbor gap `8.64` units). Exports pure functions:
    *   `sampleRidge(t)`: Clamps `t` to `[0, 1]` and returns `{ x: (t - 0.5) * RIDGE_LENGTH, y: 0.35 * (t - 0.5) + 0.25 * Math.sin(Math.PI * t), z: -0.3 * Math.sin(Math.PI * (t - 0.5)) }` (`|z| <= 0.3`).
    *   `computeEndpointDamping(t, dir)`: Takes normalized position `t` and walk direction `dir` (`-1 | 0 | 1`). Returns `1.0` when `dir === 0` or moving inward (`(t < 0.05 && dir > 0)` or `(t > 0.95 && dir < 0)`). When moving outward inside `t < 0.05` (`u = clamp(t / 0.05, 0, 1)`) or `t > 0.95` (`u = clamp((1 - t) / 0.05, 0, 1)`), returns cubic `u * u * (3 - 2 * u)` so boundary braking never prevents walking back inward.
    *   `frustumWidthAtZ(z, aspect)`: Computes `2 * Math.tan((BASE_FOV * Math.PI) / 360) * (BASE_CAMERA_Z - z) * aspect`.
    *   `minPlateWidth(z, parallax)`: Computes `frustumWidthAtZ(z, 21 / 9) + MAX_CAMERA_PAN * (1 - parallax)`.
    *   `computeCameraFraming(aspect)`: For `aspect >= SAFE_ASPECT`: returns `{ cameraZ: BASE_CAMERA_Z, fov: BASE_FOV, targetOffsetY: BASE_TARGET_Y, pullback: 1.0, isPortrait: false }`. For `1.0 <= aspect < SAFE_ASPECT`: interpolates `pullback` linearly in `1.0..1.15` with `cameraZ = BASE_CAMERA_Z * pullback`, `targetOffsetY = BASE_TARGET_Y`, `isPortrait: false`. For `aspect < 1.0`: computes `pullback = clamp(1.15 + ((1.0 - aspect) / 0.44) * 0.3, 1.15, 1.45)`, `cameraZ = BASE_CAMERA_Z * pullback`, `targetOffsetY = BASE_TARGET_Y - (pullback - 1.0) * 1.4` (`2.22` at `9:16`, raising the ridge above the bottom dialogue reserve), `isPortrait: true`.
    *   `cropPixelsToManifest(cropX, cropY, cropW, cropH)`: Pure conversion mapping trimmed master-canvas pixel bounds to `{ offsetX: (cropX + cropW * 0.5 - 1920) / 40, offsetY: (1040 - (cropY + cropH * 0.5)) / 40, worldWidth: cropW / 40, worldHeight: cropH / 40 }`.

#### 7. `src/assets/manifest.ts` (`Create`, `[Slice 1]`)

*   **Type / Scope**: Typed asset manifest and URL resolver.
*   **Proposed Changes**: Resolves asset paths relative to `import.meta.env.BASE_URL` (supporting `base: './'`) and exports concrete defaults:
    *   `sprite`: `path: 'assets/sprites/hero.png'`, `frameW: 64`, `frameH: 64`, `gutterPx: 2` (`68px` cell stride with `2px` outer/inner transparent padding around each `64x64` frame), `idleFrames: 4` (row 0 at `6 FPS`), `walkFrames: 6` (row 1 at `10 FPS`), `footPivotY: 4`, `worldWidth: HERO_WORLD_WIDTH`, `worldHeight: HERO_WORLD_HEIGHT`.
    *   `foliage`: `leavesPath: 'assets/foliage/lily-leaves.png'`, `bellsPath: 'assets/foliage/lily-bells.png'`, `cols: 2`, `rows: 2`, `cellPx: 128`, `leafCells: 4`, `bellCells: 4`.
    *   `plates`: Five entries using `.webp` paths by default (`TextureLoader` probes `.png` override on `.webp` load failure for local testing): `citadel` (`backdrop/citadel.webp`, `z: -55`, `parallax: 0.78`, `horizonY: HORIZON_Y`, `fogMix: 0.18`, `tileX: false`, `offsetX: -23.0`, `offsetY: 3.0`, `worldWidth: 30.0`, `worldHeight: 29.0`), `ghostCastle` (`backdrop/ghost-castle.webp`, `z: -60`, `parallax: 0.85`, `horizonY: HORIZON_Y`, `fogMix: 0.25`, `tileX: false`, `offsetX: 12.0`, `offsetY: 5.0`, `worldWidth: 14.0`, `worldHeight: 16.0`), `watchtower` (`backdrop/watchtower.webp`, `z: -36`, `parallax: 0.60`, `horizonY: HORIZON_Y`, `fogMix: 0.12`, `tileX: false`, `offsetX: 19.5`, `offsetY: 6.5`, `worldWidth: 13.0`, `worldHeight: 22.0`), `clouds` (`backdrop/clouds.webp`, `z: -28`, `parallax: 0.50`, `horizonY: HORIZON_Y`, `fogMix: 0.0`, `tileX: true`, `offsetX: 0.0`, `offsetY: 1.0`, `worldWidth: 96.0`, `worldHeight: 17.0`), and `foregroundLip` (`backdrop/foreground-lip.webp`, `z: 1.8`, `parallax: 0.0`, `horizonY: HORIZON_Y`, `fogMix: 0.0`, `tileX: false`, `offsetX: 0.0`, `offsetY: -2.8`, `worldWidth: 64.0`, `worldHeight: 8.0`).
    *   `landmarks`: Record keyed by `'about' | 'works' | 'interests' | 'contact'` with `{ path: 'assets/landmarks/<key>.png', worldWidth: 1.8, worldHeight: 1.8, zOffset: -0.15, hitRadius: 1.4, glowSize: 2.4 }`.
    *   `audio`: `{ primary: 'assets/audio/theme.mp3', fallbackOgg: 'assets/audio/theme.ogg' }`.

#### 8. `src/scene/placeholders.ts` (`Create`, `[Slice 1]`, expanded `[Slice 2-3]`)

*   **Type / Scope**: Procedural calibration textures and non-blocking asset loader.
*   **Proposed Changes**: Exports `loadTextureWithPlaceholder(...)` plus synchronous canvas placeholder builders (`<= 2048px` texture caps, `SRGBColorSpace`): Slice 1 paints the `64x64` (`68px` stride) hero grid and 5 palette-matched parallax plates with `HORIZON_Y` and safe-area rulers; Slice 2 paints `256x256` (`2x2`) lily leaf/bell atlases; Slice 3 paints `128x128` landmark cutouts. Immediately attaches the placeholder texture so rendering never stalls, asynchronously tries `THREE.TextureLoader` on the primary `.webp` path (falling back once to `.png` if `.webp` fails to load), applies `NearestFilter`/`SRGBColorSpace` per contract and swaps `.map` while calling `.dispose()` on the placeholder, or retains the placeholder and logs `'placeholder'` to `window.__HD2D_DIAG__` on fetch failure.

#### 9. `src/state/appState.ts` (`Create`, `[Slice 1]`, expanded `[Slice 2-3]`)

*   **Type / Scope**: Centralized application state machine.
*   **Proposed Changes**: Defines `AppMode = 'TITLE_IDLE' | 'EXPLORING' | 'DIALOGUE' | 'WORKS_PICKER' | 'INSPECT_CARD' | 'ARCHIVE_DRAWER' | 'FALLBACK_ARCHIVE'`, `AudioStatus = 'UNSTARTED' | 'PLAYING' | 'MUTED'`, and `AppState` fields (`mode`, `previousMode`, `audioStatus`, `heroT`, `facingDir`, `walkTargetT`, `pendingInteractKey`, `activeLandmarkKey`, `dialoguePageIndex`, `dialogueRevealed`, `pickerIndex`, `activeWorkId`, `reducedMotion`, `whisperVisible`). Accepts optional injected `{ matchMedia, now }` adapters so `prefers-reduced-motion` media-query tracking and subscriber callbacks run natively in Vitest `node` tests (consumed in Slice 2/3 by wind and typewriter systems). Enforces: clicking `Mute` while `audioStatus === 'UNSTARTED'` transitions to `'MUTED'` (staying silent on subsequent wake); opening `ARCHIVE_DRAWER` stores `previousMode` (restoring it on close); and `FALLBACK_ARCHIVE` is terminal.

#### 10. `src/input/inputRouter.ts` (`Create`, `[Slice 1]`, expanded `[Slice 3]`)

*   **Type / Scope**: Unified pointer and keyboard input controller with pure guard helpers.
*   **Proposed Changes**: Exports pure DOM-free helpers `isRefocusClick(nowMs, lastFocusMs)` (`nowMs - lastFocusMs < 150`) and `isDragGesture(startX, startY, endX, endY)` (`Math.hypot(endX - startX, endY - startY) > 8`) alongside the event router:
    *   Filters non-primary pointers (`!event.isPrimary`), non-left mouse buttons (`event.pointerType === 'mouse' && event.button !== 0`), refocus clicks (`< 150ms`), and drags (`> 8px`), and tracks `activePointerId` across down/up plus clearing held movement keys on `window` `blur`.
    *   In `TITLE_IDLE`: first valid canvas pointerup outside HUD triggers `wakeAudio` and transitions to `EXPLORING` without setting `walkTargetT`; first `A`/`D`/Arrow transitions to `EXPLORING` immediately while leaving `audioStatus === 'UNSTARTED'`.
    *   In `EXPLORING`: `A`/`D`/Arrow presses immediately cancel `walkTargetT` and `pendingInteractKey`. Canvas pointerup raycasts landmark hit spheres first (setting `walkTargetT` + `pendingInteractKey` if out of range, or opening dialogue immediately if in range); otherwise intersects the `z = 0` plane (clamping ray X onto `[0, 1]` ridge bounds if the click ray points above the horizon) to set `walkTargetT`. Also unlocks audio if `audioStatus === 'UNSTARTED'` on a valid canvas click.
    *   In Slice 3: routes `E`/`Space`/`Enter` for interaction and advance, `W`/`S`/Arrows/`Enter`/`E`/`Space` inside `WORKS_PICKER`, and `Esc` dismissal for `INSPECT_CARD`, `WORKS_PICKER`, and `ARCHIVE_DRAWER` (ignored in `FALLBACK_ARCHIVE`), gating scene listeners whenever `appState.mode !== 'EXPLORING' && appState.mode !== 'TITLE_IDLE'`.

#### 11. `src/scene/renderer.ts` (`Create`, `[Slice 1]`)

*   **Type / Scope**: WebGL renderer, diagnostics buffer, and `?debug=1` HUD module.
*   **Proposed Changes**: Probes `?noMsaa=1` and `?loseContext=1` URL query params, then creates `new THREE.WebGLRenderer({ canvas, antialias: !noMsaa, powerPreference: 'high-performance' })` inside a `try/catch` guard (entering `FALLBACK_ARCHIVE` immediately on creation failure). Caps DPR via `window.matchMedia('(pointer: coarse)').matches ? Math.min(devicePixelRatio, 1.5) : Math.min(devicePixelRatio, 2.0)`, sets `SRGBColorSpace`, `NoToneMapping`, and calls `renderer.setSize(w, h, false)`. Attaches `webglcontextlost` calling `event.preventDefault()`, disposes scene resources, and enters `FALLBACK_ARCHIVE` deterministically (reproducible via `?loseContext=1` triggering `WEBGL_lose_context`). Populates typed `window.__HD2D_DIAG__` (`{ webglReady, msaaSamples, activeAlphaTest, dpr, assetSources, audioStatus, events[] }`) and displays an optional `?debug=1` diagnostic HUD (FPS, draw calls, triangles, `msaaSamples`, `activeAlphaTest`, `mode`, `heroT`, and a `[G]` / button toggle controlling `plates.ts` alignment guides).

#### 12. `src/scene/camera.ts` (`Create`, `[Slice 1]`)

*   **Type / Scope**: Damped deadzone spring camera controller.
*   **Proposed Changes**: Reads `computeCameraFraming(aspect)` from `layout.ts` (including `1.0..1.45` portrait pullback). Maintains horizontal deadzone (`DEADZONE_HALF_WIDTH = 1.6` units), look-ahead offset (`0` at spawn `t = 0.50`, ramping smoothly up to `1.2 * facingDir` only once walking begins), critically damped spring (`smoothTime = 0.18`s; snaps without overshoot when `reducedMotion === true`), and clamps camera X within `[-MAX_CAMERA_PAN * 0.5, +MAX_CAMERA_PAN * 0.5]` (`[-8, +8]`) so plates never expose edges. Applies idle desktop `(hover: hover)` mouse-look parallax (max `0.45`u X, `0.25`u Y, smoothed at `0.12`s) strictly when `mode === 'EXPLORING' || mode === 'TITLE_IDLE'` and `!reducedMotion`, easing back to `0` when dialogue or overlays open.

#### 13. `src/scene/hero.ts` (`Create`, `[Slice 1]`)

*   **Type / Scope**: Hero pixel-art sprite mesh and UV animator.
*   **Proposed Changes**: Builds and animates a `HERO_WORLD_WIDTH x HERO_WORLD_HEIGHT` (`3.0 x 3.0`u) `THREE.PlaneGeometry` mesh with `MeshBasicMaterial({ alphaTest: 0.5, side: THREE.DoubleSide })` and enforces `texture.magFilter = THREE.NearestFilter`, `texture.minFilter = THREE.NearestFilter`, `texture.generateMipmaps = false`. Mirrors horizontally via `mesh.scale.x = -1` when walking right (`+X`), translates the plane Y by `HERO_WORLD_HEIGHT * (0.5 - footPivotY / 64)` above `sampleRidge(t).y` so boots stay anchored at `z = 0`, and steps UV repeat/offset across the `68px` cell stride (`64px` frame + `2px` padding), switching between row 0 (`4` idle wind frames at `6 FPS`) when stationary and row 1 (`6` walk frames at `10 FPS`) while moving.

#### 14. `src/scene/plates.ts` (`Create`, `[Slice 1]`, cloud UV hook `[Slice 2]`)

*   **Type / Scope**: Parallax backdrop and foreground-lip layer builder.
*   **Proposed Changes**: Builds `PlaneGeometry(worldWidth, worldHeight)` meshes positioned from `manifest.ts` (`offsetX`, `offsetY`, `z`) with `mesh.position.x = plate.offsetX + cameraX * plate.parallax` (`transparent: true`, `depthWrite: false`). Plates with `fogMix === 0` (`clouds`, `foregroundLip`) set `fog: false`; `foregroundLip` sets `renderOrder = 10` for knee-deep ordering in front of `z = 0`. Architectural plates with `fogMix > 0` (`citadel`, `ghostCastle`, `watchtower`) set `fog: true`, attach one `onBeforeCompile` hook (`customProgramCacheKey: () => 'plate-fog-mix'`) overriding `#include <fog_fragment>` to `mix(gl_FragColor.rgb, fogColor, fogFactor * uFogMix)`, and keep `clouds` at `fogMix: 0` (`fog: false`, `RepeatWrapping`) with a single `onBeforeCompile` hook (`customProgramCacheKey: () => 'cloud-drift'`) shifting `vMapUv.x` inside `#include <uv_vertex>` by `uDriftOffset * 0.015`. Displays a `HORIZON_Y` guideline and cropped-plate wireframe bounding boxes under `?debug=1` (`[G]` toggle) to verify re-crop alignment.

#### 15. `src/scene/shaders/wind.glsl.ts` (`Create`, `[Slice 2]`)

*   **Type / Scope**: Shared GLSL wind module and uniform clock.
*   **Proposed Changes**: Exports GLSL snippets (`windSway`, `windDrift`) and shared TypeScript uniform manager `{ uTime, uWindStrength, uDriftOffset }` (`uWindStrength` in `0..1`, `0` under `prefers-reduced-motion`). Exports `advanceDriftOffset(prevOffset, dt, windStrength, time)` integrating strictly positive `dt * (1.0 + 0.35 * sin(time * 0.4)) * windStrength` on CPU into negative-X `uDriftOffset`, guaranteeing monotonic drift with zero reversal when gusts fall.

#### 16. `src/scene/sky.ts` (`Create`, `[Slice 2]`)

*   **Type / Scope**: Overcast atmospheric sky background plane.
*   **Proposed Changes**: Builds a `160 x 70`u `PlaneGeometry` centered at `(0, 12, -120)` with `ShaderMaterial({ fog: false, depthWrite: false })` and `renderOrder = -10` (covering `21:9` + `MAX_CAMERA_PAN` + `1.45` portrait pullback), blending vertical UV gradient stops `#ddd8cc` (upper overcast ivory-beige) to `#ebe7dc` (warm pearl mid-sky) and a `smoothstep`-blended `#c9ced6` horizon haze band.

#### 17. `src/scene/foliage.ts` (`Create`, `[Slice 2]`)

*   **Type / Scope**: Curved hilltop terrain and `InstancedMesh` lily meadow.
*   **Proposed Changes**: Builds a `56 x 16`u subdivided curved hill mesh (`#5b6e5d`, `fog: true`) tracking `sampleRidge(t)` with downward front/back skirts. Scatters `1800` lily leaf cards (`0.38 x 0.46`u) and `900` lily bell-flower cards (`0.32 x 0.44`u) using deterministic Mulberry32 PRNG (`seed = 0x56504844`). Configures `frustumCulled = false`, `side: THREE.DoubleSide`, `fog: true`, `InstancedBufferAttribute` `aCellIndex` (`0..3`) and `aPhase`, and `MeshBasicMaterial` + `onBeforeCompile` (`customProgramCacheKey: () => 'lily-wind'`) offsetting `vMapUv` in `#include <uv_vertex>` for the `2x2` atlas and displacing `#include <begin_vertex>` via `windSway(instanceMatrix[3].xyz, uv.y, aPhase, uTime, uWindStrength)`. Enables `alphaToCoverage: true, transparent: false, alphaTest: 0.3` when `renderer.getContextAttributes()?.antialias === true` (falling back to `alphaToCoverage: false, alphaTest: 0.5` when MSAA is disabled).

#### 18. `src/scene/petals.ts` (`Create`, `[Slice 2]`)

*   **Type / Scope**: Tumbling petal `InstancedMesh` batch.
*   **Proposed Changes**: Builds and updates a single `200`-quad `InstancedMesh` (`0.18 x 0.18`u warm ivory `#f2efe4`, scattered across `z in [-8, +3]`, `frustumCulled = false`, `transparent: true, opacity: 0.88, depthWrite: false, side: THREE.DoubleSide`, `fog: true`) using seeded per-instance `aSeed` (`vec4`) attributes and `onBeforeCompile` (`customProgramCacheKey: () => 'petal-drift'`) driven by `uDriftOffset`, `uTime`, `uWindStrength`, and `uCameraX` to tumble in 3D (pitch/yaw/roll) and wrap continuously across a `40 x 18`u camera-centered frustum window (`mod()` wrapping). Setting `uWindStrength = 0` under `prefers-reduced-motion` freezes petal drift and tumble in place.

#### 19. `src/content/nodes.json` (`Create`, `[Slice 1]`, final copy `[Slice 4]`)

*   **Type / Scope**: Editorial portfolio content JSON.
*   **Proposed Changes**: Static ES module JSON (`schemaVersion: 1`) holding the 4 landmarks (`about`, `works` with `2` to `3` project items and `inspect` payloads, `interests`, `contact`) and optional `audioCredit`. Populated with explicitly labeled `[PLACEHOLDER]` text in Slice 1 so `archiveDrawer.ts` and `FALLBACK_ARCHIVE` work immediately, then replaced with final owner prose in Slice 4.

#### 20. `src/content/validateNodes.ts` (`Create`, `[Slice 1]`)

*   **Type / Scope**: Content schema and URL security validator.
*   **Proposed Changes**: Exports throwing `validateNodes(input: unknown): NodesDocument`. Verifies `schemaVersion === 1`, exact presence and uniqueness of all 4 `landmarkKey` entries (`about`, `works`, `interests`, `contact`), non-empty `title` and `lines[]` strings, `works` array length `2` to `3` on the `'works'` node (each with non-empty `id`, `title`, `reflection[]`, and `inspect`), outbound `url` schemes strictly limited to `https:` or `mailto:`, and optional `inspect.image` paths strictly limited to `https:` URLs or safe `./assets/...` paths with no `..` traversal, throwing field-specific `Error` messages on violation.

#### 21. `src/scene/landmarks.ts` (`Create`, `[Slice 3]`)

*   **Type / Scope**: Interactive 3D landmark cutouts, additive glows, and `[E]` projection.
*   **Proposed Changes**: Places the 4 landmark cutout planes from `LANDMARK_T` and `manifest.ts.landmarks` (`1.8 x 1.8`u at `sampleRidge(t)` with `zOffset: -0.15`), attaches alpha-gradient warm-ivory `#f2efe4` additive glow planes (`2.4 x 2.4`u, `AdditiveBlending`, `depthWrite: false`, opacity modulated gently when in range and static under `reducedMotion`), assigns raycast hit spheres (`hitRadius: 1.4`u), and projects landmark anchor coordinates to CSS screen pixels (`ndc.z <= 1` guard) for positioning the in-range `[E]`/tap cue.

#### 22. `src/scene/sceneController.ts` (`Create`, `[Slice 1]`, expanded `[Slice 2-3]`)

*   **Type / Scope**: Three.js scene lifecycle orchestrator.
*   **Proposed Changes**: Initializes and coordinates `scene`, `camera`, `hero`, and `plates` in Slice 1; attaches `scene.fog = new THREE.FogExp2(0xc9ced6, 0.018)`, `sky`, `foliage`, and `petals` in Slice 2; and attaches `landmarks` in Slice 3. Clamps `rAF` frame deltas to `dt <= 0.05`s, integrates `heroT` movement along `sampleRidge(t)` using `WALK_SPEED * computeEndpointDamping(t, dir)`, resolves `walkTargetT` and `pendingInteractKey` arrivals, listens to `window` and `visualViewport` `resize` (`renderer.setSize(w, h, false)`), and disposes all geometries, materials, textures, and the renderer safely even after WebGL context loss.

#### 23. `src/ui/styles.css` (`Create`, `[Slice 1]`, expanded `[Slice 3]`)

*   **Type / Scope**: Layout, vignette, and JRPG UI stylesheet.
*   **Proposed Changes**: Enforces `width: 100vw; height: 100dvh; overflow: hidden; margin: 0` with `env(safe-area-inset-*)` corner padding, `touch-action: none` on `#scene-canvas`, `pointer-events: none` CSS `radial-gradient` vignette, solid `1px` JRPG borders (`#7b8898`) on opaque dark-slate surfaces (`#141820`, ivory text `#f2efe4`, WCAG AA contrast `>= 4.5:1`, zero glassmorphism), system sans/serif legible stack, `44px` minimum mobile tap targets, visible `:focus-visible` outlines, whisper prompt, `[E]`/tap cue, `168px` max bottom dialogue reserve, `WORKS_PICKER`, `[Inspect]` card, `<dialog>` `Index/Archive` + non-modal `FALLBACK_ARCHIVE` styling, `?debug=1` readout box, and `@media (prefers-reduced-motion: reduce)` animation suppression.

#### 24. `src/ui/hudControls.ts` (`Create`, `[Slice 1]`, expanded `[Slice 3]`)

*   **Type / Scope**: Corner controls, whisper cue, and diegetic `[E]` badge controller.
*   **Proposed Changes**: Mounts and updates Slice 1 elements (`#whisper-cue` `"Click anywhere to begin"` fading out on Path A wake or Path B movement start, plus corner `Index/Archive` button) and Slice 3 elements (corner `Sound / Mute` button with distinct `UNSTARTED` `"Sound: Off (Click to play)"`, `PLAYING`, and `MUTED` labels/`aria-pressed` states, and the projected `[E]`/tap cue button shown only within `INTERACT_RADIUS`). Calls `event.stopPropagation()` on all pointer events so HUD clicks never trigger canvas walking.

#### 25. `src/ui/dialogueBox.ts` (`Create`, `[Slice 3]`)

*   **Type / Scope**: JRPG bottom dialogue box controller.
*   **Proposed Changes**: Renders dialogue text inside `#dialogue-root` at `36` characters per second via `textContent` on an `aria-hidden="true"` visual span while updating an `aria-live="polite"` off-screen/semantic announcer span once per completed line (preventing screen-reader fragment stutter). Pressing `E`/`Space`/`Enter` or tapping the dialogue box (calling `stopPropagation`) finishes the line immediately on first press, advances on second press, transitions `works` landmark from `lines[]` into `WORKS_PICKER` (or returns to `WORKS_PICKER` after a work's `reflection[]`, or closes to `EXPLORING` on `about`/`interests`/`contact`), and shows lines immediately when `reducedMotion === true`.

#### 26. `src/ui/worksPicker.ts` (`Create`, `[Slice 3]`)

*   **Type / Scope**: Selected Works vertical JRPG choice menu.
*   **Proposed Changes**: Renders the `2` to `3` project titles from `nodes.json` plus a final `"Leave"` option with a cursor indicator, navigable via `W`/`S`, Up/Down arrows, pointer hover/click, or tap (`stopPropagation`). Pressing `Enter`/`E`/`Space` or clicking/tapping opens the project's `reflection[]` with an `[Inspect]` trigger button, while selecting `"Leave"` or pressing `Esc` returns cleanly to `EXPLORING`.

#### 27. `src/ui/inspectCard.ts` (`Create`, `[Slice 3]`)

*   **Type / Scope**: Plain Selected Works preview card.
*   **Proposed Changes**: Displays a single thumbnail image (omitting the image frame cleanly or showing the note alone if `inspect.image` is absent or fails to load) alongside the validated `note` (`textContent`) and outbound link (`target="_blank" rel="noopener noreferrer"`). Pressing `Esc` or activating Close returns to `WORKS_PICKER` (restoring prior focus).

#### 28. `src/ui/archiveDrawer.ts` (`Create`, `[Slice 1]`, expanded `[Slice 3]`)

*   **Type / Scope**: Semantic HTML `Index/Archive` drawer and WebGL fallback view.
*   **Proposed Changes**: Renders all validated `nodes.json` landmark titles, prose lines, Selected Works notes/links, `audioCredit`, and `prefers-reduced-motion` info into `<dialog id="archive-dialog">` using safe DOM builders (`target="_blank" rel="noopener noreferrer"` on external links). Opens via `.showModal()` in `ARCHIVE_DRAWER` (`Esc` or Close button returns to `previousMode` and restores focus to the `Index/Archive` button). Switches to a non-dismissible full-page static layout in `FALLBACK_ARCHIVE` (calling `event.preventDefault()` on `<dialog>` `cancel` events and hiding/disabling the close button so a broken WebGL canvas is never revealed).

#### 29. `src/audio/audioEngine.ts` (`Create`, `[Slice 3]`)

*   **Type / Scope**: Web Audio BGM and pink-noise wind bed engine.
*   **Proposed Changes**: Synchronously initializes/resumes `AudioContext` on the first pointer gesture outside `Mute`. Probes codec support via `audioElement.canPlayType('audio/mpeg')` / `'audio/mp4'` ahead of optional `'audio/ogg'`. Fetches and decodes BGM via `decodeAudioData` into a looping `AudioBufferSourceNode` routed to `bgmGain` (`0.45` target) using a monotonic `decodeSeq` cancellation token (discarding playback if the user clicks `Mute` mid-decode) and linear `setValueAtTime(0.0001)` -> `linearRampToValueAtTime(0.45, t + 2.0)` fade-in (never calling `exponentialRampToValueAtTime` from `0`). Loops a crossfaded 4s Paul Kellet pink-noise `AudioBuffer` through a wind-modulated lowpass `BiquadFilterNode` (`320` to `780` Hz, `Q = 0.7`, `0.11 Hz` LFO) on `windGain` (`0.08` target), feeding `masterMuteGain`. Missing BGM (404 before Slice 4) logs cleanly to `window.__HD2D_DIAG__` while still keeping the pink-noise bed running. Suspends `AudioContext` when `document.visibilityState === 'hidden'` and resumes on `'visible'` only if `appState.audioStatus === 'PLAYING'`.

#### 30. `src/main.ts` (`Create`, `[Slice 1]`, expanded `[Slice 2-3]`)

*   **Type / Scope**: Application bootstrap entry point.
*   **Proposed Changes**: Imports `nodes.json` statically, validates it with `validateNodes`, initializes `appState`, and mounts `archiveDrawer`. Slice 1 creates `renderer`, `sceneController` (hero + 5 placeholder plates), `inputRouter`, and `hudControls`, wiring WebGL initialization/context-loss failure directly to `FALLBACK_ARCHIVE`. Slice 2 connects sky, foliage, petals, and shared wind updates into `sceneController`. Slice 3 connects `landmarks`, `dialogueBox`, `worksPicker`, `inspectCard`, and `audioEngine`.

#### 31. `tests/layout.test.ts` (`Create`, `[Slice 1]`)

*   **Type / Scope**: Unit tests for spatial math and manifest invariants.
*   **Proposed Changes**: Verifies `sampleRidge(t)` X/Y/Z bounds (`|z| <= 0.3 <= 0.4`), directional `computeEndpointDamping(t, dir)` braking outward in `t < 0.05` / `t > 0.95` while returning `1.0` when walking inward from `t = 0` and `t = 1`, `minPlateWidth(z, parallax)` exceeding 21:9 frustum width plus pan, `computeCameraFraming(aspect)` across `21:9`, `4:3`, `1:1`, and `9:16` (`pullback` clamped in `1.0..1.45` and portrait `targetOffsetY < 0.9`), `cropPixelsToManifest` math, `about` (`t = 0.43`) separation outside `INTERACT_RADIUS = 2.0` from `t = 0.50`, and `manifest.ts` invariants (unique landmark keys, `horizonY` in `[0, 1]`, positive world sizes).

#### 32. `tests/appState.test.ts` (`Create`, `[Slice 1]`, expanded `[Slice 3]`)

*   **Type / Scope**: Unit tests for state machine and pure input guards in Vitest `node`.
*   **Proposed Changes**: Tests `appState.ts` using injected `{ matchMedia, now }` adapters plus pure `isRefocusClick` and `isDragGesture` helpers: `TITLE_IDLE` zero-walk first wake click, `A`/`D`-first keeping `audioStatus === 'UNSTARTED'`, `Mute` from `UNSTARTED` transitions, `150ms` refocus guard, `8px` drag guard, keyboard canceling `walkTargetT` and `pendingInteractKey`, `pendingInteractKey` auto-open on landmark arrival, `DIALOGUE <-> WORKS_PICKER <-> INSPECT_CARD` transitions, `ARCHIVE_DRAWER` `previousMode` restore, `prefers-reduced-motion` tracking, and `FALLBACK_ARCHIVE` terminal lock.

#### 33. `tests/validateNodes.test.ts` (`Create`, `[Slice 1]`)

*   **Type / Scope**: Unit tests for `nodes.json` schema validation.
*   **Proposed Changes**: Verifies valid 4-node documents pass; missing/duplicate `landmarkKey` entries, empty `lines[]`/`reflection[]`, and `works` lengths outside `2..3` throw field-specific `Error` messages; `validateNodes` rejects unsafe URL protocols (`javascript:`, `http:`, `data:`) on outbound links; and `inspect.image` accepts `https:` and safe `./assets/...` paths while rejecting `data:` and `..` path traversal.

#### 34. `public/assets/README.md` (`Create`, `[Slice 1]`)

*   **Type / Scope**: Owner art and audio drop-in specification.
*   **Proposed Changes**: Documents the `3840 x 1600` (`40 px/unit`, `HORIZON_Y` at `y = 1040 px`) master-canvas workflow for `citadel.webp`, `ghost-castle.webp`, and `watchtower.webp`, the `cropPixelsToManifest(cropX, cropY, cropW, cropH)` formula, `.webp` primary export rules (`.png` accepted for local testing), horizontally tileable `clouds.webp`, pre-softened `foreground-lip.webp`, `2x2` `128x128` `lily-leaves.png` and `lily-bells.png` atlases, `64x64` (`68px` padded stride) `hero.png` layout/pivot, `landmarks/*.png`, and licensed `.mp3`/`.m4a` (optional `.ogg`) audio constraints.

#### 35. `AGENTS.md`, `BRAIN.md`, `CHANGELOG.md`, `llms.txt` (`Modify`, `[Slice 1-4]`)

*   **Type / Scope**: Project governance and working-memory documentation.
*   **Proposed Changes**: Updates completed slice status, `Asset Status`, `llms.txt` implemented layout links, and `[Unreleased]` changelog entries after each completed slice.

#### 36. `public/assets/*` (`Create/Replace`, `[Slice 4]`)

*   **Type / Scope**: Final owner-produced art and licensed audio assets.
*   **Proposed Changes**: Places final owner assets at `public/assets/sprites/hero.png`, `public/assets/foliage/lily-leaves.png`, `public/assets/foliage/lily-bells.png`, `public/assets/backdrop/citadel.webp`, `public/assets/backdrop/ghost-castle.webp`, `public/assets/backdrop/watchtower.webp`, `public/assets/backdrop/clouds.webp`, `public/assets/backdrop/foreground-lip.webp`, `public/assets/landmarks/{about,works,interests,contact}.png`, `public/assets/audio/theme.mp3` (plus optional `theme.ogg`), and optional `public/assets/works/*.webp` thumbnails, updating `manifest.ts` crop values if owner plate crop bounds change.

### Verification Plan

*   **Compilation / Build:** Run `npm run build` (`tsc --noEmit && vite build`) after every slice and verify exit status `0` with zero TypeScript or Vite errors.
*   **Unit Tests:** Run `npm test` (`vitest run`) after every slice and verify 100% pass across `tests/layout.test.ts`, `tests/appState.test.ts`, and `tests/validateNodes.test.ts`.
*   **Static Analysis & Linting:** Run `npm run lint` (`eslint .`) and `ESLint` MCP `lint-files` across all repository JS/TS files after every slice and verify zero errors or warnings.
*   **Cross-Device & Runtime Integration Checks:**
    *   Inspect `21:9`, `16:9`, `4:3`, and `9:16` (`100dvh`) viewports: verify zero exposed plate edges across full ridge pan, `>= 44px` sprite height clear of the `168px` dialogue reserve on portrait mobile, `?debug=1` `[G]` wireframe alignment against `HORIZON_Y`, and monotonic velocity decay to `0` at cliff endpoints with immediate `1.0x` inward escape.
    *   Verify via the `?debug=1` FPS readout that the scene holds ~60 FPS on an integrated GPU with native MSAA `alphaToCoverage` (`alphaTest: 0.3`, `msaaSamples >= 2`) active on `InstancedMesh` lilies, and test `?noMsaa=1` fallback rendering clean `alphaTest: 0.5` edges.
    *   Exercise CUJs 1 to 4 end to end: zero-walk first wake click vs `A`/`D`-first audio `UNSTARTED` indicator, `150ms` refocus and `8px` drag guards, typewriter instant-finish/advance, `WORKS_PICKER` `W`/`S`/Arrows/`Enter`/`Esc` + `[Inspect]` missing-image fallback, WCAG AA contrast and `Tab`/`Esc` flow in `Index/Archive`, `prefers-reduced-motion: reduce` wind/petal freeze and instant text, `?loseContext=1` non-dismissible failover to `FALLBACK_ARCHIVE`, 404 BGM fallback keeping pink-noise wind running, and physical iOS Safari (or WebKit simulator) Web Audio 2s fade-in + `Mute` toggle.

--------------------------------------------------------------------------------

*Drafted with EGM*
