param()
$ErrorActionPreference='Stop'
$delivery=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).ProviderPath
$qaRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'unity-session'))
if($qaRoot -ne (Join-Path $delivery 'qa/unity-session')){throw 'Unexpected QA target'}
if(Test-Path -LiteralPath $qaRoot){throw 'An existing QA directory is preserved; inspect it before preparing another'}
$source=Join-Path $delivery 'candidate'
if(-not(Test-Path -LiteralPath (Join-Path $source 'ProjectSettings/ProjectVersion.txt'))){$source=[IO.Path]::GetFullPath((Join-Path $delivery '../LE-01/project'))}
if(-not(Test-Path -LiteralPath (Join-Path $source 'ProjectSettings/ProjectVersion.txt'))){throw 'The source package candidate or original research project is required'}
New-Item -ItemType Directory -Path $qaRoot|Out-Null
foreach($part in @('Assets','Packages','ProjectSettings')){
 $root=(Resolve-Path -LiteralPath (Join-Path $source $part)).ProviderPath
 foreach($file in Get-ChildItem -LiteralPath $root -Recurse -File){
  $relative=$file.FullName.Substring($root.Length+1)
  if($relative -match '(^|[\\/])(WorkScenes|Recovery)([\\/.]|$)'){continue}
  $target=Join-Path (Join-Path $qaRoot $part) $relative
  New-Item -ItemType Directory -Force -Path ([IO.Path]::GetDirectoryName($target))|Out-Null
  Copy-Item -LiteralPath $file.FullName -Destination $target
 }
}
New-Item -ItemType Directory -Force -Path (Join-Path $qaRoot 'Assets/LE04/Editor')|Out-Null
@{Project=$qaRoot;Temporary=$true;HubLaunched=$false;LiveProjectTouched=$false;SourceProject=$source;CreationUtc=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $PSScriptRoot 'unity-session-manifest.json') -Encoding utf8
@{status='PREPARED';project=$qaRoot;source=$source;hubEntryCreated=$false}|ConvertTo-Json
