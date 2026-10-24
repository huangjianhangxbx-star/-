# TOOL-012 Viewport Display Implementation Plan

**Goal:** Deliver four display presets and depth-based cavity enhancement throughout Workshop and the offline rock viewer.

**Architecture:** Per-viewport state and transient material variants sit outside author data. A controller owns neutral lights, render-time material substitution, and an optional SSAO pipeline; original materials are restored after every frame. UI publishes only display changes, with explicit dual-view synchronization.

**Tech Stack:** Existing Three.js 0.186.1 addons, TypeScript 7.0.2, Electron 44.5.1, Playwright 1.63.0. No dependency changes.

**Spec:** `docs/tasks/TOOL-012/spec-v0.1.md`, approved for implementation by the user's current request.

## Constraints

- Baseline bf4aaed; preserve TOOL-010 paint and TOOL-011 six-face rock work.
- Display never changes asset/scene JSON, Root, history, selection, camera, source paint, UV or exports.
- Tight nonmodal viewport menu, existing dark/gold UI and gestures; no sidebar redesign.
- Whole M0–M6 scope; B-level checks; final Gate V remains user visual acceptance.
- Inline execution under existing authorization; no additional approval round or unavailable subskills.

## Task 1 — State and material contracts

Files: `desktop/viewport-display-state.ts`, `desktop/viewport-materials.ts`, `tests/viewport-display.test.ts`, `tests/viewport-materials.test.ts`.

- [x] Inspect actual view, paint, multicanvas, assembly and standalone entry points; archive exact source plan.
- [x] Write and run failing defaults, validation and albedo tests: `node --experimental-strip-types --test tests/viewport-display.test.ts` (missing module confirms red).
- [ ] Implement `displayDefaults(view)`, `normalizeDisplay(input,view)`, `effectiveDisplay(state)`, versioned preferences, and `ViewportMaterials.get(source,preset,paint)`.
- [ ] Test source immutability, alpha/clipping, gray map removal, lit paint white factor, cache ownership and disposal. Run both files, then commit this coherent core.

## Task 2 — Real render pipeline and roles

Files: `desktop/viewport-display-controller.ts`, `desktop/viewport-cavity.ts`, `desktop/view.ts`, `desktop/canvas-view.ts`, `desktop/surface-paint-layer.ts`, `desktop/assembly-view.ts`.

- [ ] First add a real GPU fixture with dark U groove, same-color base/paint and known RGB chips. It must fail before controller integration.
- [ ] Controller interface: `state`, `set(patch)`, `draw()`, `dispose()`, `onChange`; constructor receives renderer, scene, camera, host, viewport id, target callback and busy callback.
- [ ] Mark author model and paint roles at creation; auxiliary objects remain excluded. At draw swap variants, render, finally restore all materials and visibility.
- [ ] Use installed SSAOPass depth/normal input for opaque author geometry only; exclude paint duplicate faces and all helpers. Preserve clipping, alpha, actual depth and auxiliary depth testing; bypass cavity for albedo and transparent X-Ray.
- [ ] Calibrate neutral camera-relative/fixed light basis and output conversion on both camera types. Record screen RGB error <=2 and U-groove localized AO difference.
- [ ] Verify rebuilds inherit display and source material ownership remains valid; no geometry regeneration for display changes.

## Task 3 — Menus and interaction

Files: `desktop/viewport-display-ui.ts`, `desktop/renderer.ts`, `desktop/workshop.ts`, assembly integration.

- [ ] Add compact per-view display details menu with four presets, rotation 0–360, follow camera, brightness .25–2, cavity off/low/medium, three backgrounds, folded aids and reset.
- [ ] Persist independent edit/preview/assembly/rock-lab preferences and explicit synchronization (default false).
- [ ] Migrate flat/clarity controls into display state. Disable display changes during active stroke or gizmo drag; idle paint mode temporarily albedo and restore unless user explicitly chooses another preset.
- [ ] Exempt display controls from rock outside-click cancellation and handle Escape before rock/selection shortcuts. Test frozen preview seed/count unchanged.

## Task 4 — Viewer, lifecycle and samples

Files: `prototypes/rock-shaping/viewer.ts`, viewer build, `desktop/thumbnail.ts`, `desktop/workshop-preview.ts`, display tests/sample generator.

- [ ] Offline viewer consumes the same controller and menu, using its Z-up/render-unit adapter.
- [ ] Persisted thumbnails use fixed colored recipe, independent of display preferences.
- [ ] Supply three original openable technical samples: dark rock wall, terraced platform, color/paint calibration.
- [ ] Real tests cover both cameras, resize/hidden view, three voxel scales, paint, undo, alpha/clipping, rock preview, assembly duplicate, sync/restart, 20 display cycles and resource counts.

## Task 5 — Delivery

- [ ] `npx tsc --noEmit`, affected core tests, `npm run build`, standalone build and real display Electron test.
- [ ] Run representative existing paint and rock UI regression once after stabilization; investigate failures without broad unrelated regression loops.
- [ ] Selectively commit feature, build/package `node scripts/package.mjs --target workshop`, run actual EXE display story and inspect build-info.
- [ ] Record actual GPU/window/DPR, frame intervals (separate CPU submit cost), screenshots, source hashes, passed/failed/unexecuted checks and limits under TOOL-012.
- [ ] Update CurrentRules and daily/project logs, verify protected files, selective safe push GitHub main. Deliver EXE and samples; user Gate V pending.
