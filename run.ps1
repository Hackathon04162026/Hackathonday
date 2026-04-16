param(
  [ValidateSet("dev", "build", "test")]
  [string]$Mode = "dev"
)

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$appRoot = Join-Path $repoRoot "migration-helper"
$nodeRoot = Join-Path $repoRoot "tools"
$npmCmd = Join-Path $nodeRoot "npm.cmd"

if (-not (Test-Path $npmCmd)) {
  throw "Portable Node runtime not found at $npmCmd"
}

$env:Path = "$nodeRoot;$env:Path"

Set-Location $appRoot

& $npmCmd install
if ($LASTEXITCODE -ne 0) {
  throw "npm install failed."
}

switch ($Mode) {
  "build" {
    & $npmCmd run build
    if ($LASTEXITCODE -ne 0) {
      throw "npm run build failed."
    }
  }
  "test" {
    & $npmCmd test
    if ($LASTEXITCODE -ne 0) {
      throw "npm test failed."
    }
  }
  default {
    & $npmCmd run dev
    if ($LASTEXITCODE -ne 0) {
      throw "npm run dev failed."
    }
  }
}
