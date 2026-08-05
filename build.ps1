# Скрипт сборки ресурс-пака в .zip для Minecraft 1.21.11
# Запуск:  powershell -ExecutionPolicy Bypass -File .\build.ps1
#           (или)  .\build.ps1   — из репозитория ресурс-пака

[CmdletBinding()]
param(
    # Имя выходного архива (без расширения)
    [string]$Name = "JFox_Realistic_1.21.11",

    # Папка сборки. По умолчанию — рядом со скриптом (корень репо).
    [string]$SourceDir = $PSScriptRoot
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
# Compress-Archive кладёт переданные пути в корень zip.
# Это именно то, что нужно Minecraft: pack.mcmeta, pack.png и assets/ на верхнем уровне.
$items = @(
    (Join-Path $SourceDir "pack.mcmeta"),
    (Join-Path $SourceDir "pack.png"),
    (Join-Path $SourceDir "assets")
)

Write-Host "Упаковываю ресурс-пак в $outZip ..."
Compress-Archive -Path $items -DestinationPath $outZip -CompressionLevel Optimal -Force

# --- Отчёт -------------------------------------------------------------------
$size = (Get-Item $outZip).Length
$sizeMb = [math]::Round($size / 1MB, 2)
Write-Host ""
Write-Host "Готово." -ForegroundColor Green
Write-Host ("  Архив : {0}" -f $outZip)
Write-Host ("  Размер: {0} МБ ({1} байт)" -f $sizeMb, $size)
Write-Host "  Скопируй .zip в папку resourcepacks Minecraft и включи в игре."