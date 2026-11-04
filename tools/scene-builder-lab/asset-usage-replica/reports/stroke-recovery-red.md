# Core stroke recovery baseline — 2026-11-04

Scope: deterministic pointer inputs through the actual candidate `CurveSketch.Build -> CurveEdits.AppendStroke/PrependStroke -> CurveSolver.Solve`. No production changes, Unity launch, physical-mouse claim, or replacement Window recovery algorithm. The saved base document is checked for byte-equivalent JSON after each run.

Command:

```powershell
dotnet run --project 'Origin/work/scene-builder-lab/asset-usage-replica/qa/StrokeRecoveryRegression/StrokeRecoveryRegression.csproj' -- 'Origin/work/scene-builder-lab/asset-usage-replica/reports/stroke-recovery-red.json'
```

Result: intentional behavioral **RED**, exit 1, 775 ms. The JSON keeps compact facts for the matrix, four short recovery traces, and two complete representative failure inputs.

| Case | Final success | Finding |
| --- | ---: | --- |
| Same radius-6 m path, sample gap .05/.25/1/2 m, starting turn 0/10/45 degrees, both ends | 22/24 | Only the 2 m gap plus 45-degree starting direction fails, at both ends. The new stroke alone passes. Its first chord is about 54.55 degrees from the old tangent and trips the 50-degree seam limit. The same intended path with .05/.25/1 m sampling passes. |
| Actual noisy hand-drawn radius-6 base, four final raw-release lengths, four new initial sample gaps, 5/10/20/45-degree turns, both ends | 74/128 | All bases and final new strokes pass individually. Joins reject 22 cases for seam radius below 2.4 m and 32 for seam turn above 50 degrees. |
| Valid .6 m prefix, short rejected lateral excursion, return near valid endpoint, then extend straight to 4 m, both ends | 0/4 | Each accepts its first .6 m prefix. Retaining the rejected point causes every subsequent whole-history rebuild to reject `stroke-1` for a turn above 50 degrees. The displayed accepted result remains 3.4 m behind the final pointer. |

The recovery raw trace in local outward coordinates is `(0,0), (.6,0), (.62,e), (.65,.01), (.9,0), (1.5,0), (4,0)`, where `e` is .3 or .8 m. Nothing is removed or artificially recentered. This is baseline evidence for accepted-prefix plus temporary-tail recovery in the Window; changing the Core fixture to emulate that repair would conceal the original failure.

## Raw release length is not saved seam length

The base is built with real `CurveSketch.Build`, with 2 cm pointer noise. Its final raw-release movements are .02/.1/.3/1 m. Build simplifies those into saved terminal spans of approximately 1.053/1.133/1.332/1.058 m, respectively. These results **do not prove** that Build retains a .02 m saved tail. They prove that ordinary sampled curves can carry enough terminal chord error to reject a subsequent natural continuation.

| Final raw release | Joins | Saved terminal span |
| --- | ---: | ---: |
| .02 m | 18/32 | 1.053 m |
| .1 m | 18/32 | 1.133 m |
| .3 m | 20/32 | 1.332 m |
| 1 m | 18/32 | 1.058 m |

Across these drawn bases, 5-degree and 10-degree starts pass 32/32 each; 20-degree starts pass 10/32; 45-degree starts pass 0/32. Saved end tangent error is approximately 4.5–6 degrees from the analytic curve tangent. These are intentionally adversarial seam cases, not an estimate of users' overall success rate.

Interpretation: whole-history poisoning and sparse first-chord rejection are separate effects. The former is an interaction-state recovery defect. The latter is a geometric sampling sensitivity near the strict turn limit. The natural-base failures do not justify raising every radius/angle threshold; seam handling must preserve existing authority and geometric safety while managing the entry tangent.

Source SHA-256 at run:

- `CurveSketch.cs`: `8DEBF6F6C6BC696F3C5077A7E345C51C60C6F687B8374BFEFA3063FC3C4901E8`
- `CurveModel.cs` (CurveEdits): `C2BB26EFD512F172E0FE1950B27DF341885861DEAC6F2A18616A2F669092B0B9`
- `CurveSolver.cs`: `6FE2F1490B7360C19F6160FF003E10EACE8C9C78B2E89AF156C4F033E5E65A49`

One repeat encountered a transient E-drive disk-full error while writing the JSON. A completed rerun wrote to a C-drive temporary file, then the complete 119,291-byte report was copied back and successfully parsed. That I/O failure is not counted as a behavioral RED.
