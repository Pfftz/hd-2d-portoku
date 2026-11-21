# BRAIN.md — Active Working Memory

**Last Updated:** 2026-11-21
**Current Phase:** Phase 0 — Initialization & Pre-Planning

## Today's Focus
- [x] Initialize repository context files (`AGENTS.md`, `BRAIN.md`, `CHANGELOG.md`). ✅
- Run concept brainstorming to refine the personal touch, mood, and interactive story nodes.
- Draft the detailed implementation plan before writing Slice 1 code.

## Locked Decisions
- **Style:** 2.5D / HD-2D (*Valkyrie Profile* hill mood) instead of full 3D modeling. No Blender required.
- **Content Scope:** Personal interests, creative work, and quiet reflections. No heavy enterprise/AIOps jargon.
- **Asset Strategy:** Decouple engine from final art. Use a temporary CC0 pixel-art spritesheet during development; swap in final sprite and self-sourced BGM later.

## Asset Status
- `public/assets/sprites/hero.png` — Pending (needs temporary CC0 grid spritesheet).
- `public/assets/backdrop/castle.png` — Pending.
- `public/assets/backdrop/clouds.png` — Pending.
- `public/assets/audio/theme.mp3` — Self-sourced by owner later.

## Planned Vertical Slices (Do Not Start Until Plan Is Approved)
1. **Slice 1:** Hill geometry, sky shader, `FogExp2`, instanced grass/flowers, unified wind shader, petal particles.
2. **Slice 2:** Parallax clouds, distant castle silhouette, post-processing bloom and vignette.
3. **Slice 3:** `NearestFilter` hero sprite, UV frame animation, movement controls, camera follow-lag.
4. **Slice 4:** Glowing interactive flower nodes reading from `nodes.json`, JRPG dialogue box, audio fade-in and mute toggle.

## Open Questions for Brainstorm & Planning
- Decide between vanilla Vite + Three.js vs. React Three Fiber (R3F).
- Define the exact 3–4 interactive nodes for `src/content/nodes.json`.
- Confirm movement scheme (keyboard `A/D` + click-to-walk, plus mobile touch support).
