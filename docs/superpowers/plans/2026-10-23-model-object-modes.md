# Model Object/Edit Modes Implementation Plan

**Goal:** Implement the approved object/edit split without destroying voxel sources.
**Architecture:** Asset objects own canvas IDs and a pivot in canvas ticks. Object collections group IDs without merging identity. CanvasSession owns atomic object commands/history; renderer routes pointer/gizmo input by mode; workshop owns the compact switch and hierarchy.
**Tech Stack:** TypeScript, Three.js, Electron, node:test, Playwright.
**Spec:** Approved conversation design: default multi-canvas, Ctrl+J joins identities while preserving grid precision, Tab edits voxels, selected voxels can be separated, default gizmos with no toggle.

- [x] Core: normalize legacy assets preserving ID/name/revision; validate objects/collection memberships. Test join mixed grids, move/rotate, copy/delete/separate and undo/redo before implementation.
- [x] View: object click/box selection, always-on appropriate gizmo, physical-space transform conversion; suppress voxel input in object mode. Keep active-canvas editing in edit mode.
- [x] UI/session: default new assets to multi-canvas; upgrade old when editing; tree of collections/objects/canvases, compact object/edit switch; Ctrl+J/Tab/copy/paste/delete/undo routing, separate selection.
- [x] Scene: always enabled gizmo, remove persistent switch; preserve drag-versus-box priority.
- [x] Integration: actual UI join->single object->Tab->voxel editing->separate->undo->save/reopen. Verify legacy identity and mixed-size data. Type check, core tests, scene and model regressions; package and push.

Validation: 329 core tests; TypeScript; V1/V2 model objects UI save/reopen; actual object click/box/duplicate-axis/ring UI; existing multi-canvas, overlap, assembly clipboard/drag regressions; packaged Workshop executable smoke. Selection history is session-only and interleaved with modeling history.
