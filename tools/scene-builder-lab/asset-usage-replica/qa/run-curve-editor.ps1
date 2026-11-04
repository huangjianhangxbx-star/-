param(
    [Parameter(Mandatory=$true)][string]$Method,
    [Parameter(Mandatory=$true)][string]$Name,
    [switch]$Sync,
    [switch]$PrepareOnly
)
$ErrorActionPreference='Stop'
$curveRoot=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).ProviderPath
$qaRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'unity-session'))
$researchRoot=[IO.Path]::GetFullPath((Join-Path $curveRoot '../../procedural-world-editor/LE-01/星骸地编'))
$editorExe='E:\unity\Tuanjie Hub\2022.3.62t16\Editor\Tuanjie.exe'
if($Method -notmatch '^XingHai\.BridgeReplica\.QA\.[A-Za-z0-9_.]+$' -or $Name -notmatch '^[A-Za-z0-9_-]+$'){throw 'Unexpected validation entry or output name'}
if(-not(Test-Path -LiteralPath (Join-Path $researchRoot 'ProjectSettings/ProjectVersion.txt'))){throw 'The renamed research project is missing'}
if((Test-Path -LiteralPath $qaRoot) -and (Get-Item -LiteralPath $qaRoot).LinkType){throw 'Temporary QA project cannot be a link or junction'}
$runningEditors=@(Get-CimInstance Win32_Process | Where-Object {$_.Name -match '^(?:Tuanjie|Unity)\.exe$'})
if(@($runningEditors|Where-Object {$_.CommandLine -and $_.CommandLine.IndexOf($qaRoot,[StringComparison]::OrdinalIgnoreCase) -ge 0}).Count){throw 'The unique QA Editor is already running'}
function Copy-CurveTree([string]$source,[string]$destination){
    if(-not(Test-Path -LiteralPath $source)){throw ('Required source is missing: '+$source)}
    $source=(Resolve-Path -LiteralPath $source).ProviderPath
    $destination=[IO.Path]::GetFullPath($destination)
    if(-not $destination.StartsWith($qaRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Copy target escaped the QA project'}
    foreach($file in Get-ChildItem -LiteralPath $source -Recurse -File){
        if($file.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Linked source is not a QA input'}
        $relative=$file.FullName.Substring($source.Length+1)
        if($relative -match '(^|[\\/])Editor[\\/]QA([\\/]|$)'){continue}
        $target=Join-Path $destination $relative
        New-Item -ItemType Directory -Force -Path ([IO.Path]::GetDirectoryName($target))|Out-Null
        Copy-Item -LiteralPath $file.FullName -Destination $target
    }
}
$isNew=-not(Test-Path -LiteralPath (Join-Path $qaRoot 'ProjectSettings/ProjectVersion.txt'))
if($isNew){
    foreach($part in @('Packages','ProjectSettings','Assets/SB03','Assets/LE01/Rendering')){Copy-CurveTree (Join-Path $researchRoot $part) (Join-Path $qaRoot $part)}
    foreach($part in @('Assets/SB03.meta','Assets/LE01.meta','Assets/LE01/Rendering.meta')){
        $source=Join-Path $researchRoot $part
        if(Test-Path -LiteralPath $source){Copy-Item -LiteralPath $source -Destination (Join-Path $qaRoot $part)}
    }
}
if($isNew -or $Sync){
    Copy-CurveTree (Join-Path $curveRoot 'candidate/Assets/BridgeReplica') (Join-Path $qaRoot 'Assets/BridgeReplica')
    $replicaMeta=Join-Path $curveRoot 'candidate/Assets/BridgeReplica.meta'
    if(Test-Path -LiteralPath $replicaMeta){Copy-Item -LiteralPath $replicaMeta -Destination (Join-Path $qaRoot 'Assets/BridgeReplica.meta')}
}
Copy-CurveTree (Join-Path $PSScriptRoot 'CurveEditor') (Join-Path $qaRoot 'Assets/BridgeReplica/Editor/QA')
New-Item -ItemType Directory -Force -Path (Join-Path $curveRoot 'reports')|Out-Null
if($PrepareOnly){@{status='PREPARED';temporaryProject=$qaRoot;sourceProject=$researchRoot;desktopUsed=$false;editorStarted=$false}|ConvertTo-Json;return}
if(-not(Test-Path -LiteralPath $editorExe)){throw 'Expected installed Tuanjie Editor is missing'}
$env:REPLICA_OUTPUT_ROOT=$curveRoot
$env:CURVE_OUTPUT_ROOT=$curveRoot
$logPath=Join-Path $curveRoot ('reports/'+$Name+'.log')
$process=Start-Process -FilePath $editorExe -ArgumentList @('-batchmode','-projectPath',('"'+$qaRoot+'"'),'-executeMethod',$Method,'-quit','-logFile',('"'+$logPath+'"')) -WindowStyle Hidden -PassThru
@{processId=$process.Id;log=$logPath;temporaryProject=$qaRoot;desktopUsed=$false;editorStarted=$true}|ConvertTo-Json
