# cleanup-round39.ps1 — removes the files made obsolete by Round 39 (Filipino removed).
# Preview only:   .\cleanup-round39.ps1
# Really delete:  .\cleanup-round39.ps1 -Delete
param([switch]$Delete)

$root = $PSScriptRoot
# Safety: only run from the Isnabero project root
if (-not ((Test-Path (Join-Path $root "pnpm-workspace.yaml")) -and (Test-Path (Join-Path $root "apps\web\src")))) {
  Write-Host "Run this from the Isnabero project root (pnpm-workspace.yaml and apps\web\src not found)." -ForegroundColor Red
  exit 1
}

# Exact targets, relative to the project root
$targets = @(
  "apps\web\src\i18n\locales\fil",
  "apps\web\src\i18n\languages.ts",
  "apps\web\src\i18n\dictionaries.ts",
  "apps\web\src\i18n\locales\en\language.ts",
  "apps\web\src\stores\language-store.ts",
  "apps\web\src\components\LanguageSwitcher.tsx"
)

foreach ($relative in $targets) {
  $full = Join-Path $root $relative
  if (-not (Test-Path $full)) { Write-Host "already gone : $relative"; continue }
  if ($Delete) {
    Remove-Item -LiteralPath $full -Recurse -Force
    if (Test-Path $full) { Write-Host "FAILED       : $relative" -ForegroundColor Red } else { Write-Host "deleted      : $relative" -ForegroundColor Green }
  } else {
    Write-Host "would delete : $relative" -ForegroundColor Yellow
  }
}
if (-not $Delete) { Write-Host "`nPreview only. Run  .\cleanup-round39.ps1 -Delete  to remove them." }
