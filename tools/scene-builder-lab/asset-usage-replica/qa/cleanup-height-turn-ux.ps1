$ErrorActionPreference='Stop'
$cleanupQa=(Resolve-Path -LiteralPath $PSScriptRoot).ProviderPath
$cleanupRoot=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).ProviderPath
$cleanupProcesses=@(Get-CimInstance Win32_Process | Where-Object {$_.Name -match '^(Tuanjie|Unity)\.exe$'})
if(@($cleanupProcesses | Where-Object {$_.CommandLine -and $_.CommandLine.IndexOf((Join-Path $cleanupQa 'unity-session'),[StringComparison]::OrdinalIgnoreCase) -ge 0}).Count){throw 'QA Editor must exit before recycling'}
Add-Type -AssemblyName Microsoft.VisualBasic
$cleanupRecycled=@()
foreach($cleanupRelative in @('unity-session','CurveBrushCore/bin','CurveBrushCore/obj','WideTurnRegression/bin','WideTurnRegression/obj')){
 $cleanupTarget=[IO.Path]::GetFullPath((Join-Path $cleanupQa $cleanupRelative))
 if(-not $cleanupTarget.StartsWith($cleanupQa+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Cleanup target escaped QA'}
 if(Test-Path -LiteralPath $cleanupTarget){
  $cleanupResolved=(Resolve-Path -LiteralPath $cleanupTarget).ProviderPath
  if(-not $cleanupResolved.StartsWith($cleanupQa+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase) -or (Get-Item -LiteralPath $cleanupTarget).LinkType){throw 'Refuse linked or escaped cleanup target'}
  [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($cleanupResolved,[Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs,[Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin)
  if(Test-Path -LiteralPath $cleanupResolved){throw 'Recycle did not remove QA target'}
  $cleanupRecycled+=$cleanupResolved
 }
}
$cleanupResearch=[IO.Path]::GetFullPath((Join-Path $cleanupRoot '../../procedural-world-editor/LE-01/星骸地编'))
$cleanupReport=@{status='PASS';recycled=$cleanupRecycled;researchEditorClosedByAgent=$false;desktopUsed=$false;researchEditorOpen=@($cleanupProcesses|Where-Object {$_.CommandLine -and $_.CommandLine.IndexOf($cleanupResearch,[StringComparison]::OrdinalIgnoreCase) -ge 0}).Count -gt 0;formalEditorOpen=@($cleanupProcesses|Where-Object {$_.CommandLine -match 'Project_ANKALUTE'}).Count -gt 0}
$cleanupReport|ConvertTo-Json -Depth 3|Set-Content -LiteralPath (Join-Path $cleanupRoot 'reports/height-turn-cleanup.json') -Encoding UTF8
$cleanupReport|ConvertTo-Json -Depth 3 -Compress
