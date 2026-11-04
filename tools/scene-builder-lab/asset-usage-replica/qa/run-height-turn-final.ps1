$ErrorActionPreference='Stop'
$uxRoot=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).ProviderPath
$uxRunner=Join-Path $PSScriptRoot 'run-curve-editor.ps1'
$uxSource='3E0171E40CEE13FB56936F7935532D1DEDA22D3443934A811273A163559F3C4E'
$uxResults=@()
$uxStages=@(
 @('GestureShiftRobustnessQa.Green','shift-ux-final','gesture-shift-robustness-green.json'),
 @('BrushCornerQa.Green','corner-ux-final','brush-corner-green.json'),
 @('EndpointHeightTransactionQa.Green','endpoint-ux-final','endpoint-height-transaction-green.json'),
 @('StrokeRetractionHeightQa.Green','retract-ux-final','stroke-retraction-height-green.json'),
 @('DrawingRecoveryQa.Green','recovery-ux-final','drawing-recovery-green.json'),
 @('ContinuationActualGestureQa.Green','grab-ux-final','continuation-actual-gesture-green.json'),
 @('ContinuationRegressionQa.Green','ports-ux-final','continuation-input-green.json'),
 @('StrokeHeightGeometryQa.Green','heightmesh-ux-final','stroke-height-geometry-green.json'),
 @('StrokeHeightGeometryQa.Reopen','heightopen-ux-final','stroke-height-reopen.json'),
 @('DrawingUsabilityQa.Run','dense-ux-final','drawing-usability.json'),
 @('DrawingUsabilityQa.Reopen','denseopen-ux-final','drawing-usability-reopen.json'),
 @('HeightEnvelopeBoundaryQa.Run','envelope-ux-final','height-envelope-boundary.json')
)
foreach($uxStage in $uxStages){
 $uxStart=[DateTime]::UtcNow
 $uxLaunch=& $uxRunner -Method ('XingHai.BridgeReplica.QA.'+$uxStage[0]) -Name $uxStage[1] -Sync | ConvertFrom-Json
 Wait-Process -Id $uxLaunch.processId -Timeout 180
 $uxReportPath=Join-Path $uxRoot ('reports/'+$uxStage[2])
 if(-not(Test-Path -LiteralPath $uxReportPath)){throw ('Missing fresh report: '+$uxStage[0])}
 $uxWritten=(Get-Item -LiteralPath $uxReportPath).LastWriteTimeUtc
 if($uxWritten -lt $uxStart){throw ('Stale report refused: '+$uxStage[0])}
 $uxReport=Get-Content -LiteralPath $uxReportPath -Raw | ConvertFrom-Json
 if($uxReport.sourceHash -and $uxReport.sourceHash -ne $uxSource){throw ('Source fingerprint differs: '+$uxStage[0])}
 $uxItem=@{method=$uxStage[0];report=$uxStage[2];status=$uxReport.status;startedUtc=$uxStart.ToString('o');writtenUtc=$uxWritten.ToString('o');fresh=$true;sourceHash=$uxReport.sourceHash}
 $uxResults+=$uxItem
 $uxItem | ConvertTo-Json -Compress
 if($uxReport.status -ne 'PASS'){throw ('Relevant stage failed: '+$uxStage[0])}
}
@{status='PASS';sourceHash=$uxSource;desktopUsed=$false;physicalMouseTested=$false;freshReportsRequired=$true;stages=$uxResults}|ConvertTo-Json -Depth 5|Set-Content -LiteralPath (Join-Path $uxRoot 'reports/height-turn-final-suite.json') -Encoding UTF8
