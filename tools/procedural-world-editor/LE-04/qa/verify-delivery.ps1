param([string]$Name='LE-04-source-v0.1-20261103.zip')
$ErrorActionPreference='Stop'
$delivery=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).ProviderPath
if([IO.Path]::GetFileName($Name) -cne $Name -or -not $Name.EndsWith('.zip',[StringComparison]::OrdinalIgnoreCase)){throw 'A plain ZIP filename inside LE-04 is required.'}
$archive=Join-Path $delivery $Name
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip=[IO.Compression.ZipFile]::OpenRead($archive)
function Entry([string]$path){$entry=$zip.GetEntry('LE-04/'+$path);if($null -eq $entry){throw ('Missing archive payload: '+$path)};return $entry}
function Read-Zip([string]$path){$reader=[IO.StreamReader]::new((Entry $path).Open());try{return $reader.ReadToEnd()}finally{$reader.Dispose()}}
function Entry-Hash([string]$path){$stream=(Entry $path).Open();$sha=[Security.Cryptography.SHA256]::Create();try{return [Convert]::ToHexString($sha.ComputeHash($stream))}finally{$stream.Dispose();$sha.Dispose()}}
function Source-Hash([string]$suffix){
 [string[]]$paths=@($zip.Entries|Where-Object {$_.FullName.StartsWith('LE-04/candidate/Assets/LE01/',[StringComparison]::Ordinal) -and $_.FullName.EndsWith($suffix,[StringComparison]::Ordinal)}|ForEach-Object {$_.FullName.Substring(6)})
 [Array]::Sort($paths,[StringComparer]::CurrentCulture);$texts=@($paths|ForEach-Object {Read-Zip $_});$sha=[Security.Cryptography.SHA256]::Create()
 try{return [Convert]::ToHexString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes([string]::Join("`n",$texts))))}finally{$sha.Dispose()}
}
try{
 $manifest=Read-Zip 'reports/package-files.json'|ConvertFrom-Json
 if($manifest.format -ne 'le04-source-package-v1'){throw 'Unknown source package manifest format.'}
 $seen=[Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
 foreach($entry in $zip.Entries){
  if(-not $entry.FullName.StartsWith('LE-04/',[StringComparison]::Ordinal) -or $entry.FullName.Contains('\') -or $entry.FullName -match '(^|/)\.\.(/|$)' -or -not $seen.Add($entry.FullName)){throw ('Unsafe or duplicate ZIP entry: '+$entry.FullName)}
  if($entry.FullName -match '(^|/)(Library|Temp|Logs|Recovery|recovery|WorkScenes|unity-session|node_modules|obj|bin|\.git|debug-frozen|frozen-debug)(/|$)' -or $entry.FullName -match '(^|/)(WorkScenes|Recovery)\.meta$'){throw ('Private or generated cache in ZIP: '+$entry.FullName)}
  if($entry.FullName -match '^LE-04/candidate/Assets/LE04/(Editor|QA|Tests)/'){throw ('QA script staged in production assets: '+$entry.FullName)}
 }
 if($zip.Entries.Count -ne $manifest.files.Count+1){throw 'Payload / manifest entry count mismatch.'}
 $manifestPaths=[Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
 foreach($file in $manifest.files){
  if(-not $manifestPaths.Add($file.path)){throw ('Duplicate payload manifest path: '+$file.path)}
  $entry=Entry $file.path
  if($entry.Length -ne $file.bytes -or (Entry-Hash $file.path) -ne $file.sha256){throw ('Payload SHA256 or length mismatch: '+$file.path)}
 }
 $sourceHash=Source-Hash '.cs';$combinedShaderHash=Source-Hash '.shader'
 if($sourceHash -ne $manifest.sourceHash -or $combinedShaderHash -ne $manifest.combinedShaderHash){throw 'Compiled source set differs from the package manifest.'}
 $required=@($manifest.requiredReports)
 foreach($name in @('editor-integration.json','performance-unity.json','delivery-audit.json','workflow-evidence.json','workflow-reopen.json')){if($name -notin $required){throw ('Missing mandatory final evidence gate: '+$name)}}
 if(-not @($required|Where-Object {$_ -match 'reopen'}).Count){throw 'No independent reopen evidence gate was declared.'}
 $audit=$null
 foreach($name in $required){
  if([IO.Path]::GetFileName($name) -cne $name){throw ('Invalid report filename: '+$name)}
  $r=Read-Zip ('reports/'+$name)|ConvertFrom-Json
  if($r.status -ne 'PASS' -or $r.sourceHash -ne $sourceHash){throw ('Stale or failed final report: '+$name)}
  if($r.engine -and $r.engine -ne $manifest.engine.unityVersion){throw ('Engine version mismatch: '+$name)}
  if($name -in @('workflow-evidence.json','workflow-reopen.json')){
   if($name -eq 'workflow-reopen.json' -and $r.reopened -ne $true){throw 'Workflow reopen evidence has not passed independent reopening.'}
   foreach($step in $r.steps){if($step.status -ne 'PASS' -or (Entry $step.image).Length -le 0){throw ('Missing or failed actual workflow step: '+$step.action)}}
   if($r.authorHash -eq '' -or $r.meshHash -eq ''){throw 'Workflow evidence has no author or mesh binding.'}
  }
  if($name -eq 'performance-unity.json'){
   if($r.samples -lt 20 -or $r.warmup -lt 5 -or $r.leaves -ne 28968 -or $r.coldCompleteMs -gt 1200 -or @($r.summaries).Count -lt 2){throw 'Performance fixture, sample count, or cold target was not satisfied.'}
   foreach($summary in $r.summaries){if($summary.samples -lt 20){throw 'Performance summary lacks 20 measured samples.'};foreach($target in @('inputTarget','tickTarget','previewTarget','releaseTarget','undoTarget','cancelTarget','allocationTarget')){if($summary.PSObject.Properties[$target].Value -ne $true){throw ('Performance target failed: '+$target+' at quantum '+$summary.quantumUnits)}}}
  }
  if($name -eq 'delivery-audit.json'){$audit=$r}
 }
 if($null -eq $audit -or $audit.scene -ne $manifest.nativeScene){throw 'Native Scene audit identity mismatch.'}
 if((Entry-Hash 'candidate/Packages/manifest.json') -ne $audit.packageManifestHash -or (Entry-Hash 'candidate/Packages/packages-lock.json') -ne $audit.packageLockHash){throw 'Package configuration differs from the actual Engine audit.'}
 if($manifest.engine.packageManifestSha256 -ne $audit.packageManifestHash -or $manifest.engine.packageLockSha256 -ne $audit.packageLockHash -or (Entry-Hash 'candidate/ProjectSettings/ProjectVersion.txt') -ne $manifest.engine.projectVersionSha256){throw 'Engine/package manifest hashes do not agree.'}
 $version=Read-Zip 'candidate/ProjectSettings/ProjectVersion.txt'
 if([regex]::Match($version,'(?m)^m_EditorVersion:\s*(\S+)').Groups[1].Value -ne $manifest.engine.unityVersion -or [regex]::Match($version,'(?m)^m_TuanjieEditorVersion:\s*(\S+)').Groups[1].Value -ne $manifest.engine.tuanjieVersion){throw 'Pinned Engine versions disagree.'}
 if($manifest.nativeDependencies.Count -ne $audit.dependencies.Count){throw 'Manifest native dependency count differs from the Engine audit.'}
 foreach($dep in $manifest.nativeDependencies){$match=@($audit.dependencies|Where-Object {$_.path -ceq $dep.path -and $_.guid -ceq $dep.guid});if($match.Count -ne 1 -or $match[0].fileSha256 -ne $dep.fileSha256 -or $match[0].metaSha256 -ne $dep.metaSha256){throw ('Manifest native dependency differs from the Engine audit: '+$dep.path)}}
 $lock=Read-Zip 'candidate/Packages/packages-lock.json'|ConvertFrom-Json
 $guids=[Collections.Generic.Dictionary[string,string]]::new([StringComparer]::Ordinal)
 $projectAssets=0;$packageAssets=0
 foreach($asset in $audit.dependencies){
  if([string]::IsNullOrWhiteSpace($asset.guid) -or $asset.fileSha256 -notmatch '^[A-Fa-f0-9]{64}$' -or $asset.metaSha256 -notmatch '^[A-Fa-f0-9]{64}$'){throw ('Incomplete AssetDatabase binding: '+$asset.path)}
  if($guids.ContainsKey($asset.guid) -and $guids[$asset.guid] -ne $asset.path){throw ('Ambiguous canonical GUID: '+$asset.guid)}
  $guids[$asset.guid]=$asset.path
  if($asset.path.StartsWith('Assets/')){
   if((Entry-Hash ('candidate/'+$asset.path)) -ne $asset.fileSha256 -or (Entry-Hash ('candidate/'+$asset.path+'.meta')) -ne $asset.metaSha256 -or (Entry ('candidate/'+$asset.path)).Length -ne $asset.size){throw ('Native asset bytes differ from AssetDatabase audit: '+$asset.path)}
   $projectAssets++
  }elseif($asset.path.StartsWith('Packages/')){
   $packageName=$asset.packageName;if([string]::IsNullOrEmpty($packageName)){$packageName=$asset.path.Split('/')[1]}
   $dep=$lock.dependencies.PSObject.Properties[$packageName]
   if($null -eq $dep -or [string]::IsNullOrWhiteSpace($asset.packageVersion) -or $dep.Value.version -ne $asset.packageVersion){throw ('Audited package is not pinned to the same version: '+$asset.path)}
   $packageAssets++
  }else{throw ('Unexpected dependency root: '+$asset.path)}
 }
 foreach($file in $audit.sources){if((Entry-Hash ('candidate/'+$file.path)) -ne $file.sha256 -or (Entry ('candidate/'+$file.path)).Length -ne $file.size){throw ('Audited source bytes differ: '+$file.path)}}
 $shaderFiles=@($audit.sources|Where-Object {$_.path.EndsWith('.shader')});if($shaderFiles.Count -eq 0 -or $audit.shaderHash -notin @($shaderFiles|ForEach-Object {$_.sha256}) -or $manifest.shaderHash -ne $audit.shaderHash){throw 'Actual shader audit is not bound to payload bytes.'}
 # Canonical GUIDs come from AssetDatabase. Tuanjie .meta GUID strings are opaque
 # and intentionally never decoded or assumed to be hexadecimal.
 $queue=[Collections.Generic.Queue[string]]::new();$queue.Enqueue($audit.scene)
 foreach($entry in $zip.Entries){if($entry.FullName.StartsWith('LE-04/candidate/ProjectSettings/',[StringComparison]::Ordinal) -and $entry.FullName.EndsWith('.asset',[StringComparison]::Ordinal)){$queue.Enqueue($entry.FullName.Substring('LE-04/candidate/'.Length))}}
 $visited=[Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
 while($queue.Count){
  $path=$queue.Dequeue();if(-not $visited.Add($path)){continue};if($path.StartsWith('Packages/')){continue};$file='candidate/'+$path;$null=Entry $file
  if([IO.Path]::GetExtension($path) -notin @('.unity','.asset','.mat','.prefab','.controller','.overrideController')){continue}
  $text=Read-Zip $file;if(-not $text.StartsWith('%YAML')){continue}
  foreach($m in [regex]::Matches($text,'\bguid:\s*([A-Fa-f0-9]{32})(?=[,\s}])')){
   $guid=$m.Groups[1].Value
   if($guid -match '^0{16}'){continue}
   if(-not $guids.ContainsKey($guid)){throw ('Unresolved canonical serialized GUID '+$guid+' in '+$path)}
   $queue.Enqueue($guids[$guid])
  }
 }
 $review=Read-Zip 'reports/review-qa.json'|ConvertFrom-Json
 if($review.status -ne 'PASS' -or $review.overflow -eq $true -or $review.errors.Count -gt 0){throw 'Review page QA is not PASS.'}
 foreach($img in $review.images){if($img.complete -ne $true -or $img.width -le 0){throw 'Review contains an unloaded image.'}}
 $fbx=Read-Zip 'reports/fbx-independent.json'|ConvertFrom-Json
 $fbxName=[IO.Path]::GetFileName($fbx.file)
 if($fbx.pass -ne $true -or (Entry-Hash ('exports/'+$fbxName)) -ne $fbx.sha256){throw 'Independent FBX audit is stale or not PASS.'}
 $mainEvidence=Read-Zip 'reports/workflow-evidence.json'|ConvertFrom-Json
 if(('exports/'+$fbxName) -cne $mainEvidence.export){throw 'Independent FBX audit does not certify the actual workflow export.'}
 $evidence=Read-Zip 'reports/workflow-reopen.json'|ConvertFrom-Json
 if($evidence.reopened -ne $true -or $mainEvidence.sourceHash -ne $evidence.sourceHash -or $mainEvidence.authorHash -ne $evidence.authorHash -or $mainEvidence.meshHash -ne $evidence.meshHash -or $evidence.authorHash -ne $audit.authorHash -or $evidence.meshHash -ne $audit.meshHash){throw 'Native Scene is not bound to reopened workflow evidence.'}
 $hash=(Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash
 $sidecar=(Get-Content -LiteralPath ($archive+'.sha256') -Raw).Trim()
 if($sidecar -notmatch '^([A-Fa-f0-9]{64})\s+' -or $Matches[1] -ne $hash){throw 'Archive SHA256 sidecar mismatch.'}
 $result=[ordered]@{status='PASS';archive=$archive;archiveSha256=$hash;sourceHash=$sourceHash;shaderHash=$audit.shaderHash;entries=$zip.Entries.Count;payloadFilesVerified=$manifest.files.Count;matchingFinalReports=$required.Count;projectDependencyAssets=$projectAssets;packageDependencyAssets=$packageAssets;canonicalGuidReferencesChecked=$visited.Count;assetMetaBoundToEditor=$true;opaqueMetaGuidDecoded=$false;fbxIndependentAudit=$true;workflowReopened=$true;forbiddenEntries=0;projectCreated=$false;checkedUtc=[DateTime]::UtcNow.ToString('O')}
 $result|ConvertTo-Json -Depth 5|Set-Content -LiteralPath (Join-Path $delivery 'reports/package-consistency.json') -Encoding utf8
 $result|ConvertTo-Json -Depth 5
}finally{$zip.Dispose()}







