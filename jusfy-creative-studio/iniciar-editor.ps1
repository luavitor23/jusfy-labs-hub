param([switch]$SkipOpen)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$prefix = "http://127.0.0.1:8765/"
$pidFile = Join-Path $root ".studio-server.pid"

function Test-Studio {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $prefix -TimeoutSec 2
    return $response.StatusCode -eq 200 -and $response.Content -match "Studio de Criativos"
  } catch {
    return $false
  }
}

if (Test-Studio) {
  if (-not $SkipOpen) { Start-Process $prefix }
  exit 0
}

$candidates = @(
  "C:\Users\vacca\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\pythonw.exe",
  "C:\Users\vacca\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe",
  (Get-Command pythonw.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue),
  (Get-Command python.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue),
  (Get-Command py.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue)
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -Unique

if (-not $candidates) {
  throw "Python não foi encontrado. Abra o Studio pelo Codex ou instale Python 3."
}

$server = Join-Path $root "studio-server.py"
$process = Start-Process -FilePath $candidates[0] -ArgumentList "`"$server`"" -WorkingDirectory $root -WindowStyle Hidden -PassThru
Set-Content -LiteralPath $pidFile -Value $process.Id -Encoding ascii

$ready = $false
for ($attempt = 0; $attempt -lt 20; $attempt += 1) {
  Start-Sleep -Milliseconds 150
  if (Test-Studio) { $ready = $true; break }
}

if (-not $ready) {
  if (-not $process.HasExited) { Stop-Process -Id $process.Id -Force }
  throw "O servidor local não iniciou na porta 8765."
}

if (-not $SkipOpen) { Start-Process $prefix }
