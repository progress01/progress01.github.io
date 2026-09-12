$ErrorActionPreference = 'Stop'
$stagedRoot = 'C:\Blog\blog-1988\tmp\round4-skills'
$installedRoot = 'C:\Users\111\.codex\skills'
$expectedHashes = @{
    'blogger-import-update' = 'C6B375FDB1C856D62A696AB0EA9FC0AEC0CBF4DA2B73D4B12960F9B7253DE79E'
    'song-blog-update' = '8DAEA4971041B8D39524481E1B2ADA6E2580A5166CF168C2A626A605A5AFB259'
}
foreach ($skillName in $expectedHashes.Keys) {
    $stagedFile = Join-Path $stagedRoot "$skillName\SKILL.md"
    $installedFile = Join-Path $installedRoot "$skillName\SKILL.md"
    if ((Get-FileHash -LiteralPath $stagedFile).Hash -ne $expectedHashes[$skillName]) { throw "Staged skill changed: $skillName" }
    if (-not (Test-Path -LiteralPath $installedFile -PathType Leaf)) { throw "Installed skill missing: $skillName" }
}
$backupRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('codex-blog-skills-round4-backup-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $backupRoot | Out-Null
foreach ($skillName in $expectedHashes.Keys) {
    $installedFile = Join-Path $installedRoot "$skillName\SKILL.md"
    Copy-Item -LiteralPath $installedFile -Destination (Join-Path $backupRoot "$skillName-SKILL.md")
}
foreach ($skillName in $expectedHashes.Keys) {
    $installedFile = Join-Path $installedRoot "$skillName\SKILL.md"
    Copy-Item -LiteralPath (Join-Path $stagedRoot "$skillName\SKILL.md") -Destination $installedFile -Force
    if ((Get-FileHash -LiteralPath $installedFile).Hash -ne $expectedHashes[$skillName]) { throw "Install verification failed: $skillName" }
    Write-Output "Installed and verified: $skillName"
}
Write-Output "Backup: $backupRoot"
