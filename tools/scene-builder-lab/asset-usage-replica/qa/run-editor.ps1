param([Parameter(Mandatory=$true)][string]$Method,[Parameter(Mandatory=$true)][string]$Name,[switch]$Sync)
$ErrorActionPreference='Stop'
$root=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).ProviderPath
$qa=Join-Path $PSScriptRoot 'unity-session'
$base=[IO.Path]::GetFullPath((Join-Path $root '../SB-03/candidate'))
if($Method -notmatch '^XingHai\.BridgeReplica\.(QA|Editor)\.[A-Za-z0-9_.]+$' -or $Name -notmatch '^[A-Za-z0-9_-]+$'){throw 'Unexpected validation entry'}
if(@(Get-CimInstance Win32_Process -Filter "Name='Tuanjie.exe'"|Where-Object {$_.CommandLine -and $_.CommandLine.IndexOf($qa,[StringComparison]::OrdinalIgnoreCase) -ge 0}).Count){throw 'One QA Editor already running'}
function Copy-Tree([string]$source,[string]$dest){if(-not(Test-Path -LiteralPath $source)){return};$source=(Resolve-Path -LiteralPath $source).ProviderPath;foreach($f in Get-ChildItem -LiteralPath $source -Recurse -File){$r=$f.FullName.Substring($source.Length+1);$t=Join-Path $dest $r;New-Item -ItemType Directory -Force -Path ([IO.Path]::GetDirectoryName($t))|Out-Null;Copy-Item -LiteralPath $f.FullName -Destination $t}}
if(-not(Test-Path -LiteralPath (Join-Path $qa 'ProjectSettings/ProjectVersion.txt'))){
 foreach($part in @('Packages','ProjectSettings','Assets/SB03','Assets/LE01/Rendering')){Copy-Tree (Join-Path $base $part) (Join-Path $qa $part)}
 foreach($part in @('Assets/SB03.meta','Assets/LE01.meta','Assets/LE01/Rendering.meta')){if(Test-Path -LiteralPath (Join-Path $base $part)){Copy-Item -LiteralPath (Join-Path $base $part) -Destination (Join-Path $qa $part)}}
}
if($Sync){Copy-Tree (Join-Path $root 'candidate/Assets/BridgeReplica') (Join-Path $qa 'Assets/BridgeReplica')}
Copy-Tree (Join-Path $PSScriptRoot 'Editor') (Join-Path $qa 'Assets/BridgeReplica/Editor/QA')
New-Item -ItemType Directory -Force -Path (Join-Path $root 'reports')|Out-Null
$env:REPLICA_OUTPUT_ROOT=$root
$log=Join-Path $root ('reports/'+$Name+'.log')
$p=Start-Process -FilePath 'E:\unity\Tuanjie Hub\2022.3.62t16\Editor\Tuanjie.exe' -ArgumentList @('-batchmode','-projectPath',('"'+$qa+'"'),'-executeMethod',$Method,'-quit','-logFile',('"'+$log+'"')) -WindowStyle Hidden -PassThru
@{processId=$p.Id;log=$log;temporaryProject=$qa;desktopUsed=$false}|ConvertTo-Json
