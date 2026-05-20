param(
  [Parameter(Mandatory = $true)]
  [string]$DatabaseUrl,

  [Parameter(Mandatory = $true)]
  [string]$MigrationPath,

  [string]$Label = "migration"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $MigrationPath)) {
  throw "Migration file not found: $MigrationPath"
}

if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
  throw "psql is not available in PATH. Install PostgreSQL client tools before applying migrations."
}

$backupScript = Join-Path $PSScriptRoot "backup-supabase.ps1"
& $backupScript -DatabaseUrl $DatabaseUrl -Label $Label

psql $DatabaseUrl -v ON_ERROR_STOP=1 -f $MigrationPath

Write-Output "Migration applied: $MigrationPath"
