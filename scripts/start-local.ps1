$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    if (Test-Path 'C:\Program Files\nodejs\node.exe') {
        $env:PATH = "C:\Program Files\nodejs;$env:PATH"
    } else {
        $runtimeNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin'
        if (Test-Path (Join-Path $runtimeNode 'node.exe')) { $env:PATH = "$runtimeNode;$env:PATH" }
        else { throw 'Install Node.js 22.12 or newer, then run this script again.' }
    }
}
if (-not (Test-Path '.env')) { Copy-Item '.env.example' '.env' }
if (-not (Test-Path 'node_modules')) { throw 'Run pnpm install once before starting the local app.' }
Write-Host 'Starting SafeLink AI. Open http://localhost:5173 . Close this terminal to stop.'
& node node_modules/concurrently/dist/bin/concurrently.js -k 'node --import tsx --watch server/index.ts' 'node node_modules/vite/bin/vite.js --host 0.0.0.0'
