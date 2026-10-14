param([string]$Study,[string]$Library,[string]$Python,[int]$Port=5294)
$ErrorActionPreference='Stop'
$repoRoot=(Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
if(!$Study){$Study=Join-Path $repoRoot 'work/参考研究/ReturnFromCore/24101688-RFCTILEGRAM02'}
if(!$Library){$Library=Join-Path $repoRoot 'work/参考研究/ReturnFromCore/24101688-RFCMAPEX01'}
if(!$Python){$Python='C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'}
foreach($p in @($Python,(Join-Path $Study 'gallery/data.json'),(Join-Path $Library 'tools/gallery_server.py'))){if(!(Test-Path -LiteralPath $p)){throw "Missing prerequisite: $p"}}
$health=$null
try{$health=Invoke-RestMethod "http://127.0.0.1:$Port/api/health" -TimeoutSec 2}catch{}
if($health.service -eq 'wall47-study/1'){Write-Output "http://127.0.0.1:$Port/gallery/artist-workflow.html";exit 0}
if(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue){throw "Port $Port belongs to another service; no process was stopped."}
$logRoot=Join-Path $Study 'validation'
New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
$argsList=@('-X','utf8',('"'+(Join-Path $PSScriptRoot 'serve.py')+'"'),'--study',('"'+$Study+'"'),'--library',('"'+$Library+'"'),'--port',$Port)
Start-Process -FilePath $Python -ArgumentList $argsList -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logRoot 'service-start.log') -RedirectStandardError (Join-Path $logRoot 'service-start-errors.log') | Out-Null
for($i=0;$i -lt 20;$i++){
 Start-Sleep -Milliseconds 200
 try{$health=Invoke-RestMethod "http://127.0.0.1:$Port/api/health" -TimeoutSec 1;if($health.service -eq 'wall47-study/1'){Write-Output "http://127.0.0.1:$Port/gallery/artist-workflow.html";exit 0}}catch{}
}
throw 'Startup failed; inspect validation/service-start-errors.log.'
