# AGENTS.md — Operational & Aesthetic Rules

## 1. Project Identity & Creative Target
- **Project:** Interactive 2.5D (HD-2D) Personal Portfolio.
- **Visual Reference:** The flower-covered hilltop scene from *Valkyrie Profile* combined with Square Enix HD-2D layering (2D pixel-art sprite in a shader-driven 3D meadow with depth fog and parallax).
- **Tone:** Quiet, melancholic, personal, and atmospheric.
- **Anti-Goal:** This is NOT a corporate résumé, SaaS landing page, or tech-stack showcase. Do not add skill bars, enterprise buzzwords, glassmorphism modals, or generic portfolio navbars.

## 2. Architecture & Tech Stack
- **Core:** TypeScript + Three.js (Vite). Keep external dependencies minimal.
- **Separation of Concerns:**
  - `src/scene/` handles Three.js rendering, shaders, lighting, and camera movement.
  - `src/content/nodes.json` holds all portfolio text and personal story nodes. Never hardcode narrative copy inside Three.js or UI components.
  - `public/assets/` holds hot-swappable art (`sprites/hero.png`, `backdrop/castle.png`, `backdrop/clouds.png`, `audio/theme.mp3`).
- **Z-Depth Stack:** Maintain strict 5-layer depth separation:
  1. Camera (`PerspectiveCamera`, FOV `35°–40°`) + `EffectComposer` (subtle bloom, vignette).
  2. Foreground Hill (`z = -5` to `+8`): Curved terrain + `THREE.InstancedMesh` grass and white bell-flowers.
  3. Hero & Interactive Nodes (`z = 0`): Alpha-cutout sprite plane + subtle glowing flower clusters.
  4. Midground Haze (`z = -25` to `-60`): 2D parallax cloud planes and distant castle silhouette blended with `THREE.FogExp2`.
  5. Sky Dome (`z = -120`): Custom GLSL atmospheric gradient shader.

## 3. Strict Anti-Slop Visual Rules
- **Color Palette Lock:** Use muted, overcast tones. Never use bright cartoon greens, neon cyan, or harsh purple gradients.
  - Grass Base: `#5b6e5d` (desaturated sage)
  - Flowers & Petals: `#f2efe4` (warm ivory)
  - Overcast Haze / Fog: `#c9ced6`
  - Distant Shadows / Castle: `#4a5568`
- **No Primitive-Art Slop:** Never build characters, castles, or clouds out of raw `BoxGeometry` or `SphereGeometry` primitives. Characters and distant architecture must use 2D alpha-cutout planes.
- **Pixel-Art Rendering Contract:** Every sprite texture must enforce:
  - `texture.magFilter = THREE.NearestFilter`
  - `texture.minFilter = THREE.NearestFilter`
  - `texture.generateMipmaps = false`
  - `material.alphaTest = 0.5`
- **UI Design Contract:** All text interaction uses a minimal PS1/PSP JRPG-style bottom dialogue box with typewriter text and subtle borders. Keep the screen clear of HUD clutter when idle.

## 4. Performance & Shader Standards
- **Foliage:** Always use `THREE.InstancedMesh` for grass blades and flowers (target 60 FPS on integrated GPUs). Never create individual `Mesh` objects in loops.
- **Unified Wind:** Drive grass sway, flower movement, and drifting petal particles (`THREE.Points`) from one shared wind system (`uTime` + Simplex noise gust vector).
- **Audio:** Keep BGM (`theme.mp3`, user-supplied) and subtle procedural wind ambience on separate gain nodes. Trigger audio fade-in only after the first user interaction to comply with browser autoplay policies.

## 5. Agent Workflow Rules
- **Read First:** Always read `BRAIN.md` before writing or modifying code.
- **Vertical Slices Only:** Build strictly one approved slice at a time. Do not scaffold future slices or unrequested features.
- **Clean Placeholders:** If an asset in `public/assets/` does not exist yet, render a clean, documented placeholder (e.g., a simple labeled grid sprite) instead of silently failing or generating ugly procedural art.
- **Documentation Sync:** After completing any milestone or architectural change, update `BRAIN.md` (current state) and `CHANGELOG.md` (under `[Unreleased]`).

## 6. MCP Tool Routing
Always follow the tool routing matrix, chaining protocols, and operational restrictions defined in [`.agents/rules/mcp-routing.md`](.agents/rules/mcp-routing.md).
Check live session MCP availability before calling routed servers and fall back cleanly if a server is not exposed.
Never skip `context7` for library/API specs or `sequential-thinking` before complex multi-file architecture or refactors.

## 7. Context Files
- **Recommended read order:** `llms.txt` → `AGENTS.md` → `BRAIN.md`.
- **Milestone history:** Update `CHANGELOG.md` under `[Unreleased]` after every completed milestone or architectural change.
- **RTK CLI rules:** Token-saving CLI wrapper rules installed by `rtk init --agent antigravity` live in [`.agents/rules/antigravity-rtk-rules.md`](.agents/rules/antigravity-rtk-rules.md).
