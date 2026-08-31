# Скрипт сборки ДВУХ отдельных ресурс-паков из общего исходника:
#   JFox_RealisticHD   — текстуры (textures/, optifine/) + всё, что без них
#                         не отрисуется правильно (модели/blockstate/item-файлы,
#                         зависящие от НЕ-ванильных текстур, от OptiFine, или
#                         используемые ТОЛЬКО из уже HD-blockstate/item-файлов)
#   JFox_Realistic3D   — модели/blockstates/item-файлы, которые используют
#                         ТОЛЬКО ванильные имена текстур и не зависят от HD —
#                         при отсутствии HD откатываются на текстуру/модель из
#                         jar игры, а не на розовый квадрат / missing model.
#
# Оба архива должны нормально работать САМИ ПО СЕБЕ (независимо друг от друга).
#
# Алгоритм в три прохода:
#   A) intrinsic-проверка каждой МОДЕЛИ: её собственные "textures" (+ рекурсивно
#      через "parent") сверяются с оракулом реальных ванильных текстур 1.21.11
#      (vanilla_textures_1.21.11.txt, извлечён из клиентского jar).
#   B) blockstate/item-файл считается HD, если он ссылается ("model": "...")
#      хотя бы на одну intrinsic-HD модель.
#   C) ЗАМЫКАНИЕ: если blockstate/item ушёл в HD, ВСЕ модели, на которые он
#      ссылается (и их "parent"-цепочки), тоже принудительно уходят в HD —
#      даже если сами по себе они intrinsic-safe (используют ванильные имена).
#      Иначе такая модель осталась бы только в 3D, но единственный blockstate,
#      который на неё ссылается, живёт в HD — при выключенном 3D модель
#      пропадает целиком (не текстура, а сам файл модели).
#
# Если понадобится пересобрать оракул под другую версию игры:
#   $jar = "<путь к клиентскому .jar нужной версии>"
#   Add-Type -AssemblyName System.IO.Compression.FileSystem
#   $zip = [System.IO.Compression.ZipFile]::OpenRead($jar)
#   $zip.Entries | Where-Object { $_.FullName -match '^assets/[^/]+/textures/.*\.png$' } |
#       ForEach-Object { $_.FullName -replace '^assets/','' -replace '/textures/','/' -replace '\.png$','' } |
#       Sort-Object -Unique | Set-Content vanilla_textures_<версия>.txt -Encoding UTF8
#   $zip.Dispose()
#
# Запуск:  powershell -ExecutionPolicy Bypass -File .\build-split.ps1
#           (или)  .\build-split.ps1   — из репозитория ресурс-пака

[CmdletBinding()]
param(
    [string]$SourceDir = $PSScriptRoot,
    [string]$VanillaTexturesFile = (Join-Path $PSScriptRoot "vanilla_textures_1.21.11.txt"),
    # Куда копировать готовые .zip сразу после сборки (папка resourcepacks игры).
    # Передай -NoDeploy, чтобы пропустить деплой.
    [string]$DeployDir = "C:\Users\1\AppData\Roaming\.minecraft\versions\Fabric26.2\resourcepacks",
    [switch]$NoDeploy
)

$ErrorActionPreference = "Stop"

