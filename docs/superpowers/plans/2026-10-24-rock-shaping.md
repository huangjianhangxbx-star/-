# TOOL-011 R0–R3 implementation plan

> **For agentic workers:** Use subagent-driven implementation task by task; retain a separate review of invariants and actual gray-model output.

**Goal:** Deliver two deterministic, adjustable voxel shape prototypes for user Gate R-A.

**Architecture:** A pure integer-cell deletion planner computes both structured presets from an immutable snapshot. A separate Three.js validation page consumes those same cells through the existing mesher; no Workshop source, history or paint integration changes.

**Tech Stack:** Existing TypeScript, node:test, Three.js, esbuild and Playwright; no new dependencies.

**Spec:** docs/tasks/TOOL-011/approved-plan-v0.1.md (historical status paragraphs remain historical; latest user authorized first-round execution).

## Global constraints

- R0–R3 only; Gate R-A requires user assessment. R4–R7, painted-model transactions, FBX/EXE integration deferred.
- Subtraction only, original-source recomputation, separate random streams, joint four-side calculation, no air-gap penetration, protection/thickness/connectivity checks.
- Gray original fixtures; both presets and three fixed seeds; no third-party screenshots in public Git or package.
- Existing TOOL-010 B0–B2 at cd66cc7 remains unchanged; GitHub/local baseline 9e4d1ce, tracked tree clean before this task.

## Task 1: Pure shape planner

Files: core/rock-shaping.ts and focused supporting modules; tests/rock-shaping.test.ts.

- [x] Write tests for subtraction, determinism/order, target/protection, zero, first interval, thickness/connectivity, column continuity and nested terraces including L-shaped footprint and holes. Run RED before implementation.
- [x] Implement `shapeRock(cells, options)` with deterministic structured fields and diagnostics. Use integer x/y/z,color cells; return retained cells, removed keys, source stamp and recipe. Invalid geometry yields unchanged cells and blocking reasons.
- [x] Test three precisions through `cellSize` metadata (algorithm remains integer cells). Depth/damage changes preserve layout metadata.

## Task 2: Isolated prototype and original fixtures

Files: prototypes/rock-shaping/{index.html,viewer.ts,fixtures.ts,build.mjs}; tests/rock-shaping-ui.mjs.

- [x] Create original 40×24×48 block, single-face wall, 64×48×24 platform, L platform and unsupported thin/overhang fixtures.
- [x] Compact bounded sidebar, viewport dominates. Provide preset/fixture/seed 17,73,211, depth/width/continuity or band/layers/contour controls; original/result, camera reset, download source/result+recipe JSON. Orbit and pan available without modal dimming.
- [x] Build standalone browser bundle from existing dependencies. Entry works over file URL without CDN or remote resources.
- [x] Run actual browser controls, verify changing parameters recomputes from original, zero restores original, downloads contain actual cells. Capture six fixed-seed gray outputs with consistent camera per fixture.

## Task 3: Review and handoff

- [x] Inspect generated geometry screenshots; record limitations and technical failure fixtures without claiming artistic approval.
- [x] Run module tests, TypeScript and prototype build only; no full game/history suite.
- [x] Save recipes and original/result JSON examples; record counts, compute/mesh/display timings and environment.
- [x] Update task/status/daily record and existing rule scope; selectively commit and push GitHub HEAD:main only after ancestry verification. Open prototype for user and stop at Gate R-A.
