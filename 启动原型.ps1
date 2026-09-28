param([int]$Port = 5173, [switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$gamePath = Join-Path $projectRoot 'game'
$logPath = Join-Path $projectRoot '记录'
$pidFile = Join-Path $logPath '开发服务.json'
New-Item -ItemType Directory -Force -Path $logPath | Out-Null
$url = "http://127.0.0.1:$Port"
function Write-LaunchLog([string]$Message) {
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $Message"
    Add-Content -LiteralPath (Join-Path $logPath '启动日志.log') -Value $line -Encoding UTF8
    Write-Host $Message
}
try {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw '请先安装 Node.js 22.12 或更新的兼容版本。' }
    $nodePath = (Get-Command node).Source
    $vitePath = Join-Path $gamePath 'node_modules\vite\bin\vite.js'
    if (-not (Test-Path -LiteralPath $vitePath)) {
        Push-Location -LiteralPath $gamePath
        try { & npm.cmd ci --cache (Join-Path $projectRoot 'work\npm-cache'); if ($LASTEXITCODE -ne 0) { throw '依赖安装失败。' } } finally { Pop-Location }
    }
    $listeners = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
    $serverProcessId = $null
    if ($listeners.Count) {
        $ownerIds = @($listeners.OwningProcess | Select-Object -Unique)
        foreach ($ownerId in $ownerIds) {
            $existingProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$ownerId"
            $matchedVitePath = $null
            if ($existingProcess -and $existingProcess.CommandLine -match '"([^"\r\n]*vite[\\/]bin[\\/]vite\.js)"') { $matchedVitePath = [IO.Path]::GetFullPath($Matches[1]) }
            if (-not $matchedVitePath -or -not $matchedVitePath.Equals($vitePath, [StringComparison]::OrdinalIgnoreCase)) {
                throw "端口 $Port 被其他程序占用（PID $ownerId）。未终止该程序，请换端口或自行检查。"
            }
            $serverProcessId = $ownerId
        }
        Write-LaunchLog "复用本项目服务 PID $serverProcessId。"
    } else {
        $arguments = '"' + $vitePath + '" --host 127.0.0.1 --port ' + $Port + ' --strictPort'
        $process = Start-Process -FilePath $nodePath -ArgumentList $arguments -WorkingDirectory $gamePath -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logPath '开发服务.log') -RedirectStandardError (Join-Path $logPath '开发服务错误.log') -PassThru
        $serverProcessId = $process.Id
        Write-LaunchLog "已后台启动服务 PID $serverProcessId，等待 HTTP 就绪。"
    }
    $ready = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        if (-not (Get-Process -Id $serverProcessId -ErrorAction SilentlyContinue)) { throw '服务已退出，请查看 记录/开发服务错误.log。' }
        try {
            $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -eq 200 -and $response.Content -match '/src/main.ts') { $ready = $true; break }
        } catch { }
        Start-Sleep -Milliseconds 500
    }
    if (-not $ready) { throw "服务未在等待期内就绪：$url。请查看服务日志。" }
    @{ pid = $serverProcessId; port = $Port; url = $url; vitePath = $vitePath; started = (Get-Date -Format o) } | ConvertTo-Json | Set-Content -LiteralPath $pidFile -Encoding UTF8
    Write-LaunchLog "HTTP 200 已验证，原型地址：$url"
    if (-not $NoBrowser) { Start-Process $url }
} catch {
    Write-LaunchLog ('启动失败：' + $_.Exception.Message)
    exit 1
}

