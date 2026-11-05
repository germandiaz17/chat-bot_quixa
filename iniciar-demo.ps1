#Requires -Version 5.1
[CmdletBinding()]
param(
    [switch]$ProbarWebhook,
    [switch]$Reinstalar
)

$ErrorActionPreference = 'Stop'
$Raiz = $PSScriptRoot
Set-Location $Raiz

function Info([string]$Texto, [string]$Color = 'Gray') { Write-Host $Texto -ForegroundColor $Color }

function Leer-Env([string]$Ruta) {
    $mapa = @{}
    if (-not (Test-Path $Ruta)) { return $mapa }
    foreach ($linea in Get-Content $Ruta -Encoding UTF8) {
        $t = $linea.Trim()
        if ($t -eq '' -or $t.StartsWith('#')) { continue }
        $i = $t.IndexOf('=')
        if ($i -lt 1) { continue }
        $clave = $t.Substring(0, $i).Trim()
        $valor = $t.Substring($i + 1).Trim()
        if ($valor.Length -ge 2) {
            $primero = $valor.Substring(0, 1)
            $ultimo = $valor.Substring($valor.Length - 1, 1)
            if (($primero -eq '"' -and $ultimo -eq '"') -or ($primero -eq "'" -and $ultimo -eq "'")) {
                $valor = $valor.Substring(1, $valor.Length - 2)
            }
        }
        $mapa[$clave] = $valor
    }
    return $mapa
}

function Puerto-Health([int]$Puerto) {
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:$Puerto/healthz" -UseBasicParsing -TimeoutSec 3
        return ($r.StatusCode -eq 200)
    } catch { return $false }
}

function Puerto-Web([int]$Puerto) {
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:$Puerto/" -UseBasicParsing -TimeoutSec 3
        return ($r.StatusCode -eq 200)
    } catch { return $false }
}

function Pid-De-Puerto([int]$Puerto) {
    try {
        $c = Get-NetTCPConnection -State Listen -LocalPort $Puerto -ErrorAction Stop | Select-Object -First 1
        if ($c) { return [int]$c.OwningProcess }
    } catch { }
    return $null
}

function Guardar-Pid([string]$Archivo, [int]$ProcesoId) {
    Set-Content -Path (Join-Path $Raiz $Archivo) -Value $ProcesoId -Encoding ASCII
}

function Preparar-N8n {
    $rutaFlujo = Join-Path $Raiz 'flujo\quixa-consultor-virtual.json'
    if (-not (Test-Path $rutaFlujo)) { throw "No se encontro el flujo: $rutaFlujo" }
    $flujo = Get-Content $rutaFlujo -Raw -Encoding UTF8 | ConvertFrom-Json

    $ref = $null
    foreach ($n in $flujo.nodes) {
        if ($n.credentials -and $n.credentials.googlePalmApi) { $ref = $n.credentials.googlePalmApi; break }
    }
    if (-not $ref) { throw 'El flujo no referencia la credencial googlePalmApi.' }

    $tmpCred = Join-Path $env:TEMP ("quixa-cred-{0}.json" -f [guid]::NewGuid().ToString('N'))
    $tmpFlujo = Join-Path $env:TEMP ("quixa-flow-{0}.json" -f [guid]::NewGuid().ToString('N'))
    try {
        $cred = @(@{
            id   = [string]$ref.id
            name = [string]$ref.name
            type = 'googlePalmApi'
            data = @{
                host   = 'https://generativelanguage.googleapis.com'
                apiKey = [string]$cfg['GEMINI_API_KEY']
            }
        })
        $utf8 = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllText($tmpCred, (ConvertTo-Json -InputObject $cred -Depth 10), $utf8)

        $flujo | Add-Member -NotePropertyName id -NotePropertyValue $idFlujo -Force
        [System.IO.File]::WriteAllText($tmpFlujo, ($flujo | ConvertTo-Json -Depth 100), $utf8)

        Info '  Importando credencial de Gemini...'
        $salida = (& $node $n8nCli import:credentials --input=$tmpCred 2>&1 | Out-String)
        if ($salida -notmatch 'Successfully imported') {
            Write-Host $salida
            throw 'No se pudo importar la credencial de Gemini.'
        }

        Info '  Importando flujo...'
        $salida = (& $node $n8nCli import:workflow --input=$tmpFlujo 2>&1 | Out-String)
        if ($salida -notmatch 'Successfully imported') {
            Write-Host $salida
            throw 'No se pudo importar el flujo.'
        }

        Info '  Publicando flujo...'
        $salida = (& $node $n8nCli publish:workflow --id=$idFlujo 2>&1 | Out-String)
        if ($salida -notmatch 'Publishing workflow') {
            Write-Host $salida
            throw 'No se pudo publicar el flujo.'
        }

        $lista = (& $node $n8nCli list:workflow 2>&1 | Out-String)
        if ($lista -notmatch [regex]::Escape($idFlujo)) {
            throw 'El flujo no quedo registrado en n8n. Revisa los mensajes anteriores.'
        }
    } finally {
        Remove-Item $tmpCred, $tmpFlujo -Force -ErrorAction SilentlyContinue
    }
}

Info ''
Info 'QUIXA - Consultor Virtual (demo local)' 'Blue'
Info ''

$rutaEnv = Join-Path $Raiz '.env'
if (-not (Test-Path $rutaEnv)) {
    $alt = Join-Path $Raiz 'startup.env'
    if (Test-Path $alt) {
        Copy-Item $alt $rutaEnv -Force
        Info '  .env creado desde startup.env' 'Yellow'
    } else {
        throw 'No existe .env ni startup.env. Crea .env con GEMINI_API_KEY, N8N_EMAIL, N8N_PASSWORD y N8N_WORKFLOW_ID.'
    }
}

