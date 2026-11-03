param([Parameter(Mandatory=$true)][string]$Method,[Parameter(Mandatory=$true)][string]$Name,[switch]$Sync,[switch]$Async)
$ErrorActionPreference='Stop'
$delivery=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$qaProject=Join-Path $PSScriptRoot 'unity-session'
if(-not(Test-Path -LiteralPath (Join-Path $qaProject 'ProjectSettings/ProjectVersion.txt'))){& (Join-Path $PSScriptRoot 'prepare-validation-project.ps1')|Out-Null}
if($Method -notmatch '^XingHai\.(LE04\.QA|LE01\.Editor)\.LE04[A-Za-z0-9_.]+$' -or $Name -notmatch '^[A-Za-z0-9_-]+$'){throw 'Invalid validation entry'}
$running=@(Get-CimInstance Win32_Process -Filter "Name='Tuanjie.exe'"|Where-Object {$_.CommandLine -like ('*'+$qaProject+'*')})
if($running.Count){throw 'QA process still running; no editor is closed'}
if($Sync){
 $source=(Resolve-Path -LiteralPath (Join-Path $delivery 'candidate/Assets')).Path
 foreach($file in Get-ChildItem -LiteralPath $source -Recurse -File){$relative=$file.FullName.Substring($source.Length+1);$target=Join-Path (Join-Path $qaProject 'Assets') $relative;New-Item -ItemType Directory -Force -Path ([IO.Path]::GetDirectoryName($target))|Out-Null;Copy-Item -LiteralPath $file.FullName -Destination $target}
}
foreach($file in Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'Editor') -Filter '*.cs' -File){Copy-Item -LiteralPath $file.FullName -Destination (Join-Path $qaProject ('Assets/LE04/Editor/'+$file.Name))}
$env:LE04_REPORT_ROOT=Join-Path $delivery 'reports';$env:LE04_OUTPUT_ROOT=$delivery
$log=Join-Path $delivery ('reports/'+$Name+'.log')
$arguments=@('-batchmode','-projectPath',$qaProject,'-executeMethod',$Method,'-logFile',$log);if(-not $Async){$arguments+='-quit'}
$process=Start-Process -FilePath 'E:\unity\Tuanjie Hub\2022.3.62t16\Editor\Tuanjie.exe' -ArgumentList $arguments -WindowStyle Hidden -PassThru
[pscustomobject]@{ProcessId=$process.Id;Log=$log;Method=$Method;LiveProjectTouched=$false}|ConvertTo-Json
