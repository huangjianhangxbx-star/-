# Overlap Copy and Axis Move Implementation Plan

> **For agentic workers:** Use the existing test-driven-development skill for each task. This plan is executed in this chat without delegation.

**Goal:** Allow overlapping paste while keeping copied voxels part of one editable model, with an in-viewport X/Y/Z move gizmo.

**Architecture:** Keep `cells` as the unique composite for mesh, preview and FBX. Optional base/copy groups preserve exact-overlap paste internally. Selected voxel edits consume every layer at the edited coordinates and write one result into the model. The just-pasted group can initially move away by snapped grid offsets; later selections operate on visible geometry as one model.

**Tech Stack:** TypeScript, Three.js, Electron, Playwright, Node test runner.

**Spec:** `docs/tasks/TOOL-009/overlap-copy-design.md`.

## Global Constraints

- Keep `voxelSize` at 0.25 m and do not change FBX/Unity exchange contracts.
- Old assets without copy fields remain readable and unchanged when not copied.
- No Gitee push; after passing verification use the authorized GitHub development main flow.

### Task 1: Overlap persistence

- [ ] Add failing core tests for overlapping copy, save/reload, move, undo/redo and composite color/export.
- [ ] Extend map/asset validation, editing adapter and EditorDocument composition.
- [ ] Run the focused and full core tests.

### Task 2: Paste interaction

- [ ] Add failing Electron test for Ctrl+C/V, Esc, selected copy, save/reopen.
- [ ] Route paste confirmation to copy-group creation; keep source-origin placement stable until explicit target selection.
- [ ] Verify existing move, brush, scale and scene-asset workflows.

### Task 3: Axis gizmo

- [ ] Add failing Electron drag test with snapped X/Y/Z movement, history and selection.
- [ ] Add visible viewport tool switch and draggable handles; keep storage groups internal.
- [ ] Verify orbit, Escape, conflict/overlap, two window sizes and packaged Electron.

### Task 4: Delivery

- [ ] Typecheck, build, package, run targeted/full regression and inspect screenshots.
- [ ] Update project status and daily log, selectively commit, verify GitHub main baseline and push.