$cfg = Leer-Env $rutaEnv
foreach ($req in @('GEMINI_API_KEY', 'N8N_WORKFLOW_ID')) {
    if (-not $cfg[$req]) { throw "Falta $req en .env" }
}
$idFlujo = [string]$cfg['N8N_WORKFLOW_ID']

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { throw 'Node.js no esta instalado o no esta en el PATH.' }
$n8nCli = Join-Path $Raiz 'node_modules\n8n\bin\n8n'

if ($Reinstalar -or -not (Test-Path $n8nCli)) {
    $npm = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
    if (-not $npm) { throw 'npm no esta disponible en el PATH.' }
    Info '  Instalando dependencias (puede tardar varios minutos)...' 'Yellow'
    & $npm install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'npm install fallo.' }
}

New-Item -ItemType Directory -Force -Path (Join-Path $Raiz 'leads') | Out-Null

$env:N8N_PORT = '5678'
$env:N8N_HOST = 'localhost'
$env:N8N_PROTOCOL = 'http'
$env:WEBHOOK_URL = 'http://localhost:5678/'
$env:N8N_SECURE_COOKIE = 'false'
$env:N8N_DIAGNOSTICS_ENABLED = 'false'
$env:N8N_VERSION_NOTIFICATIONS_ENABLED = 'false'
$env:N8N_PERSONALIZATION_ENABLED = 'false'
$env:N8N_RUNNERS_ENABLED = 'true'
$env:N8N_BLOCK_ENV_ACCESS_IN_NODE = 'false'
$env:N8N_RESTRICT_FILE_ACCESS_TO = (Join-Path $Raiz 'leads')
$env:N8N_BLOCK_FILE_ACCESS_TO_N8N_FILES = 'true'
$env:N8N_USER_FOLDER = (Join-Path $Raiz '.n8n-data')
$env:GEMINI_API_KEY = [string]$cfg['GEMINI_API_KEY']

if (Puerto-Health 5678) {
    Info '  n8n ya estaba corriendo' 'Green'
    $p = Pid-De-Puerto 5678
    if ($p) { Guardar-Pid '.n8n.pid' $p }
} else {
    Info '  Preparando flujo y credencial...'
    Preparar-N8n

    Info '  Arrancando n8n (la primera vez tarda ~40 s)...'
    $arg = '"' + $n8nCli + '" start'
    $proc = Start-Process -FilePath $node -ArgumentList $arg -WorkingDirectory $Raiz -PassThru -WindowStyle Hidden `
        -RedirectStandardOutput (Join-Path $Raiz 'n8n.log') `
        -RedirectStandardError (Join-Path $Raiz 'n8n.err.log')
    Guardar-Pid '.n8n.pid' $proc.Id

    $ok = $false
    for ($i = 0; $i -lt 60; $i++) {
        if (Puerto-Health 5678) { $ok = $true; break }
        Start-Sleep -Seconds 2
    }
    if (-not $ok) { throw 'n8n no respondio. Revisa n8n.log y n8n.err.log.' }
    Info '  n8n listo' 'Green'
}

# En una instancia nueva, crea el usuario owner con las credenciales de .env.
# Si ya existe, el endpoint devuelve error y se ignora.
try {
    $body = @{
        email     = [string]$cfg['N8N_EMAIL']
        firstName = 'Demo'
        lastName  = 'QUIXA'
        password  = [string]$cfg['N8N_PASSWORD']
    } | ConvertTo-Json
    Invoke-WebRequest -Uri 'http://localhost:5678/rest/owner/setup' -Method Post -ContentType 'application/json' `
        -Body $body -UseBasicParsing -TimeoutSec 20 | Out-Null
} catch { }

if (Puerto-Web 8080) {
    Info '  servidor web ya estaba corriendo' 'Green'
    $p = Pid-De-Puerto 8080
    if ($p) { Guardar-Pid '.web.pid' $p }
} else {
    Info '  Arrancando servidor web...'
    $proc = Start-Process -FilePath $node -ArgumentList 'servidor-demo.js' -WorkingDirectory $Raiz -PassThru -WindowStyle Hidden `
        -RedirectStandardOutput (Join-Path $Raiz 'servidor.log') `
        -RedirectStandardError (Join-Path $Raiz 'servidor.err.log')
    Guardar-Pid '.web.pid' $proc.Id

    $ok = $false
    for ($i = 0; $i -lt 25; $i++) {
        if (Puerto-Web 8080) { $ok = $true; break }
        Start-Sleep -Seconds 1
    }
    if (-not $ok) { throw 'El servidor web no respondio. Revisa servidor.log.' }
    Info '  servidor web listo' 'Green'
}

if ($ProbarWebhook) {
    Info '  Probando el webhook con Gemini...'
    try {
        $r = Invoke-WebRequest -Uri 'http://localhost:5678/webhook/chat' -Method Post -ContentType 'application/json' `
            -Body '{"sessionId":"healthcheck","message":"__INICIO__"}' -UseBasicParsing -TimeoutSec 90
        if ($r.Content -match '"reply"') { Info '  webhook responde' 'Green' }
        else { Info '  webhook sin la respuesta esperada' 'Yellow' }
    } catch {
        Info '  webhook sin respuesta (revisa la cuota de Gemini)' 'Yellow'
    }
}

Info ''
Info '  Sitio de QUIXA    http://localhost:8080' 'Cyan'
Info '  Leads captados    http://localhost:8080/leads.html' 'Cyan'
Info '  Flujo en n8n      http://localhost:5678' 'Cyan'
Info "                   usuario: $($cfg['N8N_EMAIL'])   clave: $($cfg['N8N_PASSWORD'])"
Info ''
Info '  Detener todo:  .\detener-demo.cmd' 'Yellow'
Info ''
