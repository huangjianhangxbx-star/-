# TOOL-013 Regional Color and Face Tone Implementation Plan

**Goal:** Deliver persisted regional base-color variation and independently removable face shading throughout Workshop, portable sources and GLB/FBX.

**Architecture:** Pure deterministic grouping and linear-sRGB appearance functions produce frozen, verified asset plans. Sparse `faceTone` lives beside paint per canvas; geometry, overlays, thumbnails and export evaluate the same rule. Existing object/canvas transactions own commits and mapping, while one top-toolbar authoring panel owns preview/compare/apply.

**Tech Stack:** Existing TypeScript, Three.js 0.186.1, Electron 44.5.1, Node tests, Playwright and local Blender 5.1.2. No dependency changes.

**Spec:** `docs/tasks/TOOL-013/PLAN.md`, `START_HERE.md`, `ACCEPTANCE.md`; user transferred for M0–M6 execution. Inline execution under existing authorization; no new approval round, no delegation or unavailable subskills.

## Constraints and baseline

- Baseline 221bfe4; no tracked dirty files, GitHub checked. Protect TOOL-010 paint/TOOL-011 sculpt/TOOL-012 top-toolbar display.
- Source Z-up, face order +X/-X/+Y/-Y/+Z/-Z, one active writable canvas; no empty-selection whole-model fallback.
- Regional operations commit base color; face tones replace relative gain, preserve paint, persist separately. No occlusion/AO baking, arbitrary brick recognition, transparent brush or unlimited effect stack.
- Existing material profile budget is 64, not the map palette's 4096: reject overflow atomically and preserve material identity.
- B-level module checks, actual EXE and actual Blender readback; user visual gate remains separate.

## 1. Pure contracts and storage

- [x] Add `tests/appearance.test.ts` before implementation; run `node --experimental-strip-types --test tests/appearance.test.ts` and confirm missing-module failure.
- [x] Add `core/appearance-color.ts`: `appearanceColor(base,paint?,tone?)`, linear relative gain. Add `core/face-tone.ts`: strict `FaceTone`, six-normal gains, filtering/remapping/reconciliation and visible-face planning. Tests require top(+Z,L+Z)=1, bottom<side<top, replace/clear idempotence, protected paint white unchanged, negative/canonical keys and invalid gains rejected.
- [x] Add `core/regional-color.ts`: `regionalDefaults`, `regionalGroup(point,options)`, stable hashes, owner/brick/patch groups (legacy per-cell tool remains at its existing entry). Tests compare reordered cells, 8×3×2 brick uniformity, negative floor/stagger, ratio nesting, amplitude-only changes, physical-coordinate three-scale sampling.
- [x] Add optional validated faceTone to asset/canvas/edit proxy, reject unsupported native-v1 downgrade; unknown fields/versions still reject. Old files without tone remain equivalent.

## 2. Frozen asset transactions and lifecycle

- [x] Add `core/appearance-asset.ts`: `planAppearance(model,canvasId,keys,options)`, `verifiedAppearancePlan(plan,model)`, private verified snapshot. Regional slots key by source material identity+gain; recolor visible and layered source cells, preserve noncolor material fields, reject >64.
- [x] `CanvasSession.applyAppearance` verifies exact source stamp and active writable scope, commits once only on change. Input plans never mutate source. Add transaction tests for cancel/noop/stale/tamper/Undo/Redo.
- [x] Remap faceTone in object copy/paste/move/rotation, canvas conversion/merge/partition, scene join; retain transformed face direction and overwrite destination entries. Filter removed owners/newly exposed faces during editing/sculpt. Reject ambiguous selected-voxel resampling with explicit reason.
- [x] Add lifecycle tests in `tests/appearance-lifecycle.test.ts`: copy/move/90°/separate/merge, collision overwrite, layered source colors, rock cleanup, save/portable preservation and unsupported operations.

## 3. Shared rendering, painting and export

- [x] Extend greedy quad grouping with tone gain/paint policy. Render vertex colors via appearanceColor in MapView/AssemblyView; SurfacePaintLayer composes changed base and original pixels without modifying paintSource. Dark-only unpainted faces use ordinary geometry, not fake paint tiles.
- [x] Export plain faces as derived material colors with source roughness/metallic/alpha preserved; painted tiles compose final pixels once and use white factors. Export all canvas precisions/Root offsets through existing paths.
- [x] Thumbnail and pipette read author appearance, never viewport light. Add export/PNG/material tests; source paint hash unchanged and no-tone old export equivalent.

## 4. Formal UI and preview

- [x] Add `desktop/appearance-panel.ts`: top command-row “上色” entry, two pages “区域色差/美术暗面”, explicit modes and seeds, meter scales, brick plane/stagger/origin, ratio/strength/steps, author-scope warning, original/base-only/group/affected-face comparisons.
- [x] Renderer freezes context once; uses CanvasView's derived-model preview without touching author state. Debounce parameter updates, retain frozen source, no camera/light-triggered replan. Display menus exempt preview cancellation, real window blur follows existing policy; apply is one transaction and cancel restores.
- [x] Actual Electron regression: selected object, preview/cancel, display change during preview, tone/clear, Undo/Redo, save and real process restart; partial scope, invalid inputs, side/material/paint contracts exercised by focused core/export tests, not claimed as an exhaustive keyboard UI matrix.

## 5. Delivery and verification

- [x] Generate two original practice assets and seeds17/73/211 recipes, same-camera pure/legacy/brick/patch/tone screenshots. Do not publish the task reference image.
- [x] Run related new/authority tests, tsc/build, real UI, representative paint/sculpt/display regressions only where touched. Record planning/mesh/material/source size measurements separately from FPS.
- [x] Real Blender GLB→FBX→readback: three precisions, nonzero Root, side color, partial/full painted white mark and face gains; verify normals/material RGB/PNG/UV, no double tint. Run one available isolated Tuanjie receiver sample or explicitly report why unavailable.
- [ ] Selective feature commit, build/package EXE bound to feature SHA, actual EXE smoke and restart. Preserve existing package rollback.
- [ ] Update task/current rules/daily status, check protected SHA and source fingerprint, selective safe GitHub main push. Deliver technical status plus limitations; stop at user visual acceptance, not spec §13.

Execution note: core/UI/save/export/engine checks complete; final feature-bound package/restart and GitHub verification are being performed before handoff. See task README for exact covered matrix and unsupported selected-voxel transforms. User visual gate remains open.
