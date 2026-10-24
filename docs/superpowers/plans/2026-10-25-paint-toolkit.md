# TOOL-015 implementation plan

Approved scope: user directs execution of transferred PLAN.md M0–M8. Architecture: pure chart/raster/symmetry modules; one gesture controller; bounded sequential delta queue; existing CanvasSession and IPC authority remain the only writer. UI retains dark grey/gold, direct tools above view, right colour/symmetry groups. B-level module verification; no N1–N4.

- [x] M0: baseline main 1d3b15e, source fixtures arch/slab/L/columns, initial failure cases. No production assets.
- [x] M1/M3/M4/M5: tests/paint-toolkit.test.ts first; core/paint-surface-domain.ts maps chart pixels, exposure/ownership, connected components; core/paint-raster.ts integer brush/line/shapes/path; core/symmetry-space.ts exact half-grid transforms; selection/fill use finite chart mask. Run node --experimental-strip-types --test tests/paint-toolkit.test.ts red then implement.
- [x] M2: surface-paint-tools retains existing selectors, extends direct tool controls; paint-workspace colour wheel/recent/history and context bar; actual hit projection, visibility, contour preview. Check with real Electron, no source mutation on colour selection.
- [x] M6: BrushConfig optional local symmetry and blocked owner keys; mirror actual brush candidates before plan construction; pixel-perfect uses same transform after repair. Renderer shares target settings with child snapshot; test additions/erase/repaint, owner/budget/history.
- [x] M7: tests/paint-command-queue.test.ts; desktop/paint-command-queue.ts serializes sparse set/delete deltas against latest confirmed source, max4 pending, holds failed command for same-ID retry; save/history/return drain queue. Success and failure propagate. Run focused lease and queue tests.
- [x] M8: actual UI story + six-face three-step core matrix + real Blender FBX/PNG readback, relevant old list/menu and stroke regression, tsc/build. Bind packaged EXE to code SHA/fingerprint, repeat UI, preserve previous EXE. Record evidence and untested limits, selective main push. Gate P-A user pending.

Interfaces: SurfacePixel = {key,index,x,y,z,face,u,v}; Chart={face,plane}; global UV integers map via floor division. SymmetrySpec={axes:[boolean,boolean,boolean],center:[number,number,number]} in author metres; origin and step explicitly passed. Brush candidate reflections use exact K=2(center-origin)/step; no rounding. Candidate footprint is mirrored before masks. Source delta maps face/index to HEX or null; compose preserves all unrelated faces. Authority protocol stays paint/undo/redo/save.

Final executable and evidence: docs/tasks/TOOL-015/README.md. Technical scope M0–M8 delivered; user Gate P-A pending. N1–N4 not started.
