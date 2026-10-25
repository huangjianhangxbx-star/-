# Native Spine project workflow

## Approved intent
Select source and target `.spine` directly, migrate and preview, save an editable new `.spine` without manual JSON export or atlas unpacking. Keep original files untouched. Use installed licensed Spine 4.3.26; internal intermediate files are implementation details.

## Implementation
- [x] Add `desktop/native-project.cjs`: official CLI runner (hidden process, timeout, arguments without shell), read-only export to unique cache, skeleton choice for multi-skeleton projects, and image/atlas loading through existing package-store.
- [x] Test loading with a fake CLI boundary: native path retained, originals immutable, multi-skeleton choice required, conversion failures do not return a resource.
- [x] Add native save through the editor's animation-only import into the target project: original project byte snapshot backup, temporary animation carrier project, explicit destination animation, independent re-export verification. Do not use a reconstructed skeleton as the delivered target project.
- [x] Test native save success and failed verification. Compare all exported bones, slots, skins, constraints and animations after normalizing only metadata and zero time values.
- [x] Integrate main IPC and UI: source/target `.spine` or legacy JSON, saved executable preference, progress/error text, truthful save label and output native path. Preserve request serial guards.
- [x] Run focused tests, typecheck, build; run rhiny/rozeul native load and migration save with real official CLI, confirm original hashes and reopen/re-export output.
- [x] Package new portable release with bridge module, update handoff and task logs, selectively commit and synchronize GitHub main.

## Save boundary — user clarification
The user requires insertion into the target `.spine`, preserving the rest of the project. A reconstructed project is not an acceptable replacement. The supported CLI imports whole skeletons, not animation-only edits. The user explicitly approved automatic preparation followed by a manual confirmation in Spine. JSON and a temporary carrier `.spine` are internal intermediates only. A target copy is a safety measure, not reconstruction. This version adds a new animation with collision suffixes, and does not overwrite existing animations. Multi-skeleton input requires explicit selection.

## Execution result

Native loading, automatic handoff preparation, UI and verification implemented. 105 tests pass, 9 existing external-fixture tests skip; typecheck/build and final packaged real native input flow pass. Carrier binary roundtrip and verification against prior GUI-saved reference pass. Fresh foreground GUI import remains the user's confirmation step; no claim of background automatic mutation. Final package and detailed evidence are in native-project-handoff.md.
