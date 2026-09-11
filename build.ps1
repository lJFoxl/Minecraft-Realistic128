# Скрипт сборки ресурс-пака в .zip для Minecraft 1.21.11
# Запуск:  powershell -ExecutionPolicy Bypass -File .\build.ps1
#           (или)  .\build.ps1   — из репозитория ресурс-пака

[CmdletBinding()]
param(
    # Имя выходного архива (без расширения)
    [string]$Name = "JFox_Realistic_1.21.11",

    # Папка сборки. По умолчанию — рядом со скриптом (корень репо).
    [string]$SourceDir = $PSScriptRoot,

    # Куда копировать готовый .zip сразу после сборки (папка resourcepacks игры).
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

# --- Путь к выходному архиву -------------------------------------------------
$outZip = Join-Path $SourceDir "$Name.zip"
if (Test-Path $outZip) {
    Remove-Item $outZip -Force
    Write-Host "Удалён старый архив: $outZip"
}

# --- Сборка ------------------------------------------------------------------
# Пишем zip вручную через .NET ZipArchive, чтобы пути entries содержали прямые
# слэши '/' (Minecraft/Java ZipInputStream ждёт именно '/', а Compress-Archive
# на Windows кладёт '\' — из-за чего некоторые сборки Minecraft не находят файлы).
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

# Файлы, которые должны лежать в корне архива (pack.mcmeta, pack.png),
# плюс всё содержимое assets/ — с относительными путями.
$rootFiles = @("pack.mcmeta", "pack.png")
$fileList = New-Object System.Collections.Generic.List[string]
foreach ($rel in $rootFiles) {
    $fileList.Add((Join-Path $SourceDir $rel))
}
$assetsDir = Join-Path $SourceDir "assets"
$assetFiles = [string[]](Get-ChildItem -Path $assetsDir -Recurse -File -Force).FullName
$fileList.AddRange($assetFiles)

Write-Host "Упаковываю ресурс-пак в $outZip ..."
$fs = [System.IO.File]::Open($outZip, [System.IO.FileMode]::Create)
try {
    $zip = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create)
    try {
        foreach ($abs in $fileList) {
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

# --- Отчёт -------------------------------------------------------------------
$size = (Get-Item $outZip).Length
$sizeMb = [math]::Round($size / 1MB, 2)
Write-Host ""
Write-Host "Готово." -ForegroundColor Green
Write-Host ("  Архив : {0}" -f $outZip)
Write-Host ("  Размер: {0} МБ ({1} байт)" -f $sizeMb, $size)

# --- Деплой: копируем готовый архив в папку resourcepacks игры -----------------
if ($NoDeploy) {
    Write-Host "Деплой пропущен (-NoDeploy)." -ForegroundColor DarkGray
    Write-Host "  Скопируй .zip в папку resourcepacks Minecraft и включи в игре."
} else {
    if (-not (Test-Path $DeployDir)) {
        Write-Host "Создаю папку назначения: $DeployDir" -ForegroundColor DarkGray
        New-Item -ItemType Directory -Path $DeployDir -Force | Out-Null
    }
    $dest = Join-Path $DeployDir (Split-Path $outZip -Leaf)
    Copy-Item -Path $outZip -Destination $dest -Force
    Write-Host ("  → Деплой: {0}" -f $dest) -ForegroundColor Cyan
    Write-Host "Пак отправлен в: $DeployDir" -ForegroundColor Green
}