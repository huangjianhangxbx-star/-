param([switch]$AuditOnly)
$ErrorActionPreference='Stop'
$delivery=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).ProviderPath
$expected=[IO.Path]::GetFullPath((Join-Path $delivery 'qa/unity-session')).TrimEnd([char]92,[char]47)
$named=[IO.Path]::GetFullPath('E:/WORLDCREATOR/XingHaiHuiLang/Origin/work/procedural-world-editor/LE-04/qa/unity-session').TrimEnd([char]92,[char]47)
if(-not $expected.Equals($named,[StringComparison]::OrdinalIgnoreCase) -or -not $expected.StartsWith($delivery+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Unexpected cleanup target; no filesystem changes were made.'}
$target=$expected
if(Test-Path -LiteralPath $target){
 $target=(Resolve-Path -LiteralPath $target).ProviderPath.TrimEnd([char]92,[char]47)
 if(-not $target.Equals($named,[StringComparison]::OrdinalIgnoreCase)){throw 'Resolved cleanup path differs from the one explicitly named QA directory.'}
 $node=Get-Item -LiteralPath $target
 if(($node.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'The QA directory is a link or junction; do not recycle through it.'}
}
function Normalize([string]$text){if($null -eq $text){return ''};$v=$text.Replace('/','\');while($v.Contains('\\')){$v=$v.Replace('\\','\')};return $v.TrimEnd([char]92)}
$processes=@(Get-CimInstance Win32_Process|Where-Object {$_.ProcessId -ne $PID -and (Normalize $_.CommandLine).IndexOf((Normalize $target),[StringComparison]::OrdinalIgnoreCase) -ge 0}|Select-Object ProcessId,Name,CommandLine)
if($processes.Count){throw ('A process is still using the temporary QA project: '+[string]::Join(', ',@($processes|ForEach-Object {$_.Name+' #'+$_.ProcessId}))) }
$mentions=[Collections.Generic.List[object]]::new()
function Find-Mention($value,[string]$file){
 if($null -eq $value){return}
 if($value -is [string]){if((Normalize $value).IndexOf((Normalize $target),[StringComparison]::OrdinalIgnoreCase) -ge 0){$mentions.Add([pscustomobject]@{file=$file;value=$value})};return}
 if($value -is [System.Collections.IDictionary]){foreach($k in $value.Keys){Find-Mention $value[$k] $file};return}
 if($value -is [System.Collections.IEnumerable] -and $value -isnot [string]){foreach($item in $value){Find-Mention $item $file};return}
 if($value -is [pscustomobject]){foreach($property in $value.PSObject.Properties){Find-Mention $property.Value $file}}
}
$roaming=[Environment]::GetFolderPath('ApplicationData')
$hubRoots=@('TuanjieHub','Tuanjie Hub','UnityHub','Unity Hub')|ForEach-Object {Join-Path $roaming $_}
foreach($hub in $hubRoots){if(Test-Path -LiteralPath $hub){foreach($file in Get-ChildItem -LiteralPath $hub -File -Filter '*.json'){
 try{Find-Mention (Get-Content -LiteralPath $file.FullName -Raw|ConvertFrom-Json) $file.FullName}catch{throw ('A Hub JSON could not be audited safely: '+$file.FullName)}
}}}
if($mentions.Count){throw 'The temporary project is still registered in a Hub JSON. No cleanup was attempted.'}
$protected=Get-Content -LiteralPath (Join-Path $delivery 'notes/protected-files.json') -Raw|ConvertFrom-Json
foreach($file in $protected){if(-not(Test-Path -LiteralPath $file.path -PathType Leaf) -or (Get-FileHash -LiteralPath $file.path -Algorithm SHA256).Hash -ne $file.sha256){throw ('Protected historical/user file differs; inspect before cleanup: '+$file.path)}}
$checks=[Collections.Generic.List[object]]::new()
foreach($name in @('delivery-audit.json','package-consistency.json')){
 $path=Join-Path $delivery ('reports/'+$name)
 if(-not(Test-Path -LiteralPath $path)){throw ('Required pre-cleanup evidence missing: '+$name)}
 $report=Get-Content -LiteralPath $path -Raw|ConvertFrom-Json
 if($report.status -ne 'PASS'){throw ('Required pre-cleanup evidence is not PASS: '+$name)}
 $checks.Add([pscustomobject]@{path='reports/'+$name;sha256=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash;sourceHash=$report.sourceHash})
}
if($checks[0].sourceHash -ne $checks[1].sourceHash){throw 'Native audit and package verification have different source versions.'}
[string[]]$sourcePaths=@(Get-ChildItem -LiteralPath (Join-Path $delivery 'candidate/Assets/LE01') -Recurse -File -Filter '*.cs'|ForEach-Object {$_.FullName})
[Array]::Sort($sourcePaths,[StringComparer]::CurrentCulture);$sha=[Security.Cryptography.SHA256]::Create()
try{$currentSourceHash=[Convert]::ToHexString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes([string]::Join("`n",@($sourcePaths|ForEach-Object {[IO.File]::ReadAllText($_)})))))}finally{$sha.Dispose()}
if($currentSourceHash -ne $checks[0].sourceHash){throw 'Candidate source changed after the final audit/package; preserve the QA project.'}
$package=Get-Content -LiteralPath (Join-Path $delivery 'reports/package-consistency.json') -Raw|ConvertFrom-Json
if(-not(Test-Path -LiteralPath $package.archive) -or (Get-FileHash -LiteralPath $package.archive -Algorithm SHA256).Hash -ne $package.archiveSha256){throw 'The verified archive is missing or changed; preserve the QA project.'}
$exists=Test-Path -LiteralPath $target
$audit=[ordered]@{status='SAFE_TO_RECYCLE';target=$target;resolvedTargetEqualsExplicitPath=$true;targetExists=$exists;targetIsReparsePoint=$false;activeProcesses=@($processes);hubEntries=@($mentions);protectedFilesVerified=$protected.Count;evidence=@($checks);archive=$package.archive;archiveSha256=$package.archiveSha256;auditedUtc=[DateTime]::UtcNow.ToString('O');auditOnly=[bool]$AuditOnly}
if($AuditOnly){$audit|ConvertTo-Json -Depth 8;return}
$audit|ConvertTo-Json -Depth 8|Set-Content -LiteralPath (Join-Path $delivery 'reports/cleanup-before.json') -Encoding utf8
if($exists){
 Add-Type -AssemblyName Microsoft.VisualBasic
 [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($target,[Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs,[Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin,[Microsoft.VisualBasic.FileIO.UICancelOption]::ThrowException)
 if(Test-Path -LiteralPath $target){throw 'The temporary QA directory remains in the workspace.'}
}
$result=[ordered]@{status='PASS';target=$target;temporaryProjectRemovedFromWorkspace=$true;alreadyAbsent=(-not $exists);method='Windows recycle bin, recoverable';permanentDeleteUsed=$false;hubEntriesFound=0;protectedFilesVerified=$protected.Count;sourceHash=$package.sourceHash;verifiedArchiveSha256=$package.archiveSha256;otherProjectsTouched=$false;desktopUsed=$false;sleepUsed=$false;completedUtc=[DateTime]::UtcNow.ToString('O')}
$result|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $delivery 'reports/cleanup.json') -Encoding utf8
$result|ConvertTo-Json

