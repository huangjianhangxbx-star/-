param([switch]$Deploy)
$ErrorActionPreference='Stop'
$delivery=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).ProviderPath
$qa=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot 'unity-session')).ProviderPath
if(@(Get-CimInstance Win32_Process -Filter "Name='Tuanjie.exe'" | Where-Object {$_.CommandLine -and $_.CommandLine.IndexOf($qa,[StringComparison]::OrdinalIgnoreCase) -ge 0}).Count){throw 'Wait for the QA process to close before assembling source.'}
foreach($name in @('core-tests.json','editor-integration.json','scene-input-tests.json','kit-engine.json','workflow-evidence.json','workflow-reopen.json','persistence.json','native-save.json','native-save-reopen.json','performance-unity.json')){
 $file=Join-Path $delivery ('reports/'+$name);if(-not(Test-Path -LiteralPath $file)){throw "Missing required evidence $name"};$data=Get-Content -LiteralPath $file -Raw|ConvertFrom-Json;if($data.status -ne 'PASS'){throw "Evidence is not PASS: $name"}
}
$expected=Get-Content -LiteralPath (Join-Path $delivery 'reports/persistence-expected.json') -Raw|ConvertFrom-Json
function Source-Hash([string]$folder){[string[]]$files=@(Get-ChildItem -LiteralPath $folder -Filter '*.cs' -Recurse -File|Where-Object {$_.FullName.Replace('\','/') -cnotlike '*/QA/*'}|ForEach-Object {$_.FullName});[Array]::Sort($files,[StringComparer]::Ordinal);$joined=[string]::Join("`n",@($files|ForEach-Object {[IO.File]::ReadAllText($_)}));return [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($joined)))}
$source=Join-Path $qa 'Assets/SB03';$candidate=Join-Path $delivery 'candidate/Assets/SB03'
if((Source-Hash $source) -ne $expected.sourceHash -or (Source-Hash $candidate) -ne $expected.sourceHash){throw 'Production source changed after final Engine evidence.'}
$scene='Assets/SB03/Scenes/SB03_Bridge.unity'
$sceneKey=[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($scene.ToLowerInvariant()))).Substring(0,16)
foreach($file in Get-ChildItem -LiteralPath $source -Recurse -File){
 $r=$file.FullName.Substring($source.Length+1).Replace('\','/')
 if($r -match '^Editor/QA(/|\.meta$)' -or $r -match '^WorkScenes(/|\.meta$)'){continue}
 if($r -match '^Scenes/' -and $r -notmatch '^Scenes/SB03_Bridge\.unity(\.meta)?$'){continue}
 if($r -match '^Generated/' -and $r -notmatch ('^Generated/NativeScenes(\.meta$|/'+$sceneKey+'(/|\.meta$))')){continue}
 $target=Join-Path $candidate $r;New-Item -ItemType Directory -Force -Path ([IO.Path]::GetDirectoryName($target))|Out-Null;Copy-Item -LiteralPath $file.FullName -Destination $target
}
Copy-Item -LiteralPath (Join-Path $qa 'Assets/SB03.meta') -Destination (Join-Path $delivery 'candidate/Assets/SB03.meta')
$count=@(Get-ChildItem -LiteralPath $candidate -Recurse -File).Count
$result=[ordered]@{status='PASS';sourceHash=$expected.sourceHash;candidateFiles=$count;sampleScene=$scene;sampleGeneratedSceneKey=$sceneKey;testAndRecoveryScenesIncluded=$false;hubEntryCreated=$false;desktopUsed=$false;deployed=$false}
if($Deploy){
 $project=(Resolve-Path -LiteralPath (Join-Path $delivery '../../procedural-world-editor/LE-01/project')).ProviderPath
 if(@(Get-CimInstance Win32_Process -Filter "Name='Tuanjie.exe'"|Where-Object {$_.CommandLine -and $_.CommandLine.IndexOf($project,[StringComparison]::OrdinalIgnoreCase) -ge 0}).Count){throw 'Research editor reopened; do not overwrite while running.'}
 $protected=Get-Content -LiteralPath (Join-Path $delivery 'reports/protected-original-before.json') -Raw|ConvertFrom-Json
 foreach($row in $protected){$p=Join-Path $project $row.path;if(-not(Test-Path -LiteralPath $p) -or (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash -ne $row.sha256){throw ('Protected original file changed: '+$row.path)}}
 $target=Join-Path $project 'Assets/SB03';if(Test-Path -LiteralPath $target){throw 'Existing SB03 deployment preserved; inspect before replacing.'}
 foreach($file in Get-ChildItem -LiteralPath $candidate -Recurse -File){$r=$file.FullName.Substring($candidate.Length+1);$dest=Join-Path $target $r;New-Item -ItemType Directory -Force -Path ([IO.Path]::GetDirectoryName($dest))|Out-Null;Copy-Item -LiteralPath $file.FullName -Destination $dest}
 Copy-Item -LiteralPath (Join-Path $delivery 'candidate/Assets/SB03.meta') -Destination (Join-Path $project 'Assets/SB03.meta')
 foreach($row in $protected){if((Get-FileHash -LiteralPath (Join-Path $project $row.path) -Algorithm SHA256).Hash -ne $row.sha256){throw ('Original changed during copy: '+$row.path)}}
 foreach($file in Get-ChildItem -LiteralPath $candidate -Recurse -File){$r=$file.FullName.Substring($candidate.Length+1);if((Get-FileHash -LiteralPath $file.FullName).Hash -ne (Get-FileHash -LiteralPath (Join-Path $target $r)).Hash){throw "SB03 copy mismatch $r"}}
 $result.deployed=$true;$result.protectedFilesVerified=$protected.Count;$result.originalProject=$project
}
$result|ConvertTo-Json -Depth 5|Set-Content -LiteralPath (Join-Path $delivery 'reports/delivery-assembly.json') -Encoding utf8
$result|ConvertTo-Json -Depth 5
