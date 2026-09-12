$ErrorActionPreference = 'Stop'
$stagedRoot = 'C:\Blog\blog-1988\tmp\aeo-skills'
$installedRoot = 'C:\Users\111\.codex\skills'
$hashes = @{
  'reading-desk-update' = @('AE52DB46CFA8A168269DF54DF0A25281D365B767E7BD5071544FBE81D2F0A9C4', '9638D1666FE91616A56CBDA8CE5AA38BB1704D37F923B51D78E40C216A9C45CC')
  'work-knowledge-blog-update' = @('ACE8E43F4D34646C8D6A1588545AE6E679B9806482DD62651D0A8893693BAC4F', 'B561C487081DE0579054689CB59FC874679D18731883B619181C30F50EAA8D7A')
}
foreach ($skillName in $hashes.Keys) {
  if ((Get-FileHash -LiteralPath (Join-Path $stagedRoot "$skillName\SKILL.md")).Hash -ne $hashes[$skillName][0]) { throw "Staging changed: $skillName" }
  if ((Get-FileHash -LiteralPath (Join-Path $installedRoot "$skillName\SKILL.md")).Hash -ne $hashes[$skillName][1]) { throw "Installed original changed: $skillName" }
}
$backupRoot = Join-Path ([IO.Path]::GetTempPath()) ('codex-blog-aeo-skills-backup-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $backupRoot | Out-Null
foreach ($skillName in $hashes.Keys) {
  Copy-Item -LiteralPath (Join-Path $installedRoot "$skillName\SKILL.md") -Destination (Join-Path $backupRoot "$skillName-SKILL.md")
}
foreach ($skillName in $hashes.Keys) {
  $installedFile = Join-Path $installedRoot "$skillName\SKILL.md"
  Copy-Item -LiteralPath (Join-Path $stagedRoot "$skillName\SKILL.md") -Destination $installedFile -Force
  if ((Get-FileHash -LiteralPath $installedFile).Hash -ne $hashes[$skillName][0]) { throw "Install failed: $skillName" }
  Write-Output "Installed and verified: $skillName"
}
Write-Output "Backup: $backupRoot"
