param()
$ErrorActionPreference='Stop'
$root=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).ProviderPath
foreach($report in @('delivery-assembly.json','workflow-evidence.json','workflow-reopen.json','scene-input-tests.json','kit-engine.json','performance-unity.json','persistence.json','native-save-reopen.json')){
 $data=Get-Content -LiteralPath (Join-Path $root ('reports/'+$report)) -Raw|ConvertFrom-Json
 if($data.status -ne 'PASS'){throw ('Incomplete delivery evidence: '+$report)}
}
$archive=Join-Path $root 'SB-03-source-v0.1-20261103.zip'
$files=[Collections.Generic.List[object]]::new()
foreach($part in @('candidate','kit','qa','samples','review','notes','reports')){
 $folder=Join-Path $root $part;if(-not(Test-Path -LiteralPath $folder)){continue}
 foreach($file in Get-ChildItem -LiteralPath $folder -Recurse -File){
  $r=$file.FullName.Substring($root.Length+1).Replace('\','/')
  if($r -match '(^|/)(unity-session|Library|Temp|UserSettings|Logs|bin|obj)(/|$)' -or $r -match '\.(bak|blend1|log)$' -or $r -match '^reports/(protected-original-before|package-consistency|github-publication|cleanup[^/]*)\.json$'){continue}
  $files.Add([pscustomobject]@{path=$r;source=$file.FullName;sha256=(Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash;bytes=$file.Length})
 }
}
foreach($name in @('README.md','.gitattributes','.gitignore')){if(Test-Path -LiteralPath (Join-Path $root $name)){$f=Get-Item -LiteralPath (Join-Path $root $name);$files.Add([pscustomobject]@{path=$name;source=$f.FullName;sha256=(Get-FileHash -LiteralPath $f.FullName).Hash;bytes=$f.Length})}}
if(Test-Path -LiteralPath $archive){Move-Item -LiteralPath $archive -Destination ($archive+'.previous-'+[DateTime]::UtcNow.ToString('yyyyMMddHHmmss'))}
$stream=[IO.File]::Open($archive,[IO.FileMode]::CreateNew);$zip=[IO.Compression.ZipArchive]::new($stream,[IO.Compression.ZipArchiveMode]::Create)
try{foreach($file in $files){[IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,$file.source,$file.path,[IO.Compression.CompressionLevel]::Optimal)|Out-Null}}finally{$zip.Dispose();$stream.Dispose()}
$read=[IO.Compression.ZipFile]::OpenRead($archive)
try{
 if($read.Entries.Count -ne $files.Count){throw 'Archive entry count mismatch'}
 foreach($file in $files){$entry=$read.GetEntry($file.path);if($null -eq $entry -or $entry.Length -ne $file.bytes){throw ('Archive entry mismatch '+$file.path)};$s=$entry.Open();try{$sha=[Security.Cryptography.SHA256]::Create();$actual=[Convert]::ToHexString($sha.ComputeHash($s))}finally{$sha.Dispose();$s.Dispose()};if($actual -ne $file.sha256){throw ('Archive byte mismatch '+$file.path)}}
}finally{$read.Dispose()}
$hash=(Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash
$hash+'  '+[IO.Path]::GetFileName($archive)|Set-Content -LiteralPath ($archive+'.sha256') -Encoding utf8
$assembly=Get-Content -LiteralPath (Join-Path $root 'reports/delivery-assembly.json') -Raw|ConvertFrom-Json
$result=[ordered]@{status='PASS';archive=$archive;archiveSha256=$hash;bytes=(Get-Item -LiteralPath $archive).Length;entries=$files.Count;verifiedBytes=$true;sourceHash=$assembly.sourceHash;libraryIncluded=$false;userWorkAndRecoveryIncluded=$false;nativeSourcesIncluded=$true;desktopUsed=$false}
$result|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $root 'reports/package-consistency.json') -Encoding utf8
$result|ConvertTo-Json