# --- Проверка обязательных файлов -------------------------------------------
$required = @("pack.mcmeta", "pack.png", "assets")
foreach ($rel in $required) {
    $p = Join-Path $SourceDir $rel
    if (-not (Test-Path $p)) {
        throw "Не найден обязательный элемент ресурс-пака: $p"
    }
}
if (-not (Test-Path $VanillaTexturesFile)) {
    throw "Не найден оракул ванильных текстур: $VanillaTexturesFile (см. инструкцию по пересборке в шапке скрипта)"
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$srcMcmeta = Get-Content (Join-Path $SourceDir "pack.mcmeta") -Raw | ConvertFrom-Json

# Множество ванильных текстур вида "minecraft/block/oak_planks"
$vanillaTextures = [System.Collections.Generic.HashSet[string]]::new(
    [string[]](Get-Content $VanillaTexturesFile),
    [System.StringComparer]::OrdinalIgnoreCase
)

function Normalize-AssetPath {
    param([string]$Value, [string]$DefaultNamespace)
    $v = $Value.Trim()
    if ($v -match '^([a-z0-9_\-\.]+):(.+)$') {
        return "$($Matches[1])/$($Matches[2])"
    }
    return "$DefaultNamespace/$v"
}

# --- Индекс всех наших собственных model-файлов (models/block, models/item) --
# Ключ — "<namespace>/<block|item>/<путь>" без расширения, как он выглядел бы
# в поле "model"/"parent" (например "minecraft/block/random/grass/grass2").
$assetsDir = Join-Path $SourceDir "assets"
$allAssetFiles = Get-ChildItem -Path $assetsDir -Recurse -File -Force

$modelIndex = @{}
foreach ($f in $allAssetFiles) {
    $rel = $f.FullName.Substring($SourceDir.Length).TrimStart('\','/') -replace '\\','/'
    if ($rel -match '^assets/([^/]+)/models/(.+)\.json$') {
        $key = "$($Matches[1])/$($Matches[2])"
        $modelIndex[$key] = $f.FullName
    }
}

# --- ПРОХОД A: рекурсивная intrinsic-проверка модели (через "textures" и
# "parent"). Заодно запоминаем родителя каждой модели — понадобится в проходе C.
$modelDependsOnHd = @{}   # key -> $true/$false (intrinsic, до замыкания C)
$modelParentOf = @{}      # key -> parentKey (если есть и это наша модель)
$modelParseFailed = New-Object System.Collections.Generic.List[string]

function Test-ModelNeedsHd {
    param([string]$ModelKey, [System.Collections.Generic.HashSet[string]]$Visiting)

    if ($modelDependsOnHd.ContainsKey($ModelKey)) { return $modelDependsOnHd[$ModelKey] }
    if (-not $modelIndex.ContainsKey($ModelKey)) {
        # Ванильная встроенная модель (не наша) — сама по себе не требует HD.
        return $false
    }
    if ($Visiting.Contains($ModelKey)) { return $false }
    [void]$Visiting.Add($ModelKey)

    $path = $modelIndex[$ModelKey]
    $namespace = $ModelKey.Split('/')[0]
    $needsHd = $false

    try {
        $json = Get-Content -Path $path -Raw | ConvertFrom-Json
    } catch {
        $modelParseFailed.Add($ModelKey)
        $json = $null
    }

    if ($null -ne $json) {
        if ($json.PSObject.Properties.Name -contains 'textures') {
            foreach ($prop in $json.textures.PSObject.Properties) {
                $val = $prop.Value
                if ($val -is [string] -and -not $val.StartsWith('#')) {
                    $texKey = Normalize-AssetPath -Value $val -DefaultNamespace $namespace
                    if (-not $vanillaTextures.Contains($texKey)) {
                        $needsHd = $true
                    }
                }
            }
        }
        if ($json.PSObject.Properties.Name -contains 'parent' -and $json.parent) {
            $parentKey = Normalize-AssetPath -Value $json.parent -DefaultNamespace $namespace
            if ($modelIndex.ContainsKey($parentKey)) {
                $modelParentOf[$ModelKey] = $parentKey
            }
            if (-not $needsHd -and (Test-ModelNeedsHd -ModelKey $parentKey -Visiting $Visiting)) {
                $needsHd = $true
            }
        }
    }

    $modelDependsOnHd[$ModelKey] = $needsHd
    return $needsHd
}

foreach ($key in @($modelIndex.Keys)) {
    [void](Test-ModelNeedsHd -ModelKey $key -Visiting ([System.Collections.Generic.HashSet[string]]::new()))
}

if ($modelParseFailed.Count -gt 0) {
    Write-Warning "Не удалось разобрать JSON (считаются HD-независимыми по умолчанию, проверь вручную):"
    $modelParseFailed | Sort-Object -Unique | ForEach-Object { Write-Warning "  $_" }
}

# --- ПРОХОД B: для каждого blockstate/item собираем ссылки на модели и решаем,
# уходит ли он в HD (если ссылается хотя бы на одну intrinsic-HD модель).
$modelRefRegex = [regex]'"model"\s*:\s*"([^"]+)"'

$stateInfo = @{}   # rel -> @{ File=...; Namespace=...; NeedsHd=bool; Reason=string; RefKeys=[string[]] }

foreach ($f in $allAssetFiles) {
    $rel = $f.FullName.Substring($SourceDir.Length).TrimStart('\','/') -replace '\\','/'
    if ($rel -notmatch '^assets/([^/]+)/(blockstates|items)/') { continue }
    $namespace = $Matches[1]

    $content = Get-Content -Path $f.FullName -Raw
    $refKeys = New-Object System.Collections.Generic.List[string]
    $needsHd = $false
    $reason = $null

    if ($content -match '(?i)optifine') {
        $needsHd = $true
        $reason = "содержит 'optifine'"
    }

    foreach ($m in $modelRefRegex.Matches($content)) {
        $refKey = Normalize-AssetPath -Value $m.Groups[1].Value -DefaultNamespace $namespace
        $refKeys.Add($refKey)
        if (-not $needsHd -and (Test-ModelNeedsHd -ModelKey $refKey -Visiting ([System.Collections.Generic.HashSet[string]]::new()))) {
            $needsHd = $true
            $reason = "ссылается на модель с не-ванильной текстурой ($refKey)"
        }
    }

    $stateInfo[$rel] = [ordered]@{
        File    = $f.FullName
        NeedsHd = $needsHd
        Reason  = $reason
        RefKeys = $refKeys
    }
}

# --- ПРОХОД C: замыкание. Всё, на что ссылается HD-blockstate/item, должно
# физически лежать в HD — иначе при выключенном 3D эта модель пропадёт целиком.
$forcedHd = [System.Collections.Generic.HashSet[string]]::new()
$worklist = New-Object System.Collections.Generic.Queue[string]

foreach ($info in $stateInfo.Values) {
    if ($info.NeedsHd) {
        foreach ($k in $info.RefKeys) {
            if ($modelIndex.ContainsKey($k) -and $forcedHd.Add($k)) {
                $worklist.Enqueue($k)
            }
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

# --- Классификация всех файлов assets/ ---------------------------------------
$hdFiles = New-Object System.Collections.Generic.List[string]
$modelFiles = New-Object System.Collections.Generic.List[string]
$unclassified = New-Object System.Collections.Generic.List[string]
$movedToHd = New-Object System.Collections.Generic.List[string]

foreach ($f in $allAssetFiles) {
    $rel = $f.FullName.Substring($SourceDir.Length).TrimStart('\','/') -replace '\\','/'

    $isTexture = $rel -match '/textures/'
    $isOptifineFolder = $rel -match '/optifine/'
    $isPolytoneFolder = $rel -match '/polytone/'

    if ($isTexture -or $isOptifineFolder -or $isPolytoneFolder) {
        $hdFiles.Add($f.FullName)
        continue
    }

    if ($rel -match '^assets/([^/]+)/(blockstates|models|items)/') {
        $namespace = $Matches[1]
        $kind = $Matches[2]
        $reason = $null

        if ($f.Extension -ne ".json") {
            $modelFiles.Add($f.FullName)
            continue
        }

        if ($kind -eq "models") {
            # Модели могут быть общими для нескольких blockstate/item-файлов
            # (например "block/sand" или "block/empty" используются и в чисто
            # ванильных, и в HD-only контекстах). Поэтому классификация НЕ
            # "либо/либо": модель кладётся в 3D, если сама по себе безопасна
            # (intrinsic), и НЕЗАВИСИМО кладётся в HD, если она либо сама
            # intrinsic-HD, либо входит в замыкание (используется из HD
            # blockstate/item) — при пересечении файл просто дублируется.
            $modelRel = $rel -replace '^assets/[^/]+/models/', '' -replace '\.json$', ''
            $key = "$namespace/$modelRel"
            $intrinsicHd = $modelDependsOnHd.ContainsKey($key) -and $modelDependsOnHd[$key]
            $viaClosure = $forcedHd.Contains($key)

            if (-not $intrinsicHd) {
                $modelFiles.Add($f.FullName)
            }
            if ($intrinsicHd -or $viaClosure) {
                $hdFiles.Add($f.FullName)
                $why = if ($intrinsicHd) { "использует не-ванильную текстуру" } else { "используется из HD blockstate/item (замыкание, продублирована и в 3D)" }
                $movedToHd.Add("$rel  ($why)")
            }
        } else {
            $info = $stateInfo[$rel]
            if ($info -and $info.NeedsHd) {
                $hdFiles.Add($f.FullName)
                $movedToHd.Add("$rel  ($($info.Reason))")
            } else {
                $modelFiles.Add($f.FullName)
            }
        }
        continue
    }

    $unclassified.Add($rel)
}

if ($unclassified.Count -gt 0) {
    Write-Warning "Найдены файлы assets/, не подпадающие ни под текстуры, ни под модели (пропущены):"
    $unclassified | ForEach-Object { Write-Warning "  $_" }
}

if ($movedToHd.Count -gt 0) {
    Write-Host "Модели/blockstate/item-файлы, перенесённые в HD (без HD сломались бы): $($movedToHd.Count)" -ForegroundColor Yellow
    $movedToHd | Sort-Object | ForEach-Object { Write-Host "  $_" }
    Write-Host ""
}

function Build-Pack {
    param(
        [string]$Name,
        [string]$Description,
        [string[]]$Files
    )

    $outZip = Join-Path $SourceDir "$Name.zip"
    if (Test-Path $outZip) {
        Remove-Item $outZip -Force
        Write-Host "Удалён старый архив: $outZip"
    }

    if ($Files.Count -eq 0) {
        throw "Для пака '$Name' не найдено ни одного файла — проверь фильтры."
    }

    Write-Host "Упаковываю ресурс-пак в $outZip ... ($($Files.Count) файлов assets)"
    $fs = [System.IO.File]::Open($outZip, [System.IO.FileMode]::Create)
    try {
        $zip = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create)
        try {
            # pack.mcmeta со своим описанием
            $mcmeta = [ordered]@{
                pack = [ordered]@{
                    pack_format = $srcMcmeta.pack.pack_format
                    description = $Description
                    min_format  = $srcMcmeta.pack.min_format
                    max_format  = $srcMcmeta.pack.max_format
                }
            }
            $mcmetaJson = $mcmeta | ConvertTo-Json -Depth 5
            $entry = $zip.CreateEntry("pack.mcmeta", [System.IO.Compression.CompressionLevel]::Optimal)
            $es = $entry.Open()
            try {
                $bytes = [System.Text.Encoding]::UTF8.GetBytes($mcmetaJson)
                $es.Write($bytes, 0, $bytes.Length)
            } finally { $es.Dispose() }

            # pack.png — тот же, что у основного пака
            $pngBytes = [System.IO.File]::ReadAllBytes((Join-Path $SourceDir "pack.png"))
            $entry = $zip.CreateEntry("pack.png", [System.IO.Compression.CompressionLevel]::Optimal)
            $es = $entry.Open()
            try { $es.Write($pngBytes, 0, $pngBytes.Length) } finally { $es.Dispose() }

            # содержимое assets/
            foreach ($abs in $Files) {
                $rel = $abs.Substring($SourceDir.Length).TrimStart('\','/') -replace '\\','/'
                $entry = $zip.CreateEntry($rel, [System.IO.Compression.CompressionLevel]::Optimal)
                $es = $entry.Open()
                try {
                    $data = [System.IO.File]::ReadAllBytes($abs)
                    $es.Write($data, 0, $data.Length)
                } finally { $es.Dispose() }
            }
        } finally { $zip.Dispose() }
    } finally { $fs.Dispose() }

    $size = (Get-Item $outZip).Length
    $sizeMb = [math]::Round($size / 1MB, 2)
    Write-Host ("  Архив : {0}" -f $outZip)
    Write-Host ("  Размер: {0} МБ ({1} байт)" -f $sizeMb, $size) -ForegroundColor Green
    Write-Host ""
}

Build-Pack -Name "JFox_RealisticHD" `
    -Description "J.Fox Realistic — HD текстуры" `
    -Files $hdFiles

Build-Pack -Name "JFox_Realistic3D" `
    -Description "J.Fox Realistic — 3D модели" `
    -Files $modelFiles

# --- Деплой: копируем готовые архивы в папку resourcepacks игры --------------
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
    Write-Host "Паки отправлены в: $DeployDir" -ForegroundColor Green
}

Deploy-Pack -Zips @(
    (Join-Path $SourceDir "JFox_RealisticHD.zip"),
    (Join-Path $SourceDir "JFox_Realistic3D.zip")
)

Write-Host "Готово. Оба пака собраны и могут включаться независимо друг от друга." -ForegroundColor Green
