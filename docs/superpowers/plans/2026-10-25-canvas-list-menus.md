# Canvas list and menu repair implementation plan

Goal: implement the approved TOOL-014 supplement without changing voxel merge semantics.
Architecture: dedicated CanvasListPanel owns view-only selection; existing CanvasSession owns writes/history. A shared popover coordinator handles viewport sibling menus and dismiss gestures. Electron painting authority remains unchanged.
Spec: docs/tasks/TOOL-014/canvas-list-spec.md. Verification level B.

- [x] Reproduce empty five-canvas list and actual mode-menu hit obstruction; pure selection/preflight tests red.
- [x] Implement list selection and merge preflight; persistent keyed rows, management/property controls; reuse world-camera capture/restore and draft/lease guards.
- [x] Replace old canvas selector/merge checkboxes; preserve object editing permissions; test merge undo/redo, failed operations, management inputs.
- [x] Promote mode/brush/precision/context menus to coordinated popovers; actual hit tests at three sizes and 150% zoom, no dismiss-click painting or Esc clearing.
- [x] Targeted/core/TS/build and source/GLB protection; package and repeat list/menu plus existing stroke continuity, document SHA/fingerprint/screenshots, selective GitHub push.

Final package receipt: docs/tasks/TOOL-014/canvas-list-fix.md (recorded after executable verification).
