# Проверяет, что JFox_RealisticHD.zip и JFox_Realistic3D.zip самодостаточны:
# ни один blockstate/item внутри архива не ссылается на "нашу" модель,
# которой нет в этом же архиве. Запускать после build-split.ps1.
[CmdletBinding()]
param(
    [string]$SourceDir = $PSScriptRoot
)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Get-ZipModelJsonPaths {
    param([string]$ZipPath)
    $zip = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)
    try {
        $set = [System.Collections.Generic.HashSet[string]]::new()
        foreach ($e in $zip.Entries) {
            if ($e.FullName -match '^assets/([^/]+)/models/(.+)\.json$') {
                [void]$set.Add("$($Matches[1])/$($Matches[2])")
            }
        }
        return $set
    } finally { $zip.Dispose() }
}

function Get-ZipStateItemEntries {
    param([string]$ZipPath)
    $zip = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)
    try {
        $list = New-Object System.Collections.Generic.List[object]
        foreach ($e in $zip.Entries) {
            if ($e.FullName -match '^assets/([^/]+)/(blockstates|items)/(.+)\.json$') {
                $sr = New-Object System.IO.StreamReader($e.Open())
                $content = $sr.ReadToEnd()
                $sr.Dispose()
                $list.Add([pscustomobject]@{ Path = $e.FullName; Namespace = $Matches[1]; Content = $content })
            }
        }
        return $list
    } finally { $zip.Dispose() }
}

$hdModels = Get-ZipModelJsonPaths -ZipPath (Join-Path $SourceDir "JFox_RealisticHD.zip")
$tdModels = Get-ZipModelJsonPaths -ZipPath (Join-Path $SourceDir "JFox_Realistic3D.zip")

# Модель считается "ванильной" эвристически: она не встречается ни в одном
# из наших индексов (значит, мы её не переопределяем — берётся built-in из jar).
$allOurModels = [System.Collections.Generic.HashSet[string]]::new()
foreach ($k in $hdModels) { [void]$allOurModels.Add($k) }
foreach ($k in $tdModels) { [void]$allOurModels.Add($k) }

function Normalize-AssetPath2 {
    param([string]$Value, [string]$DefaultNamespace)
    $v = $Value.Trim()
    if ($v -match '^([a-z0-9_\-\.]+):(.+)$') { return "$($Matches[1])/$($Matches[2])" }
    return "$DefaultNamespace/$v"
}

$modelRefRegex = [regex]'"model"\s*:\s*"([^"]+)"'
$problems = New-Object System.Collections.Generic.List[string]

foreach ($packName in @("JFox_RealisticHD","JFox_Realistic3D")) {
    $entries = Get-ZipStateItemEntries -ZipPath (Join-Path $SourceDir "$packName.zip")
    $ownSet = if ($packName -eq "JFox_RealisticHD") { $hdModels } else { $tdModels }
    foreach ($e in $entries) {
        foreach ($m in $modelRefRegex.Matches($e.Content)) {
            $refKey = Normalize-AssetPath2 -Value $m.Groups[1].Value -DefaultNamespace $e.Namespace
            if ($allOurModels.Contains($refKey) -and -not $ownSet.Contains($refKey)) {
                $problems.Add("[$packName] $($e.Path) -> ссылается на '$refKey', которой НЕТ в этом же архиве")
            }
        }
    }
}

if ($problems.Count -eq 0) {
    Write-Host "OK: разрывов не найдено — оба пака самодостаточны." -ForegroundColor Green
} else {
    Write-Host "Найдены разрывы: $($problems.Count)" -ForegroundColor Red
    $problems | Sort-Object -Unique | ForEach-Object { Write-Host "  $_" }
}
