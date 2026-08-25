# Сборка ОТДЕЛЬНОГО HD-пака (JFox_RealisticHD_128.zip), в котором текстуры
# block/item/entity/model и OptiFine CTM-оверлеи уменьшены до 128px перед
# упаковкой. GUI-текстуры (gui/) НЕ трогаются — они не часть нашего HD-контента.
#
# ВАЖНО: исходные файлы в assets/ остаются как есть — уменьшение делается
# в памяти (byte[]) непосредственно перед записью в zip-архив.
#
# Состав пака (какие файлы попадают в архив) определяется той же логикой
# трёх проходов, что и в build-split.ps1 (см. комментарии там) — чтобы
# JFox_RealisticHD_128.zip был полноценной заменой JFox_RealisticHD.zip.
#
# Правило уменьшения: если ШИРИНА текстуры > 128px, оба измерения
# масштабируются на одинаковый коэффициент (128 / ширина). Высота не
# используется как ограничитель напрямую — иначе анимационные полосы кадров
# (ширина=128, высота = N×128, например fire_0.png 128×1536) были бы
# раздавлены до нескольких пикселей на кадр. Если ширина уже ≤128 —
# файл копируется как есть (даже если высота больше, т.к. это анимация).
#
# Запуск:  powershell -ExecutionPolicy Bypass -File .\build-hd-128.ps1

[CmdletBinding()]
param(
    [string]$SourceDir = $PSScriptRoot,
    [string]$VanillaTexturesFile = (Join-Path $PSScriptRoot "vanilla_textures_1.21.11.txt"),
    [int]$MaxDim = 128,
    # Куда копировать готовый .zip сразу после сборки (папка resourcepacks игры).
    # Передай -NoDeploy, чтобы пропустить деплой.
    [string]$DeployDir = "C:\Users\1\AppData\Roaming\.minecraft\versions\Fabric21.11\resourcepacks",
    [switch]$NoDeploy
)

$ErrorActionPreference = "Stop"

