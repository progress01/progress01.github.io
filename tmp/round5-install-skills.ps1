$ErrorActionPreference = 'Stop'
$stagedRoot = 'C:\Blog\blog-1988\tmp\round5-skills'
$installedRoot = 'C:\Users\111\.codex\skills'
$expectedHashes = @{
    'blogger-import-update' = 'E087F90787A5F8CBC9E8512946E047102B251B5BC76ED066FD3356CEC1E77200'
    'song-blog-update' = '2B69F0BDC8C0C6FAAC096E89AD5E7776A2E85555C6A6B043FB0C99783FCC1202'
    'reading-desk-update' = '9638D1666FE91616A56CBDA8CE5AA38BB1704D37F923B51D78E40C216A9C45CC'
    'n-plus-days-blog-update' = '20F8418CA7B381D734A2B53903C5B91056CEDBA7FD4F47E9297529BD8CEE3774'
    'work-knowledge-blog-update' = 'B561C487081DE0579054689CB59FC874679D18731883B619181C30F50EAA8D7A'
}
foreach ($skillName in $expectedHashes.Keys) {
    $stagedFile = Join-Path $stagedRoot "$skillName\SKILL.md"
    $installedFile = Join-Path $installedRoot "$skillName\SKILL.md"
    if ((Get-FileHash -LiteralPath $stagedFile).Hash -ne $expectedHashes[$skillName]) { throw "Staged skill changed: $skillName" }
    if (-not (Test-Path -LiteralPath $installedFile -PathType Leaf)) { throw "Installed skill missing: $skillName" }
}
$backupRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('codex-blog-skills-round5-backup-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $backupRoot | Out-Null
foreach ($skillName in $expectedHashes.Keys) {
    Copy-Item -LiteralPath (Join-Path $installedRoot "$skillName\SKILL.md") -Destination (Join-Path $backupRoot "$skillName-SKILL.md")
}
foreach ($skillName in $expectedHashes.Keys) {
    $installedFile = Join-Path $installedRoot "$skillName\SKILL.md"
    Copy-Item -LiteralPath (Join-Path $stagedRoot "$skillName\SKILL.md") -Destination $installedFile -Force
    if ((Get-FileHash -LiteralPath $installedFile).Hash -ne $expectedHashes[$skillName]) { throw "Install verification failed: $skillName" }
    Write-Output "Installed and verified: $skillName"
}
Write-Output "Backup: $backupRoot"
