# Owner Art & Audio Drop-In Guide

Until final owner files are added under `public/assets/`, the engine renders exact-ratio labeled placeholders from `src/scene/layout.ts` and `src/assets/manifest.ts`.

## 1. Master-Canvas Workflow for Architectural Plates

Paint `citadel.webp`, `ghost-castle.webp`, and `watchtower.webp` on one shared reference canvas so scales and horizon alignment stay consistent:

*   **Master Canvas Size:** `3840 x 1600 px` (`40 px` per world unit)
*   **Horizon Line (`HORIZON_Y = 0.35`):** `y = 1040 px` from the top edge (`1600 * (1 - 0.35)`)
*   **Center Origin (`x = 0` world units):** `x = 1920 px`

After painting, trim each architectural layer tightly around its silhouette to save download weight. Measure the trimmed layer's top-left pixel coordinates and dimensions on the master canvas (`cropX`, `cropY`, `cropW`, `cropH`), then compute its `src/assets/manifest.ts` values with `cropPixelsToManifest`:

```text
worldWidth  = cropW / 40
worldHeight = cropH / 40
offsetX     = (cropX + cropW * 0.5 - 1920) / 40
offsetY     = (1040 - (cropY + cropH * 0.5)) / 40
```

Use `?debug=1` (and press `G` or click **Alignment Guides**) to inspect plate bounding boxes against the `HORIZON_Y` guideline.

## 2. Parallax Plate Specs (`.webp` Primary, `.png` Accepted Locally)

Export all backdrop plates as **WebP with alpha** (`.png` paths are probed automatically on `.webp` 404 for local testing; target `< 2.5 MB` combined across all 5 plates):

*   `public/assets/backdrop/citadel.webp` (`z: -55`, `parallax: 0.78`, `fogMix: 0.18`, `offsetX: -23.0`, `offsetY: 3.0`, `worldWidth: 30`, `worldHeight: 29`): Far-left silver-white Gothic citadel on cliffs extending past the left 4:3 edge. Tight silhouette crop.
*   `public/assets/backdrop/ghost-castle.webp` (`z: -60`, `parallax: 0.85`, `fogMix: 0.25`, `offsetX: 12.0`, `offsetY: 5.0`, `worldWidth: 14`, `worldHeight: 16`): Distant right-of-center faint spired silhouette behind clouds. Tight silhouette crop.
*   `public/assets/backdrop/watchtower.webp` (`z: -36`, `parallax: 0.60`, `fogMix: 0.12`, `offsetX: 19.5`, `offsetY: 6.5`, `worldWidth: 13`, `worldHeight: 22`): Right-midground olive-grey stone watchtower + solitary obelisk behind the cloud bank. Tight silhouette crop.
*   `public/assets/backdrop/clouds.webp` (`z: -28`, `parallax: 0.50`, `fogMix: 0.0`, `offsetY: 1.0`, `worldWidth: 96`, `worldHeight: 17`): **Horizontally tileable (`tileX: true`)** rolling creamy-white cloud bank (`96 >= minPlateWidth(-28, 0.50) = 81.92`).
*   `public/assets/backdrop/foreground-lip.webp` (`z: 1.8`, `parallax: 0.0`, `fogMix: 0.0`, `offsetY: -2.8`, `worldWidth: 64`, `worldHeight: 8`): Full-width **pre-softened** bottom lily strip rendered in front of the hero's knees (`renderOrder: 10`).

## 3. Hero Spritesheet (`public/assets/sprites/hero.png`)

*   **Frame Grid:** `64 x 64 px` artwork inside `68 x 68 px` padded cells (`2 px` transparent gutter on all four sides of each frame so `NearestFilter` never bleeds neighbor pixels).
*   **Row 0 (Idle Wind Loop):** `4` frames (`6 FPS`), facing left in three-quarter profile, body still, hair and garments rippling right.
*   **Row 1 (Walk Cycle):** `6` frames (`10 FPS`), facing left (engine mirrors via `scale.x = -1` when walking right).
*   **Foot Anchor:** `footPivotY = 4` pixels above the frame's bottom edge (`3.0 x 3.0` world units at `z = 0`).

## 4. Foliage Atlases & Landmarks

*   `public/assets/foliage/lily-leaves.png` and `public/assets/foliage/lily-bells.png`: `256 x 256 px` sheets split into a `2 x 2` grid (`128 x 128 px` per cell). Bleed edge RGB color into adjacent transparent pixels so mipmaps do not fringe.
*   `public/assets/landmarks/{about,works,interests,contact}.png`: Alpha-cutout textures sized around `1.8 x 1.8` world units (`zOffset: -0.15`).

## 5. Licensed Audio (`public/assets/audio/`)

*   `public/assets/audio/theme.mp3` (primary `.mp3`/`.m4a`, optional `theme.ogg`): Looping `45` to `90` second orchestral track (`CC0`, `CC-BY`, commissioned, or original; never copyrighted *VP* tracks). Update `audioCredit` in `src/content/nodes.json` if required by license.
