Param()

$ErrorActionPreference = "Stop"

try {
  $name = git config user.name
  $email = git config user.email
} catch {
  Write-Host "[SKIP] git is not available in current context." -ForegroundColor Yellow
  exit 0
}

if ([string]::IsNullOrWhiteSpace($name) -or [string]::IsNullOrWhiteSpace($email)) {
  Write-Host "[FORBIDDEN] git user.name/user.email is not configured." -ForegroundColor Red
  exit 1
}

Write-Host "[OK] git author is configured."
Write-Host "name : $name"
Write-Host "email: $email"

Write-Host "Tip: CI/PR review process should enforce user-based author requirement."
