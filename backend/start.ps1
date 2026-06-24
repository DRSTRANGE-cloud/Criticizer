# Start Criticizer API on port 8000 (must match frontend REACT_APP_BACKEND_URL)
Set-Location $PSScriptRoot
if (-not (Test-Path ".\.venv\Scripts\Activate.ps1")) {
    Write-Error "Run: python -m venv .venv  then  pip install -r requirements.txt"
    exit 1
}
.\.venv\Scripts\Activate.ps1
Write-Host "Starting API at http://localhost:8000" -ForegroundColor Green
uvicorn server:app --reload --host 127.0.0.1 --port 8000
