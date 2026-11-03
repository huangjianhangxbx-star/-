# LE-04 Local / Reference Core implementation checkpoint

2026-11-03. Candidate only; this note does not claim Editor installation or final integration success.

## Owned implementation

- `TerrainLocalEdits.cs`: command-specific types; exact half-open interval subtraction/union; source-preserving sparse changes; Raise/Lower and soft shoulders; wall-normal thickness controls; protected-shape rejection; support-component checks (including touching ordinary color bands); stable revision guard.
- `TerrainReferenceField.cs`: certified source validation; SHA key over actual geometry / RGBA / pivot / settings; immutable sampled field cache; voxel-unit pivot to metre conversion; source labels have no generation semantics.
- `TerrainReferenceEdits.cs`: arc-length sweep; target-grid inverse sampling, yaw and XYZ resampling; add/difference/color-only; default colors only on newly added volume; manual color precedence; explicit overwrite; finite existing-surface shoulder; sampling/expanded-column/run budgets.

All commands read `TerrainEditSnapshot.ColumnAt`, never old `TerrainDocument.Top` once overrides exist. Empty override columns remain explicit tombstones. No placements or prefab objects are created.

## Executed checks

`dotnet run --project qa/Core/Core.csproj -c Release -- local`
`dotnet run --project qa/Core/Core.csproj -c Release -- reference`
`dotnet run --project qa/Core/Core.csproj -c Release -- real-reference`

All three passed; exact captured results: `reports/core-local.txt`, `reports/core-reference.txt`, `reports/core-real-reference.txt`.

Two real original workshop inputs were sampled: ridge 272 occupied source cells and notched-terrace 448. Both passed continuous generation, repeat idempotence, .125 m resampling, X2 / Y.5 / Z.5 stretch and 90-degree yaw. Source bytes were hashed before and after.

Actual behavior reds retained: legacy middle-band erase and whole-piece placement; local target quantum unused; real source pivot interpreted in wrong units; hidden manual-priority reference color accumulation; explicit overwrite absent. Extra color-band support / soft-shoulder regressions were observed in tool output and remain in tests.

## Explicit limits

- B-specific asset assembly / snow-rock semantics / cross-route mesh welding are absent by design.
- Reference is a sampled shape/color field, not a semantic object recognizer; arbitrary斜面 repair is not provided.
- Thickness is along the dominant horizontal axis of the selected wall normal.
- Current saved override budget in shared validation is global 65,536 owned fine columns / 262,144 spans; per-command source resampling has independent bounded work checks.
- Seed is persisted but currently has no geometric effect; the generic shoulder is deterministic without random jitter. The owner was asked to remove or explain the inactive UI control.
- Full Editor event/Undo/reopen/FBX and full main-thread performance gates belong to integration and are not certified by these CPU tests.

## Independent review findings sent to owners

- Paint actual lower shelf was ignored when another span occupied the same XZ column (`paint-audit` real failing regression).
- Opening a file moved Transform without recording Transform Undo.
- Closed-scene session cache / palette preview cache needed lifecycle bounds.
- Surface overlay box could include corners outside circular influence.
- Full `WithState` override-array reconstruction was a performance concern; surface owner is optimizing persistence reuse.
