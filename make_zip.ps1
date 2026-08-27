# Arma el ZIP de deploy.
#
# Va por LISTA BLANCA, no por lista negra. La versión anterior enumeraba la
# carpeta con Get-ChildItem -Recurse y descartaba lo que no debía ir; el problema
# es que Get-ChildItem NO respeta .gitignore, así que `backups/` —con los dumps
# de la base, datos de pacientes— entraba al paquete y viajaba al servidor. El
# comentario de CLAUDE.md afirmaba que estaba excluido y no era cierto.
#
# Es el mismo argumento que ya está escrito en server/lib/public-paths.js, por el
# mismo motivo: una lista negra hay que acordarse de actualizarla cada vez que
# alguien deja una carpeta nueva, y ese "acordarse" ya falló dos veces.
#
# Si agregás una carpeta que la app necesita en el servidor, sumala a
# $CarpetasPermitidas. Si no está acá, no se despliega.

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

# Carpetas que la aplicación necesita en el servidor.
#   scripts/ y prisma/ no se sirven por HTTP (los bloquea public-paths.js), pero
#   tienen que estar: los backups y las migraciones se corren desde ahí por SSH.
$CarpetasPermitidas = @(
    'server', 'prisma', 'scripts',
    'js', 'shared', 'css', 'icons', 'img',
    'landing'
)

# Archivos sueltos de la raíz. La misma lista que sirve public-paths.js, más los
# que necesita el servidor para arrancar (package*.json e index.js, el shim de
# Passenger que hace require("./server/index")).
$ArchivosDeRaizPermitidos = @(
    'index.html', 'app.js', 'sw.js', 'manifest.json', 'xlsx.full.min.js',
    'favicon.svg', 'favicon.ico', 'robots.txt',
    'package.json', 'package-lock.json', 'index.js'
)

# Red de seguridad. Si algo de esto llega a colarse, el build se detiene en vez
# de empaquetarlo: son las categorías que no pueden salir de esta máquina.
$PatronesProhibidos = @(
    '\.env$', '\.env\.',           # secretos (los .example quedan afuera igual)
    '\.sql\.gz$', '\.gz$',         # dumps de la base
    '\.csv$',                      # exportaciones de pacientes
    '\.zip$',
    '\.md$',                       # documentación interna, informes de auditoría
    '\.log$', '\.tmp$', '\.bak$',
    '\.ps1$'
)

# Se genera DENTRO de la carpeta del proyecto, que es donde se busca al subirlo
# por Deployments. Tres capas ya evitan que eso sea un problema:
#   1. public-paths.js lo bloquea por HTTP (los archivos sueltos de la raíz van
#      por lista blanca y .zip no está), por si alguna vez corre npm run dev acá.
#   2. .gitignore tiene *.zip, así que no entra al repo.
#   3. $PatronesProhibidos incluye \.zip$, así que un ZIP nunca entra en el ZIP
#      siguiente.
# Y sobre todo: este archivo no viaja al servidor. Se arma acá y se sube a mano.
$Destino = Join-Path $PSScriptRoot 'odentara-deploy.zip'
if (Test-Path $Destino) { Remove-Item $Destino -Force }

$base = (Get-Location).Path
$incluidos = New-Object System.Collections.ArrayList

foreach ($carpeta in $CarpetasPermitidas) {
    if (-not (Test-Path $carpeta)) { continue }
    Get-ChildItem -Path $carpeta -Recurse -File | ForEach-Object {
        $rel = $_.FullName.Substring($base.Length + 1)
        [void]$incluidos.Add($rel)
    }
}
foreach ($archivo in $ArchivosDeRaizPermitidos) {
    if (Test-Path $archivo) { [void]$incluidos.Add($archivo) }
}

# Guarda: nada de lo prohibido puede haber entrado por una subcarpeta.
$sospechosos = @()
foreach ($rel in $incluidos) {
    $normalizado = $rel -replace '\\', '/'
    foreach ($patron in $PatronesProhibidos) {
        if ($normalizado -match $patron) {
            # Las migraciones son .sql y sí tienen que viajar; lo que se bloquea
            # son los dumps comprimidos, que es otra cosa.
            if ($normalizado -like 'prisma/migrations/*') { continue }
            $sospechosos += $rel
            break
        }
    }
}
if ($sospechosos.Count -gt 0) {
    Write-Host "BUILD DETENIDO — estos archivos no pueden ir al servidor:" -ForegroundColor Red
    $sospechosos | ForEach-Object { Write-Host "   $_" -ForegroundColor Red }
    exit 1
}

Add-Type -Assembly 'System.IO.Compression.FileSystem'
$archive = [System.IO.Compression.ZipFile]::Open($Destino, 'Create')
foreach ($rel in $incluidos) {
    $completo = Join-Path $base $rel
    [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $completo, $rel, 'Optimal')
}
$archive.Dispose()

$mb = [Math]::Round((Get-Item $Destino).Length / 1MB, 2)
Write-Host ""
Write-Host "OK  $Destino" -ForegroundColor Green
Write-Host "    $($incluidos.Count) archivos, $mb MB"
Write-Host "    Subilo por hPanel -> Deployments"
Write-Host ""
Write-Host "Carpetas incluidas:"
$incluidos | ForEach-Object { ($_ -replace '\\', '/').Split('/')[0] } |
    Group-Object | Sort-Object Count -Descending |
    ForEach-Object { Write-Host ("   {0,4}  {1}" -f $_.Count, $_.Name) }