$required = @("pack.mcmeta", "pack.png", "assets")
foreach ($rel in $required) {
    $p = Join-Path $SourceDir $rel
    if (-not (Test-Path $p)) { throw "Не найден обязательный элемент ресурс-пака: $p" }
}
if (-not (Test-Path $VanillaTexturesFile)) {
    throw "Не найден оракул ванильных текстур: $VanillaTexturesFile"
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.Drawing

$srcMcmeta = Get-Content (Join-Path $SourceDir "pack.mcmeta") -Raw | ConvertFrom-Json

$vanillaTextures = [System.Collections.Generic.HashSet[string]]::new(
    [string[]](Get-Content $VanillaTexturesFile),
    [System.StringComparer]::OrdinalIgnoreCase
)

function Normalize-AssetPath {
    param([string]$Value, [string]$DefaultNamespace)
    $v = $Value.Trim()
    if ($v -match '^([a-z0-9_\-\.]+):(.+)$') { return "$($Matches[1])/$($Matches[2])" }
    return "$DefaultNamespace/$v"
}

# --- Индекс собственных model-файлов -----------------------------------------
$assetsDir = Join-Path $SourceDir "assets"
$allAssetFiles = Get-ChildItem -Path $assetsDir -Recurse -File -Force

$modelIndex = @{}
foreach ($f in $allAssetFiles) {
    $rel = $f.FullName.Substring($SourceDir.Length).TrimStart('\','/') -replace '\\','/'
    if ($rel -match '^assets/([^/]+)/models/(.+)\.json$') {
        $modelIndex["$($Matches[1])/$($Matches[2])"] = $f.FullName
    }
}

# --- ПРОХОД A: intrinsic-проверка модели (через "textures" и "parent") -------
$modelDependsOnHd = @{}
$modelParentOf = @{}
$modelParseFailed = New-Object System.Collections.Generic.List[string]

function Test-ModelNeedsHd {
    param([string]$ModelKey, [System.Collections.Generic.HashSet[string]]$Visiting)
    if ($modelDependsOnHd.ContainsKey($ModelKey)) { return $modelDependsOnHd[$ModelKey] }
    if (-not $modelIndex.ContainsKey($ModelKey)) { return $false }
    if ($Visiting.Contains($ModelKey)) { return $false }
    [void]$Visiting.Add($ModelKey)

    $path = $modelIndex[$ModelKey]
    $namespace = $ModelKey.Split('/')[0]
    $needsHd = $false

    try { $json = Get-Content -Path $path -Raw | ConvertFrom-Json }
    catch { $modelParseFailed.Add($ModelKey); $json = $null }

    if ($null -ne $json) {
        if ($json.PSObject.Properties.Name -contains 'textures') {
            foreach ($prop in $json.textures.PSObject.Properties) {
                $val = $prop.Value
                if ($val -is [string] -and -not $val.StartsWith('#')) {
                    $texKey = Normalize-AssetPath -Value $val -DefaultNamespace $namespace
                    if (-not $vanillaTextures.Contains($texKey)) { $needsHd = $true }
                }
            }
        }
        if ($json.PSObject.Properties.Name -contains 'parent' -and $json.parent) {
            $parentKey = Normalize-AssetPath -Value $json.parent -DefaultNamespace $namespace
            if ($modelIndex.ContainsKey($parentKey)) { $modelParentOf[$ModelKey] = $parentKey }
            if (-not $needsHd -and (Test-ModelNeedsHd -ModelKey $parentKey -Visiting $Visiting)) { $needsHd = $true }
        }
    }

    $modelDependsOnHd[$ModelKey] = $needsHd
    return $needsHd
}

foreach ($key in @($modelIndex.Keys)) {
    [void](Test-ModelNeedsHd -ModelKey $key -Visiting ([System.Collections.Generic.HashSet[string]]::new()))
}
if ($modelParseFailed.Count -gt 0) {
    Write-Warning "Не удалось разобрать JSON (считаются HD-независимыми по умолчанию):"
    $modelParseFailed | Sort-Object -Unique | ForEach-Object { Write-Warning "  $_" }
}

# --- ПРОХОД B: blockstate/item -> HD, если ссылается на intrinsic-HD модель --
$modelRefRegex = [regex]'"model"\s*:\s*"([^"]+)"'
$stateInfo = @{}

foreach ($f in $allAssetFiles) {
    $rel = $f.FullName.Substring($SourceDir.Length).TrimStart('\','/') -replace '\\','/'
    if ($rel -notmatch '^assets/([^/]+)/(blockstates|items)/') { continue }
    $namespace = $Matches[1]

    $content = Get-Content -Path $f.FullName -Raw
    $refKeys = New-Object System.Collections.Generic.List[string]
    $needsHd = $false
    $reason = $null

    if ($content -match '(?i)optifine') { $needsHd = $true; $reason = "содержит 'optifine'" }

    foreach ($m in $modelRefRegex.Matches($content)) {
        $refKey = Normalize-AssetPath -Value $m.Groups[1].Value -DefaultNamespace $namespace
        $refKeys.Add($refKey)
        if (-not $needsHd -and (Test-ModelNeedsHd -ModelKey $refKey -Visiting ([System.Collections.Generic.HashSet[string]]::new()))) {
            $needsHd = $true
            $reason = "ссылается на модель с не-ванильной текстурой ($refKey)"
        }
    }

    $stateInfo[$rel] = [ordered]@{ File = $f.FullName; NeedsHd = $needsHd; Reason = $reason; RefKeys = $refKeys }
}

# --- ПРОХОД C: замыкание -------------------------------------------------------
$forcedHd = [System.Collections.Generic.HashSet[string]]::new()
$worklist = New-Object System.Collections.Generic.Queue[string]

foreach ($info in $stateInfo.Values) {
    if ($info.NeedsHd) {
        foreach ($k in $info.RefKeys) {
            if ($modelIndex.ContainsKey($k) -and $forcedHd.Add($k)) { $worklist.Enqueue($k) }
        }
    }
}
while ($worklist.Count -gt 0) {
    $k = $worklist.Dequeue()
    if ($modelParentOf.ContainsKey($k)) {
        $p = $modelParentOf[$k]
        if ($forcedHd.Add($p)) { $worklist.Enqueue($p) }
    }
}

# --- Классификация: собираем список файлов для HD-пака -----------------------
$hdFiles = New-Object System.Collections.Generic.List[string]

foreach ($f in $allAssetFiles) {
    $rel = $f.FullName.Substring($SourceDir.Length).TrimStart('\','/') -replace '\\','/'

    $isTexture = $rel -match '/textures/'
    $isOptifineFolder = $rel -match '/optifine/'

    if ($isTexture -or $isOptifineFolder) { $hdFiles.Add($f.FullName); continue }

    if ($rel -match '^assets/([^/]+)/(blockstates|models|items)/') {
        $namespace = $Matches[1]
        $kind = $Matches[2]

        if ($f.Extension -ne ".json") { continue }

        if ($kind -eq "models") {
            $modelRel = $rel -replace '^assets/[^/]+/models/', '' -replace '\.json$', ''
            $key = "$namespace/$modelRel"
            $intrinsicHd = $modelDependsOnHd.ContainsKey($key) -and $modelDependsOnHd[$key]
            $viaClosure = $forcedHd.Contains($key)
            if ($intrinsicHd -or $viaClosure) { $hdFiles.Add($f.FullName) }
        } else {
            $info = $stateInfo[$rel]
            if ($info -and $info.NeedsHd) { $hdFiles.Add($f.FullName) }
        }
    }
}

Write-Host "Файлов в составе HD-пака: $($hdFiles.Count)"

# --- Уменьшение текстур в памяти ----------------------------------------------
# Область уменьшения: textures/block, textures/item, textures/entity,
# textures/model + optifine/ctm. GUI (textures/gui) не трогаем.
$resizeScopeRegex = '/textures/(block|item|entity|model)/|/optifine/ctm/'

function Get-ResizedPngBytes {
    param([byte[]]$Bytes, [int]$MaxDim)

    $ms = New-Object System.IO.MemoryStream(,$Bytes)
    $img = [System.Drawing.Image]::FromStream($ms)
    try {
        $w = $img.Width
        $h = $img.Height
        if ($w -le $MaxDim) { return $Bytes }

        $scale = [double]$MaxDim / [double]$w
        $nw = [int][math]::Max(1, [math]::Round($w * $scale))
        $nh = [int][math]::Max(1, [math]::Round($h * $scale))

        $bmp = New-Object System.Drawing.Bitmap($nw, $nh, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        try {
            $g = [System.Drawing.Graphics]::FromImage($bmp)
            try {
                $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
                $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
                $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
                $g.DrawImage($img, 0, 0, $nw, $nh)
            } finally { $g.Dispose() }

            $outMs = New-Object System.IO.MemoryStream
            try {
                $bmp.Save($outMs, [System.Drawing.Imaging.ImageFormat]::Png)
                return $outMs.ToArray()
            } finally { $outMs.Dispose() }
        } finally { $bmp.Dispose() }
    } finally { $img.Dispose(); $ms.Dispose() }
}

$resizedCount = 0
$skippedCount = 0

function Get-EntryBytes {
    param([string]$AbsPath, [string]$RelPath)

    if ($RelPath -notmatch '\.png$' -or $RelPath -notmatch $resizeScopeRegex) {
        return [System.IO.File]::ReadAllBytes($AbsPath)
    }

    $orig = [System.IO.File]::ReadAllBytes($AbsPath)
    $resized = Get-ResizedPngBytes -Bytes $orig -MaxDim $MaxDim
    if ($resized.Length -ne $orig.Length -or [System.BitConverter]::ToString($resized) -ne [System.BitConverter]::ToString($orig)) {
        $script:resizedCount++
    } else {
        $script:skippedCount++
    }
    return $resized
}

# --- Упаковка ------------------------------------------------------------------
$outZip = Join-Path $SourceDir "JFox_RealisticHD_128.zip"
if (Test-Path $outZip) { Remove-Item $outZip -Force; Write-Host "Удалён старый архив: $outZip" }

Write-Host "Упаковываю в $outZip ..."
$fs = [System.IO.File]::Open($outZip, [System.IO.FileMode]::Create)
try {
    $zip = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create)
    try {
        $mcmeta = [ordered]@{
            pack = [ordered]@{
                pack_format = $srcMcmeta.pack.pack_format
                description = "J.Fox Realistic — HD текстуры (уменьшено до ${MaxDim}px)"
                min_format  = $srcMcmeta.pack.min_format
                max_format  = $srcMcmeta.pack.max_format
            }
        }
        $mcmetaJson = $mcmeta | ConvertTo-Json -Depth 5
        $entry = $zip.CreateEntry("pack.mcmeta", [System.IO.Compression.CompressionLevel]::Optimal)
        $es = $entry.Open()
        try { $bytes = [System.Text.Encoding]::UTF8.GetBytes($mcmetaJson); $es.Write($bytes, 0, $bytes.Length) }
        finally { $es.Dispose() }

        $pngBytes = [System.IO.File]::ReadAllBytes((Join-Path $SourceDir "pack.png"))
        $entry = $zip.CreateEntry("pack.png", [System.IO.Compression.CompressionLevel]::Optimal)
        $es = $entry.Open()
        try { $es.Write($pngBytes, 0, $pngBytes.Length) } finally { $es.Dispose() }

        foreach ($abs in $hdFiles) {
            $rel = $abs.Substring($SourceDir.Length).TrimStart('\','/') -replace '\\','/'
            $data = Get-EntryBytes -AbsPath $abs -RelPath $rel
            $entry = $zip.CreateEntry($rel, [System.IO.Compression.CompressionLevel]::Optimal)
            $es = $entry.Open()
            try { $es.Write($data, 0, $data.Length) } finally { $es.Dispose() }
        }
    } finally { $zip.Dispose() }
} finally { $fs.Dispose() }

$size = (Get-Item $outZip).Length
$sizeMb = [math]::Round($size / 1MB, 2)
Write-Host ""
Write-Host "Готово." -ForegroundColor Green
Write-Host ("  Архив        : {0}" -f $outZip)
Write-Host ("  Размер       : {0} МБ" -f $sizeMb)
Write-Host ("  Уменьшено PNG: {0}" -f $resizedCount)
Write-Host ("  Без изменений: {0}" -f $skippedCount)
Write-Host "  Исходники в assets/ не изменялись."

# --- Деплой: копируем готовый архив в папку resourcepacks игры -----------------
function Deploy-Pack {
    param([string[]]$Zips)
    if ($NoDeploy) {
        Write-Host "Деплой пропущен (-NoDeploy)." -ForegroundColor DarkGray
        return
    }
    if (-not (Test-Path $DeployDir)) {
        Write-Host "Создаю папку назначения: $DeployDir" -ForegroundColor DarkGray
        New-Item -ItemType Directory -Path $DeployDir -Force | Out-Null
    }
    foreach ($z in $Zips) {
        if (-not (Test-Path $z)) { Write-Warning "Нет архива для деплоя: $z"; continue }
        $dest = Join-Path $DeployDir (Split-Path $z -Leaf)
        Copy-Item -Path $z -Destination $dest -Force
        $sizeMb = [math]::Round((Get-Item $z).Length / 1MB, 2)
        Write-Host ("  → Деплой: {0}  ({1} МБ)" -f $dest, $sizeMb) -ForegroundColor Cyan
    }
    Write-Host "Пак отправлен в: $DeployDir" -ForegroundColor Green
}

Deploy-Pack -Zips @( $outZip )
