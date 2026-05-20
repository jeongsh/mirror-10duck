param(
  [Parameter(Mandatory = $true)]
  [string]$DatabaseUrl,

  [string]$Label = "manual"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
  throw "pg_dump is not available in PATH. Install PostgreSQL client tools before running this backup."
}

$safeLabel = $Label -replace '[^a-zA-Z0-9_-]', '-'
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = Join-Path "backups" "supabase-$safeLabel-$stamp"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

$schemaPath = Join-Path $backupDir "schema.sql"
$dataPath = Join-Path $backupDir "data.sql"

pg_dump $DatabaseUrl --schema-only --no-owner --no-privileges --file $schemaPath
pg_dump $DatabaseUrl --data-only --no-owner --no-privileges --file $dataPath

Write-Output "Backup created: $backupDir"
