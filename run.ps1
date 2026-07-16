# run.ps1 — Start LibraVault with all environment variables loaded
# Usage: Right-click → "Run with PowerShell"  OR  type: .\run.ps1

Write-Host "Loading environment variables..." -ForegroundColor Cyan

Get-Content ".env" | ForEach-Object {
    if ($_ -match '^([^#\s][^=]*)=(.*)$') {
        $key   = $matches[1].Trim()
        $value = $matches[2].Trim()
        [System.Environment]::SetEnvironmentVariable($key, $value, 'Process')
        Write-Host "  SET $key" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "Starting LibraVault..." -ForegroundColor Cyan
python app.py
