Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($args.Count -ne 0) {
  throw 'This installer has no arguments; all six skill paths are fixed.'
}

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$stageRoot = Join-Path $repoRoot 'tmp\excerpt-skills'
$manifestPath = Join-Path $repoRoot 'tmp\excerpt-skill-before.json'
$externalRoot = 'C:\Users\111\.codex\skills'
$legacyNames = @(
  'song-blog-update',
  'blogger-import-update',
  'n-plus-days-blog-update',
  'reading-desk-update',
  'work-knowledge-blog-update'
)

if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) { throw "Missing manifest: $manifestPath" }
if (-not (Test-Path -LiteralPath $stageRoot -PathType Container)) { throw "Missing staging root: $stageRoot" }
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json

function Assert-Hash([string]$path, [string]$expected, [string]$label) {
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Missing ${label}: $path" }
  $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash.ToLowerInvariant()
  if ($actual -ne $expected.ToLowerInvariant()) {
    throw "SHA-256 mismatch for ${label}: $path (expected $expected, got $actual)"
  }
}

# Complete every read-only check before creating or overwriting any target.
foreach ($name in $legacyNames) {
  $entry = $manifest.PSObject.Properties[$name]
  if ($null -eq $entry -or [string]::IsNullOrWhiteSpace([string]$entry.Value)) { throw "Manifest has no SHA-256 for $name" }
  $sourceSkill = Join-Path $externalRoot "$name\SKILL.md"
  $stagedSkill = Join-Path $stageRoot "$name\SKILL.md"
  Assert-Hash $sourceSkill ([string]$entry.Value) "installed $name SKILL.md"
  if (-not (Test-Path -LiteralPath $stagedSkill -PathType Leaf)) { throw "Missing staged $name SKILL.md: $stagedSkill" }
}

$newStageSkill = Join-Path $stageRoot 'blog-excerpt-check\SKILL.md'
$newStageYaml = Join-Path $stageRoot 'blog-excerpt-check\agents\openai.yaml'
if (-not (Test-Path -LiteralPath $newStageSkill -PathType Leaf)) { throw "Missing staged blog-excerpt-check SKILL.md: $newStageSkill" }
if (-not (Test-Path -LiteralPath $newStageYaml -PathType Leaf)) { throw "Missing staged blog-excerpt-check openai.yaml: $newStageYaml" }

$newTarget = Join-Path $externalRoot 'blog-excerpt-check'
if (Test-Path -LiteralPath $newTarget) {
  if (-not (Test-Path -LiteralPath $newTarget -PathType Container)) { throw "New skill target is not a directory: $newTarget" }
  Assert-Hash (Join-Path $newTarget 'SKILL.md') ((Get-FileHash -Algorithm SHA256 -LiteralPath $newStageSkill).Hash) 'existing blog-excerpt-check SKILL.md'
  Assert-Hash (Join-Path $newTarget 'agents\openai.yaml') ((Get-FileHash -Algorithm SHA256 -LiteralPath $newStageYaml).Hash) 'existing blog-excerpt-check agents/openai.yaml'
}

# Only the six fixed destinations below are written, after all preflight checks pass.
foreach ($name in $legacyNames) {
  Copy-Item -LiteralPath (Join-Path $stageRoot "$name\SKILL.md") -Destination (Join-Path $externalRoot "$name\SKILL.md") -Force
}

New-Item -ItemType Directory -Path (Join-Path $newTarget 'agents') -Force | Out-Null
Copy-Item -LiteralPath $newStageSkill -Destination (Join-Path $newTarget 'SKILL.md') -Force
Copy-Item -LiteralPath $newStageYaml -Destination (Join-Path $newTarget 'agents\openai.yaml') -Force
Write-Output 'Installed six excerpt skills after SHA-256 preflight.'
