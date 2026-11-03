param()
$ErrorActionPreference='Stop'
$delivery=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).ProviderPath
$qaRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'unity-session'))
$expected=[IO.Path]::GetFullPath((Join-Path $delivery 'qa/unity-session'))
if(-not $qaRoot.Equals($expected,[StringComparison]::OrdinalIgnoreCase)){throw 'Unexpected QA target.'}
if(Test-Path -LiteralPath $qaRoot){throw 'The one QA directory already exists; preserve and reuse it.'}
$baseline=Join-Path $delivery 'candidate'
if(-not(Test-Path -LiteralPath (Join-Path $baseline 'Assets/LE01'))){$baseline=[IO.Path]::GetFullPath((Join-Path $delivery '../../procedural-world-editor/LE-04/candidate'))}
$research=[IO.Path]::GetFullPath((Join-Path $delivery '../../procedural-world-editor/LE-01/project'))
if(-not(Test-Path -LiteralPath (Join-Path $baseline 'Assets/LE01'))){throw 'Verified LE-04 candidate Assets baseline is required.'}
$settingsSource=$baseline
if(-not(Test-Path -LiteralPath (Join-Path $settingsSource 'ProjectSettings/ProjectVersion.txt'))){$settingsSource=$research}
if(-not(Test-Path -LiteralPath (Join-Path $settingsSource 'ProjectSettings/ProjectVersion.txt')) -or -not(Test-Path -LiteralPath (Join-Path $settingsSource 'Packages/manifest.json'))){throw 'The research project package manifest and engine settings are required.'}
$otherQA=[IO.Path]::GetFullPath((Join-Path $delivery '../../procedural-world-editor/LE-04/qa/unity-session'))
if(Test-Path -LiteralPath $otherQA){throw 'LE-04 QA directory exists; do not create simultaneous validation projects.'}
New-Item -ItemType Directory -Path $qaRoot|Out-Null
function Copy-Tree([string]$source,[string]$destination){
 if(-not(Test-Path -LiteralPath $source)){return}
 $root=(Resolve-Path -LiteralPath $source).ProviderPath
 foreach($file in Get-ChildItem -LiteralPath $root -Recurse -File){
  $relative=$file.FullName.Substring($root.Length+1)
  if($relative -match '(^|[\\/])(WorkScenes|Recovery)([\\/.]|$)'){continue}
  $target=Join-Path $destination $relative
  New-Item -ItemType Directory -Force -Path ([IO.Path]::GetDirectoryName($target))|Out-Null
  Copy-Item -LiteralPath $file.FullName -Destination $target
 }
}
Copy-Tree (Join-Path $baseline 'Assets') (Join-Path $qaRoot 'Assets')
foreach($part in @('Packages','ProjectSettings')){Copy-Tree (Join-Path $settingsSource $part) (Join-Path $qaRoot $part)}
Copy-Tree (Join-Path $delivery 'candidate/Assets/SB03') (Join-Path $qaRoot 'Assets/SB03')
$rootMeta=Join-Path $delivery 'candidate/Assets/SB03.meta'
if(Test-Path -LiteralPath $rootMeta){Copy-Item -LiteralPath $rootMeta -Destination (Join-Path $qaRoot 'Assets/SB03.meta')}
Copy-Tree (Join-Path $PSScriptRoot 'Editor') (Join-Path $qaRoot 'Assets/SB03/Editor/QA')
New-Item -ItemType Directory -Force -Path (Join-Path $delivery 'reports')|Out-Null
$result=[ordered]@{status='PREPARED';project=$qaRoot;temporary=$true;assetsBaseline=$baseline;settingsAndPackagesSource=$settingsSource;overlay=(Join-Path $delivery 'candidate/Assets/SB03');hubEntryCreated=$false;liveProjectTouched=$false;formalProjectTouched=$false;desktopUsed=$false;createdUtc=[DateTime]::UtcNow.ToString('O')}
$result|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $PSScriptRoot 'unity-session-manifest.json') -Encoding utf8
$result|ConvertTo-Json
