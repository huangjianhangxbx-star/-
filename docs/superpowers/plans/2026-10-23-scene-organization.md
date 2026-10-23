# Scene Organization Implementation Plan

**Goal:** Deliver the user-approved model edge toggle, bounded zoomable inspector, single-level collections and measured copy performance improvements.
**Architecture:** SceneSession owns transactional collection identity and membership. AssemblyWorkspace expands selection and renders a compact tree; AssemblyView owns cached model geometry, edges and incremental instance updates.
**Tech Stack:** TypeScript, Electron, Three.js, node:test, Playwright.
**Spec:** User-approved design in this chat on 2026-10-23 (执行吧).

## Constraints
- Model edges exclude per-voxel grids; toolbar toggle, default off.
- Keep sidebar outer frame fixed, wheel zoom content 60–150%, scrollbars for overflow, reset 100%.
- Collections are single-level, persisted with scene, selectable as a unit, copy as independent collections, undoable.
- Preserve model sources, existing files and old project compatibility. No new dependencies.

## Tasks
- [x] Core + persistence: extend scene schema and V2 roundtrip; add tests before create/dissolve/rename/expand/copy/delete implementation. Run scene collection tests; ensure old documents open.
- [x] View performance + edges: reproduce repeated asset serialization at 130 instances, measure before/after; cache shared geometry and reuse scene objects. Test model edges and selection-only update reuse.
- [x] Workspace: add collection creation/rename dialog, compact tree with fold state, expand click selection, copy collection snapshots. Add fixed inspector frame and wheel zoom/reset. Add black-edge toggle adjacent to existing scene controls.
- [x] Electron tests: create 2-member collection, select one member -> both, duplicate -> separate collection, rename/dissolve/undo/save/reopen; wheel zoom keeps frame width fixed; toggle edges leaves selection intact.
- [x] Validation: npx tsc --noEmit; npm test; build; assembly clipboard/pointer/UI regressions; screenshot review; update rules/status/log; selective commit, package and packaged smoke, push github main.
