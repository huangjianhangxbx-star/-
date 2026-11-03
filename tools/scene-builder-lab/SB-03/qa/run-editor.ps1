param([Parameter(Mandatory=$true)][string]$Method,[Parameter(Mandatory=$true)][string]$Name,[switch]$Sync,[switch]$Async)
$ErrorActionPreference='Stop'
$delivery=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).ProviderPath
$qaProject=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'unity-session'))
if($Method -notmatch '^XingHai\.SB03\.(QA|Editor)\.SB03[A-Za-z0-9_.]+$' -or $Name -notmatch '^[A-Za-z0-9_-]+$'){throw 'Invalid SB-03 validation entry.'}
if(-not(Test-Path -LiteralPath (Join-Path $qaProject 'ProjectSettings/ProjectVersion.txt'))){& (Join-Path $PSScriptRoot 'prepare-validation-project.ps1')|Out-Null}
$running=@(Get-CimInstance Win32_Process -Filter "Name='Tuanjie.exe' OR Name='Unity.exe'"|Where-Object {$_.CommandLine -and $_.CommandLine.Replace('/','\').IndexOf($qaProject.Replace('/','\'),[StringComparison]::OrdinalIgnoreCase) -ge 0})
if($running.Count){throw 'The QA process is still running; no editor has been closed.'}
if($Sync){
 $source=Join-Path $delivery 'candidate/Assets/SB03'
 if(Test-Path -LiteralPath $source){
  $source=(Resolve-Path -LiteralPath $source).ProviderPath
  foreach($file in Get-ChildItem -LiteralPath $source -Recurse -File){$relative=$file.FullName.Substring($source.Length+1);$target=Join-Path (Join-Path $qaProject 'Assets/SB03') $relative;New-Item -ItemType Directory -Force -Path ([IO.Path]::GetDirectoryName($target))|Out-Null;Copy-Item -LiteralPath $file.FullName -Destination $target}
 }
 $rootMeta=Join-Path $delivery 'candidate/Assets/SB03.meta';if(Test-Path -LiteralPath $rootMeta){Copy-Item -LiteralPath $rootMeta -Destination (Join-Path $qaProject 'Assets/SB03.meta')}
}
$qaEditor=Join-Path $qaProject 'Assets/SB03/Editor/QA';New-Item -ItemType Directory -Force -Path $qaEditor|Out-Null
foreach($file in Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'Editor') -Filter '*.cs' -File){Copy-Item -LiteralPath $file.FullName -Destination (Join-Path $qaEditor $file.Name)}
$env:SB03_REPORT_ROOT=Join-Path $delivery 'reports';$env:SB03_OUTPUT_ROOT=$delivery
$log=Join-Path $delivery ('reports/'+$Name+'.log')
$arguments=@('-batchmode','-projectPath',('"'+$qaProject+'"'),'-executeMethod',$Method,'-logFile',('"'+$log+'"'));if(-not $Async){$arguments+='-quit'}
$process=Start-Process -FilePath 'E:\unity\Tuanjie Hub\2022.3.62t16\Editor\Tuanjie.exe' -ArgumentList $arguments -WindowStyle Hidden -PassThru
[pscustomobject]@{ProcessId=$process.Id;Log=$log;Method=$Method;Project=$qaProject;LiveProjectTouched=$false;FormalProjectTouched=$false;DesktopUsed=$false}|ConvertTo-Json
