param(
 [string]$Name='LE-04-source-v0.1-20261103.zip',
 [string]$ProjectConfigurationPath='',
 [string[]]$RequiredReports=@('editor-integration.json','editor-lifecycle.json','editor-reopen.json','performance-unity.json','workflow-evidence.json','workflow-reopen.json','delivery-audit.json'),
 [switch]$CheckOnly
)
$ErrorActionPreference='Stop'
$delivery=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).ProviderPath
$candidate=(Resolve-Path -LiteralPath (Join-Path $delivery 'candidate')).ProviderPath
if([string]::IsNullOrWhiteSpace($ProjectConfigurationPath)){$ProjectConfigurationPath=Join-Path $delivery 'qa/unity-session'}
$configuration=(Resolve-Path -LiteralPath $ProjectConfigurationPath).ProviderPath
if([IO.Path]::GetFileName($Name) -cne $Name -or -not $Name.EndsWith('.zip',[StringComparison]::OrdinalIgnoreCase)){throw 'A plain ZIP filename inside LE-04 is required.'}
$archive=Join-Path $delivery $Name
if(Test-Path -LiteralPath $archive){throw 'Existing deliveries are preserved. Choose a new ZIP filename.'}
$items=[Collections.Generic.List[object]]::new()
$entries=[Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
function Add-File([string]$source,[string]$entry){
 if(-not (Test-Path -LiteralPath $source -PathType Leaf)){throw ('Required payload missing: '+$source)}
 if($entry.StartsWith('/') -or $entry.Contains('\') -or $entry -match '(^|/)\.\.(/|$)' -or -not $entries.Add($entry)){throw ('Unsafe or duplicate archive entry: '+$entry)}
 $items.Add([pscustomobject]@{Source=(Resolve-Path -LiteralPath $source).ProviderPath;Entry=$entry})
}
function Add-Tree([string]$source,[string]$prefix,[string]$kind){
 if(-not (Test-Path -LiteralPath $source -PathType Container)){throw ('Required folder missing: '+$source)}
 $source=(Resolve-Path -LiteralPath $source).ProviderPath
 foreach($file in Get-ChildItem -LiteralPath $source -Recurse -File){
  $relative=$file.FullName.Substring($source.Length+1).Replace([char]92,[char]47)
  if($relative -match '(^|/)(Library|Temp|Logs|obj|bin|node_modules|\.git|Recovery|recovery|WorkScenes|unity-session|editor-compile|importer-static-compile|debug-frozen|frozen-debug)(/|$)'){continue}
  if($relative -match '(^|/)(WorkScenes|Recovery)(\.meta)?($|/)'){continue}
  if($file.Extension.ToLowerInvariant() -in @('.zip','.bak','.tmp','.dll','.exe','.pdb','.blend1','.blend2','.log','.err')){continue}
  if($kind -eq 'qa' -and $file.Extension.ToLowerInvariant() -notin @('.cs','.csproj','.ps1','.py','.cjs','.mjs','.js','.md','.json')){continue}
  if($kind -eq 'notes' -and $relative.StartsWith('baseline/')){continue}
  if($kind -eq 'reports' -and $relative -match '^package-(files|integrity|consistency)\.json$'){continue}
  if($kind -eq 'assets' -and $relative -match '^LE04/(Editor|QA|Tests)(/|$)'){throw ('QA-only scripts may not be staged as production assets: '+$relative)}
  Add-File $file.FullName ($prefix+'/'+$relative)
 }
}
function Source-Hash([string]$suffix){
 [string[]]$paths=@(Get-ChildItem -LiteralPath (Join-Path $candidate 'Assets/LE01') -Recurse -File|Where-Object {$_.Extension -eq $suffix}|ForEach-Object {$_.FullName})
 [Array]::Sort($paths,[StringComparer]::CurrentCulture)
 $all=@($paths|ForEach-Object {[IO.File]::ReadAllText($_)});$sha=[Security.Cryptography.SHA256]::Create()
 try{return [Convert]::ToHexString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes([string]::Join("`n",$all))))}finally{$sha.Dispose()}
}
Add-Tree (Join-Path $candidate 'Assets') 'candidate/Assets' 'assets'
Add-Tree (Join-Path $configuration 'Packages') 'candidate/Packages' 'configuration'
Add-Tree (Join-Path $configuration 'ProjectSettings') 'candidate/ProjectSettings' 'configuration'
foreach($part in @('references','samples','exports','review','reports','notes','qa')){Add-Tree (Join-Path $delivery $part) $part $part}
$baseline=Join-Path $delivery 'notes/baseline/Runtime/Core';if(Test-Path -LiteralPath $baseline){Add-Tree $baseline 'notes/baseline/Runtime/Core' 'baseline'}
foreach($part in @('overnight-plan','plan-explainer')){if(Test-Path -LiteralPath (Join-Path $delivery $part)){Add-Tree (Join-Path $delivery $part) $part 'page'}}
Add-File (Join-Path $delivery 'README.md') 'README.md'
$origin=(Resolve-Path -LiteralPath (Join-Path $delivery '../../..')).ProviderPath
Add-File (Join-Path $origin 'docs/superpowers/specs/2026-11-03-le04-terrain-reference-editor-design.md') 'docs/superpowers/specs/2026-11-03-le04-terrain-reference-editor-design.md'
Add-File (Join-Path $origin 'docs/superpowers/plans/2026-11-03-le04-overnight-terrain-editor.md') 'docs/superpowers/plans/2026-11-03-le04-overnight-terrain-editor.md'
Add-File (Join-Path $origin 'docs/tasks/LE-04.md') 'docs/tasks/LE-04.md'
$sourceHash=Source-Hash '.cs'
$combinedShaderHash=Source-Hash '.shader'
$versionText=[IO.File]::ReadAllText((Join-Path $configuration 'ProjectSettings/ProjectVersion.txt'))
$unityVersion=[regex]::Match($versionText,'(?m)^m_EditorVersion:\s*(\S+)').Groups[1].Value
$tuanjieVersion=[regex]::Match($versionText,'(?m)^m_TuanjieEditorVersion:\s*(\S+)').Groups[1].Value
$required=@(@('editor-integration.json','performance-unity.json','delivery-audit.json','workflow-evidence.json','workflow-reopen.json')+$RequiredReports|Sort-Object -Unique)
$problems=[Collections.Generic.List[string]]::new()
if(-not @($required|Where-Object {$_ -match 'reopen'}).Count){$problems.Add('The final gate list must include an independently reopened Editor report.')}
$audited=$null
foreach($report in $required){
 if([IO.Path]::GetFileName($report) -cne $report){throw ('Plain report filename required: '+$report)}
 $path=Join-Path $delivery ('reports/'+$report)
 if(-not(Test-Path -LiteralPath $path)){$problems.Add('Missing final report: '+$report);continue}
 $r=Get-Content -LiteralPath $path -Raw|ConvertFrom-Json
 if($r.status -ne 'PASS'){$problems.Add('Final report is not PASS: '+$report)}
 if($r.sourceHash -ne $sourceHash){$problems.Add('Final report has another source hash: '+$report)}
 if($r.engine -and $r.engine -ne $unityVersion){$problems.Add('Engine version mismatch: '+$report)}
 if($report -eq 'workflow-reopen.json' -and $r.reopened -ne $true){$problems.Add('Workflow evidence has not passed new-process reopening.')}
 if($report -eq 'performance-unity.json'){
  if($r.samples -lt 20 -or $r.warmup -lt 5 -or $r.leaves -ne 28968 -or $r.coldCompleteMs -gt 1200 -or @($r.summaries).Count -lt 2){$problems.Add('Performance fixture, sample count, or cold target is not satisfied.')}
  foreach($summary in $r.summaries){
   if($summary.samples -lt 20){$problems.Add('Performance summary lacks 20 measured samples.')}
   foreach($target in @('inputTarget','tickTarget','previewTarget','releaseTarget','undoTarget','cancelTarget','allocationTarget')){if($summary.PSObject.Properties[$target].Value -ne $true){$problems.Add('Performance target failed: '+$target+' at quantum '+$summary.quantumUnits)}}
  }
 }
 if($report -eq 'delivery-audit.json'){$audited=$r}
}
foreach($name in @('review-qa.json','fbx-independent.json')){if(-not(Test-Path -LiteralPath (Join-Path $delivery ('reports/'+$name)))){$problems.Add('Missing auxiliary report: '+$name)}}
if(Test-Path -LiteralPath (Join-Path $delivery 'reports/review-qa.json')){$review=Get-Content -LiteralPath (Join-Path $delivery 'reports/review-qa.json') -Raw|ConvertFrom-Json;if($review.status -ne 'PASS' -or $review.errors.Count -gt 0 -or $review.overflow -eq $true){$problems.Add('Review page check is not PASS.')}}
if(Test-Path -LiteralPath (Join-Path $delivery 'reports/fbx-independent.json')){$fbx=Get-Content -LiteralPath (Join-Path $delivery 'reports/fbx-independent.json') -Raw|ConvertFrom-Json;$fbxPath=Join-Path $delivery ('exports/'+[IO.Path]::GetFileName($fbx.file));if($fbx.pass -ne $true -or -not(Test-Path -LiteralPath $fbxPath) -or (Get-FileHash -LiteralPath $fbxPath -Algorithm SHA256).Hash -ne $fbx.sha256){$problems.Add('Independent FBX audit is stale or not PASS.')}}
$workflowPath=Join-Path $delivery 'reports/workflow-evidence.json'
if($null -ne $fbx -and (Test-Path -LiteralPath $workflowPath)){$workflow=Get-Content -LiteralPath $workflowPath -Raw|ConvertFrom-Json;if(('exports/'+[IO.Path]::GetFileName($fbx.file)) -cne $workflow.export){$problems.Add('Independent FBX audit does not certify the actual workflow export.')}}
$lockHash=(Get-FileHash -LiteralPath (Join-Path $configuration 'Packages/packages-lock.json') -Algorithm SHA256).Hash
$manifestHash=(Get-FileHash -LiteralPath (Join-Path $configuration 'Packages/manifest.json') -Algorithm SHA256).Hash
if($null -ne $audited){
 if($audited.packageLockHash -ne $lockHash -or $audited.packageManifestHash -ne $manifestHash){$problems.Add('The staged package configuration differs from the actual Editor audit.')}
 foreach($asset in $audited.dependencies){if($asset.path.StartsWith('Assets/')){foreach($pair in @(@($asset.path,$asset.fileSha256),@(($asset.path+'.meta'),$asset.metaSha256))){$path=Join-Path $candidate $pair[0];if(-not(Test-Path -LiteralPath $path) -or (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash -ne $pair[1]){$problems.Add('Audited native asset differs or is unstaged: '+$pair[0])}}}}
 foreach($file in $audited.sources){$base=if($file.path.StartsWith('ProjectSettings/') -or $file.path.StartsWith('Packages/')){$configuration}else{$candidate};$path=Join-Path $base $file.path;if(-not(Test-Path -LiteralPath $path) -or (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash -ne $file.sha256){$problems.Add('Audited source differs or is unstaged: '+$file.path)}}
 $guids=[Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal);foreach($asset in $audited.dependencies){[void]$guids.Add($asset.guid)}
 foreach($file in Get-ChildItem -LiteralPath (Join-Path $configuration 'ProjectSettings') -File -Filter '*.asset'){foreach($match in [regex]::Matches([IO.File]::ReadAllText($file.FullName),'\bguid:\s*([A-Fa-f0-9]{32})(?=[,\s}])')){$guid=$match.Groups[1].Value;if($guid -notmatch '^0{16}' -and -not $guids.Contains($guid)){$problems.Add('ProjectSettings dependency is not covered by the actual Engine audit: '+$file.Name+' -> '+$guid)}}}
}
if($CheckOnly){[pscustomobject]@{mode='CHECK_ONLY';archiveCreated=$false;sourceHash=$sourceHash;payloadFiles=$items.Count;unityVersion=$unityVersion;tuanjieVersion=$tuanjieVersion;gateProblems=@($problems)}|ConvertTo-Json -Depth 5;return}
if($problems.Count){throw ('Final evidence gates are not satisfied: '+[string]::Join('; ',$problems))}
$files=@($items|Sort-Object Entry|ForEach-Object {[pscustomobject]@{path=$_.Entry;bytes=(Get-Item -LiteralPath $_.Source).Length;sha256=(Get-FileHash -LiteralPath $_.Source -Algorithm SHA256).Hash}})
$manifest=[ordered]@{format='le04-source-package-v1';createdUtc=[DateTime]::UtcNow.ToString('O');sourceHash=$sourceHash;combinedShaderHash=$combinedShaderHash;shaderHash=$audited.shaderHash;engine=[ordered]@{unityVersion=$unityVersion;tuanjieVersion=$tuanjieVersion;projectVersionSha256=(Get-FileHash -LiteralPath (Join-Path $configuration 'ProjectSettings/ProjectVersion.txt') -Algorithm SHA256).Hash;packageManifestSha256=$manifestHash;packageLockSha256=$lockHash};requiredReports=$required;auxiliaryReports=@('review-qa.json','fbx-independent.json');nativeScene=$audited.scene;nativeDependencies=$audited.dependencies;files=$files;manifestSelfHash='Payload files are individually hashed; this manifest is covered by the archive SHA256 sidecar.'}
$manifestPath=Join-Path $delivery 'reports/package-files.json'
$manifest|ConvertTo-Json -Depth 12|Set-Content -LiteralPath $manifestPath -Encoding utf8
Add-Type -AssemblyName System.IO.Compression.FileSystem
$stream=[IO.File]::Open($archive,[IO.FileMode]::CreateNew)
$zip=[IO.Compression.ZipArchive]::new($stream,[IO.Compression.ZipArchiveMode]::Create,$false)
try{foreach($item in $items){[IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,$item.Source,('LE-04/'+$item.Entry),[IO.Compression.CompressionLevel]::Optimal)|Out-Null};[IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,$manifestPath,'LE-04/reports/package-files.json',[IO.Compression.CompressionLevel]::Optimal)|Out-Null}finally{$zip.Dispose();$stream.Dispose()}
$result=[ordered]@{status='CREATED_REQUIRES_VERIFY';archive=$archive;entries=$files.Count+1;bytes=(Get-Item -LiteralPath $archive).Length;sha256=(Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash;sourceHash=$sourceHash;projectCopied=$false}
$result|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $delivery 'reports/package-integrity.json') -Encoding utf8
($result.sha256+'  '+$Name)|Set-Content -LiteralPath ($archive+'.sha256') -Encoding utf8
$result|ConvertTo-Json







