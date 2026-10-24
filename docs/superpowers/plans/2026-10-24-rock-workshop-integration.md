# TOOL-011 R4–R7 Workshop Integration Plan

> **For agentic workers:** Use subagent-driven implementation for the separate asset transaction, panel and verification tasks; review contracts before wiring shared renderer code.

**Goal:** Make both reviewed rock presets usable on a selected Workshop object, with safe preview, atomic history, paint preservation, persistence and portable delivery.

**Architecture:** Pure `planRockAsset(model, objectId, options, settings)` derives a validated next asset and surface diagnostics from a frozen source. CanvasSession validates freshness and commits once. A nonmodal viewport panel owns a frozen context, recomputes previews and cancels on editor lifecycle changes; existing native source/export pipeline remains authoritative.

**Tech Stack:** Existing TypeScript, Three.js, Electron, node:test, Playwright and configured Blender. No new dependencies.

**Spec:** docs/tasks/TOOL-011/approved-plan-v0.1.md §§4,8–14; approved independent structural seeds. User said “并入工坊试试吧” after reviewing prototype.

## Constraints
- Baseline 7a1d942; no tracked changes at start. Respect manual design files and unrelated artifacts.
- One selected object/one editable canvas; no expansion to all canvas members. Single-cell targets receive actionable feedback.
- Preserve IDs, Root, object origin, palette, unrelated objects/canvases, and source occupancy; only subtraction.
- Default protect painted owners plus neighbors needed to preserve exposure. Explicitly disabling protection must still be atomic and restore paint on Undo.
- Delete matching cells from base/copies as well as composed occupancy so no old source revives. One application = one model history step; zero/invalid/stale = no commit.
- Nonmodal bounded panel, collapsed advanced settings, main viewport remains observable. Preserve right-orbit/middle-pan; cancel drafts on Esc, blur, save, undo and context/tool changes.
- Initial axis is local Z, axis-side shortcuts +X/-X/+Y/-Y and full outer rim. Unsupported complex/partial surface regions remain explicit limitations; no silently broadening a selected region.

## Task 1: Asset planning and atomic commit
Files: core/rock-shaping-asset.ts, core/workshop-canvases.ts, tests/rock-shaping-asset.test.ts.
- [ ] RED: test target isolation, masks, lock/hidden, source layers, default/off paint protection, retained/removed/revealed surfaces, stale rejection, no-op, one Undo/Redo, three precisions, save validation.
- [ ] Implement planRockAsset and rockAssetStamp. Return nextModel, target IDs, sourceStamp, RockResult and surface diagnostics; no mutations.
- [ ] Add CanvasSession.applyRock(plan): validate stamp/context/editability, reject blockers, commit a fresh safe plan once, install editor, preserve history ownership. Run GREEN.

## Task 2: Compact panel
Files: desktop/rock-shaping-panel.ts (new); root wires renderer.ts, canvas-view.ts preview only as needed.
- [ ] Panel deps begin()/preview(plan|null)/commit(plan)/message(); exported class open(),cancel(),active. Freeze snapshot on open, preview from original, retain chosen seeds, no modal/backdrop.
- [ ] Presets and sliders match prototype; sides and protected selected voxels; default painted-area protection, surface impact counts; advanced random seeds and per-group reroll.
- [ ] Debounce slider recompute, cancel pending request on close/context change; Apply only current valid changed result. Root blocks left edit/selection during preview, leaves camera controls available.
- [ ] Root integrates one entry in viewport modeling tools; source lifecycle cancels before operations. Verify actual geometry/paint preview and cancellation.

## Task 3: Verification and delivery
Files: tests/workshop-rock-shaping-ui.mjs, tests/workshop-rock-shaping-export.test.cjs, docs/tasks/TOOL-011, package script sample/docs copy if needed.
- [ ] Real Electron: select object→preview both presets→tune/seed→cancel/apply→undo/redo→save→restart; painted target protected/unprotected behavior, non-target isolation, context switches and save cancellation.
- [ ] Actual GLB/FBX export and Blender readback for two shapes; one sculpt→paint→FBX+PNG; portable source import/checksum path and representative existing paint/ownership regressions.
- [ ] Measure source/candidate/compute/mesh timings; module tests, type/build. Avoid all-game/historical test runs.
- [ ] Build portable Workshop EXE and repeat actual application/history/reopen for both presets; user Gate R-B pending.
- [ ] Update current rules/status/daily/task docs, selectively commit and push GitHub main after ancestry check. Do not push Gitee or user screenshots.
