# Independent kit B handoff

Status: all nine source assets and supplier verification complete; ready for frozen-baseline consumer registration. The artist did not inspect or edit generator code or kit A geometry/recipes and did not respond to consumer results by changing the art.

Machine input: `../../kits/B/kit-manifest.json`. Contract top-level id `workshop.bridge.B`, version `1`, family `bridge-orthogonal-v1`; all nine required role keys, stable asset ids, exact logical size arrays, relative FBX/palette/source/preview paths, adapter yaw 180. No manually authored manifest hashes.

Files: 9 `.blend`, 9 recipe JSON, 9 palette FBX, 9 palette PNG, 9 palette GLB, 9 actual neutral PNG previews. Sources saved before presentation cameras/lights were created. Native source disk hashes remained unchanged during export, preview and independent reopen validation.

Evidence:

- `workbench-discovery.json`: actual Blender 5.1.2 API capability/default profile query in fresh factory scene, before new profile creation.
- `build-validation.json`: API validation/inspection, actual bounds, source fingerprints, per-source 0.125 m profile snapshots and exported file hashes.
- `independent-validation.json`: nine PASS records from reopening actual `.blend` with scripts disabled and independently importing palette FBX into an empty scene. Includes source/FBX/palette SHA-256, native geometry signatures, bounds, source matrices, UV loops and texture references. No recipe replay.
- `build.log` and `independent-validation.log`: actual Blender runs; final markers `KIT_B_COMPLETE` and `ALL_NINE_NATIVE_AND_FBX_PASS`.
- `kit-B-overview.png`: contact sheet of the nine actual neutral previews.
- `orthographic/{tread,deck,post,rail}/{front,side,top}.png`: 12 actual native geometry renders, reopened from saved files.
- `orthographic-contact-sheet.png`: labeled orthographic render sheet.
- `measured-interfaces.svg`: dimensions, actual source box projections, logical envelopes, pivot crosses and interface measurements extracted from the independent validation data.

Checks passed: exact fixed envelopes and bottom-center origin; source Y symmetry; continuous top 0.25 m for deck/tread; native negative-X tread overhang; two genuine rail windows; no source nonuniform scaling; exact solid-vertex signature through FBX roundtrip; all UV loops in range and external palette PNG present/referenced; export/render preserved source fingerprint and disk SHA.

Limits: Blender roundtrip validates actual exported meshes, not the consumer's raw-FBX matrix implementation. Raw child-matrix plus `unityAdapterYaw=180`, replacement seams, collision openings and persisted editor reload remain consumer checks. No Unity/game/desktop launch, no game code edits, no Addon installation, no main profile or old-source changes.

Reproduction entry points: `query_workbench.py`, `build_kit_b.py`, `verify_and_render.py`, `make-contact-sheets.ps1`, `make_measured_svg.py`. Build execution was through the shared API only; presentation scripts create no asset geometry.
