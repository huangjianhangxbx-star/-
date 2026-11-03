param()
$ErrorActionPreference='Stop'
$delivery=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).ProviderPath
$named=[IO.Path]::GetFullPath('E:/WORLDCREATOR/XingHaiHuiLang/Origin/work/scene-builder-lab/SB-03/qa/unity-session')
$target=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'unity-session'))
if(-not $target.Equals($named,[StringComparison]::OrdinalIgnoreCase) -or -not $target.StartsWith($delivery+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Unexpected QA cleanup target.'}
if(Test-Path -LiteralPath $target){$resolved=(Resolve-Path -LiteralPath $target).ProviderPath;if(-not $resolved.Equals($named,[StringComparison]::OrdinalIgnoreCase) -or ((Get-Item -LiteralPath $resolved).Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Resolved QA target differs or is a link.'}}
if(@(Get-CimInstance Win32_Process -Filter "Name='Tuanjie.exe' OR Name='Unity.exe'"|Where-Object {$_.CommandLine -and $_.CommandLine.IndexOf($target,[StringComparison]::OrdinalIgnoreCase) -ge 0}).Count){throw 'QA editor still running; no process is closed.'}
foreach($name in @('workflow-evidence.json','workflow-reopen.json','scene-input-tests.json','kit-engine.json','native-save-reopen.json','delivery-assembly.json','review-qa.json','package-consistency.json')){$r=Get-Content -LiteralPath (Join-Path $delivery ('reports/'+$name)) -Raw|ConvertFrom-Json;if($r.status -ne 'PASS'){throw ('Unverified cleanup prerequisite '+$name)}}
$package=Get-Content -LiteralPath (Join-Path $delivery 'reports/package-consistency.json') -Raw|ConvertFrom-Json
if((Get-FileHash -LiteralPath $package.archive).Hash -ne $package.archiveSha256){throw 'Source archive changed.'}
$expected=Get-Content -LiteralPath (Join-Path $delivery 'reports/persistence-expected.json') -Raw|ConvertFrom-Json
if($package.sourceHash -ne $expected.sourceHash){throw 'Source archive and Engine evidence differ.'}
$assembly=Get-Content -LiteralPath (Join-Path $delivery 'reports/delivery-assembly.json') -Raw|ConvertFrom-Json
if(-not $assembly.deployed){throw 'Original project integration is incomplete.'}
$protected=Get-Content -LiteralPath (Join-Path $delivery 'reports/protected-original-before.json') -Raw|ConvertFrom-Json
foreach($row in $protected){if((Get-FileHash -LiteralPath (Join-Path $assembly.originalProject $row.path)).Hash -ne $row.sha256){throw ('Protected asset changed '+$row.path)}}
$mentions=[Collections.Generic.List[string]]::new();$roaming=[Environment]::GetFolderPath('ApplicationData')
foreach($name in @('TuanjieHub','Tuanjie Hub','UnityHub','Unity Hub')){$hub=Join-Path $roaming $name;if(Test-Path -LiteralPath $hub){foreach($file in Get-ChildItem -LiteralPath $hub -File -Filter '*.json'){$text=[IO.File]::ReadAllText($file.FullName).Replace('\\','\').Replace('/','\');if($text.IndexOf($target,[StringComparison]::OrdinalIgnoreCase) -ge 0){$mentions.Add($file.FullName)}}}}
if($mentions.Count){throw 'QA appears in Hub data; preserve the directory for inspection.'}
Add-Type -AssemblyName Microsoft.VisualBasic
if(Test-Path -LiteralPath $target){[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($target,[Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs,[Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin,[Microsoft.VisualBasic.FileIO.UICancelOption]::ThrowException)}
if(Test-Path -LiteralPath $target){throw 'QA directory remains.'}
foreach($file in Get-ChildItem -LiteralPath $delivery -File -Filter '*.zip.previous-*'){
 $full=(Resolve-Path -LiteralPath $file.FullName).ProviderPath;if(-not $full.StartsWith($delivery+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Unexpected superseded archive target'}
 [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($full,[Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs,[Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin,[Microsoft.VisualBasic.FileIO.UICancelOption]::ThrowException)
}
$result=[ordered]@{status='PASS';target=$target;method='Windows recycle bin, recoverable';temporaryProjectRemoved=$true;permanentDeleteUsed=$false;hubEntriesFound=$mentions.Count;protectedFilesVerified=$protected.Count;sourceHash=$package.sourceHash;archiveSha256=$package.archiveSha256;formalProjectTouched=$false;desktopUsed=$false;sleepUsed=$false}
$result|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $delivery 'reports/cleanup.json') -Encoding utf8
$result|ConvertTo-Json
