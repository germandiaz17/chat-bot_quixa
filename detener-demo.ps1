#Requires -Version 5.1
$Raiz = $PSScriptRoot
Set-Location $Raiz

function Info([string]$Texto, [string]$Color = 'Gray') { Write-Host $Texto -ForegroundColor $Color }

$pids = @()

foreach ($archivo in @('.n8n.pid', '.web.pid')) {
    $ruta = Join-Path $Raiz $archivo
    if (Test-Path $ruta) {
        $valor = (Get-Content $ruta -Raw -ErrorAction SilentlyContinue)
        if ($valor) {
            $valor = $valor.Trim()
            if ($valor -match '^\d+$') { $pids += [int]$valor }
        }
    }
}

# Respaldo: si no hay PID, busca quien ocupa los puertos de la demo.
foreach ($puerto in @(5678, 8080)) {
    $c = Get-NetTCPConnection -State Listen -LocalPort $puerto -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($c) { $pids += [int]$c.OwningProcess }
}

$pids = $pids | Sort-Object -Unique

if (-not $pids -or $pids.Count -eq 0) {
    Info 'No hay servicios de la demo corriendo.' 'Yellow'
} else {
    foreach ($p in $pids) {
        & taskkill /PID $p /T /F 2>$null | Out-Null
        Info "  detenido PID $p" 'Green'
    }
}

Remove-Item (Join-Path $Raiz '.n8n.pid'), (Join-Path $Raiz '.web.pid') -Force -ErrorAction SilentlyContinue

for ($i = 0; $i -lt 20; $i++) {
    $ocupado = $false
    foreach ($puerto in @(5678, 8080)) {
        $c = Get-NetTCPConnection -State Listen -LocalPort $puerto -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($c) { $ocupado = $true }
    }
    if (-not $ocupado) { break }
    Start-Sleep -Milliseconds 500
}

Info 'Todo detenido.' 'Green'
