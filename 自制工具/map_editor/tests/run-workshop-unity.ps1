param([Parameter(Mandatory=$true)][string[]]$Methods,[string]$LogPrefix='regression')
$ErrorActionPreference='Stop'
$taskDirectory=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskProject=Join-Path $taskDirectory 'validation/TuanjieProject'
$taskEditor='E:\unity\Tuanjie Hub\2022.3.62t13\Editor\Tuanjie.exe'
if($LogPrefix -notmatch '^[A-Za-z0-9_-]+$'){throw 'Invalid log prefix'}
Set-Location -LiteralPath $taskDirectory
$taskResults=@()
foreach($taskMethod in $Methods){
 if($taskMethod -notmatch '^[A-Za-z0-9_.]+$'){throw 'Invalid execute method'}
 $taskActive=Get-CimInstance Win32_Process -Filter "Name='Tuanjie.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Replace('\','/').Contains($taskProject.Replace('\','/')) }
 if($taskActive){throw 'Verification project is already open'}
 $taskLeaf=$taskMethod.Replace('Xinghai.MapEditor.Editor.','').Replace('.','-')
 $taskLog=Join-Path $taskDirectory "validation/workshop-task8/$LogPrefix-$taskLeaf.log"
 $taskProcess=Start-Process -FilePath $taskEditor -ArgumentList @('-batchmode','-projectPath',('"'+$taskProject+'"'),'-executeMethod',$taskMethod,'-logFile',('"'+$taskLog+'"')) -WindowStyle Hidden -Wait -PassThru
 $taskExpected=if($taskMethod.EndsWith('WorkshopRecoveryProof.Interrupt')){73}else{0}
 $taskResults+=@{method=$taskMethod;exitCode=$taskProcess.ExitCode;expected=$taskExpected;log=$taskLog}
 $taskResults | ConvertTo-Json | Set-Content "validation/workshop-task8/$LogPrefix-results.json" -Encoding utf8
 if($taskProcess.ExitCode -ne $taskExpected){throw "Proof failed: $taskMethod, exit $($taskProcess.ExitCode). See $taskLog"}
 Write-Output "$taskMethod PASS ($taskExpected)"
}
