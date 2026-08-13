# Перекрашивает нашу HD-текстуру oak_planks.png под остальные 8 обычных пород
# (spruce, birch, jungle, acacia, dark_oak, mangrove, cherry, pale_oak),
# сохраняя рисунок доски/волокна из oak. Целевой цвет каждой породы берётся
# из ВАНИЛЬНОЙ текстуры этой породы (средний RGB), чтобы результат совпадал
# с каноничной палитрой Minecraft, а не гадать на глаз.
#
# Метод: для каждой породы считаем коэффициент target/oak по каждому каналу
# (по средним цветам НАШЕЙ oak-текстуры и ВАНИЛЬНОЙ oak-текстуры), затем
# применяем этот коэффициент поканально к каждому пикселю нашей HD oak-текстуры.
# Так сохраняются тени/блики/рисунок доски, меняется только цветовой баланс.
#
# Запуск: powershell -ExecutionPolicy Bypass -File .\tools\recolor-planks.ps1

[CmdletBinding()]
param(
    [string]$SourceDir = (Split-Path -Parent $PSScriptRoot),
    [string]$JarPath = "C:\Users\1\AppData\Roaming\.minecraft\versions\ForgeOptiFine 1.21.11\ForgeOptiFine 1.21.11.jar"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.Drawing

$texDir = Join-Path $SourceDir "assets\minecraft\textures\block"
$oakPath = Join-Path $texDir "oak_planks.png"
if (-not (Test-Path $oakPath)) { throw "Не найден $oakPath" }

# --- Средний цвет ванильных текстур пород (эталон целевого оттенка) ---------
function Get-AvgColorFromZipEntry {
    param($Zip, [string]$EntryName)
    $entry = $Zip.GetEntry($EntryName)
    if (-not $entry) { throw "В jar нет $EntryName" }
    $ms = New-Object System.IO.MemoryStream
    $s = $entry.Open()
    $s.CopyTo($ms)
    $s.Dispose()
    $ms.Position = 0
    $bmp = New-Object System.Drawing.Bitmap($ms)
    $rSum = 0.0; $gSum = 0.0; $bSum = 0.0; $n = 0
    for ($y = 0; $y -lt $bmp.Height; $y++) {
        for ($x = 0; $x -lt $bmp.Width; $x++) {
            $p = $bmp.GetPixel($x, $y)
            $rSum += $p.R; $gSum += $p.G; $bSum += $p.B
            $n++
        }
    }
    $bmp.Dispose(); $ms.Dispose()
    return [pscustomobject]@{ R = $rSum / $n; G = $gSum / $n; B = $bSum / $n }
}

$species = @("spruce", "birch", "jungle", "acacia", "dark_oak", "mangrove", "cherry", "pale_oak", "crimson", "warped")

Write-Host "Считаю эталонные цвета ванильных досок из jar..."
$zip = [System.IO.Compression.ZipFile]::OpenRead($JarPath)
$vanillaOak = Get-AvgColorFromZipEntry $zip "assets/minecraft/textures/block/oak_planks.png"
$vanillaTargets = @{}
foreach ($sp in $species) {
    $vanillaTargets[$sp] = Get-AvgColorFromZipEntry $zip "assets/minecraft/textures/block/${sp}_planks.png"
}
$zip.Dispose()
Write-Host ("  ваниль oak: R={0:N1} G={1:N1} B={2:N1}" -f $vanillaOak.R, $vanillaOak.G, $vanillaOak.B)

# --- Загружаем НАШУ HD oak_planks.png (файл свободен через MemoryStream) ----
$oakBytes = [System.IO.File]::ReadAllBytes($oakPath)
$oakMs = New-Object System.IO.MemoryStream(, $oakBytes)
$oakBmp = New-Object System.Drawing.Bitmap($oakMs)
$w = $oakBmp.Width; $h = $oakBmp.Height
Write-Host ("Наша oak_planks.png: {0}x{1}" -f $w, $h)

$rect = New-Object System.Drawing.Rectangle(0, 0, $w, $h)
$oakData = $oakBmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$stride = $oakData.Stride
$bytes = New-Object byte[] ($stride * $h)
[System.Runtime.InteropServices.Marshal]::Copy($oakData.Scan0, $bytes, 0, $bytes.Length)
$oakBmp.UnlockBits($oakData)
$oakBmp.Dispose(); $oakMs.Dispose()

# Средний цвет НАШЕЙ oak-текстуры — именно он должен быть знаменателем
# коэффициента (а не средний цвет ванильной oak), иначе коэффициент считается
# для чужого исходника и результат промахивается мимо целевого цвета.
$ourSumR = 0.0; $ourSumG = 0.0; $ourSumB = 0.0; $ourN = 0
for ($i = 0; $i -lt $bytes.Length; $i += 4) {
    $ourSumB += $bytes[$i]; $ourSumG += $bytes[$i + 1]; $ourSumR += $bytes[$i + 2]
    $ourN++
}
$ourOak = [pscustomobject]@{ R = $ourSumR / $ourN; G = $ourSumG / $ourN; B = $ourSumB / $ourN }
Write-Host ("  наша    oak: R={0:N1} G={1:N1} B={2:N1}" -f $ourOak.R, $ourOak.G, $ourOak.B)

function Clamp255([double]$v) {
    if ($v -lt 0) { return 0 }
    if ($v -gt 255) { return 255 }
    return [int]$v
}

foreach ($sp in $species) {
    $t = $vanillaTargets[$sp]
    $ratioR = $t.R / $ourOak.R
    $ratioG = $t.G / $ourOak.G
    $ratioB = $t.B / $ourOak.B
    Write-Host ("{0,-10} коэфф. R={1:N2} G={2:N2} B={3:N2}" -f $sp, $ratioR, $ratioG, $ratioB)

    $outBytes = New-Object byte[] $bytes.Length
    [Array]::Copy($bytes, $outBytes, $bytes.Length)
    for ($i = 0; $i -lt $outBytes.Length; $i += 4) {
        # Format32bppArgb в памяти = B,G,R,A
        $b = $bytes[$i]; $g = $bytes[$i + 1]; $r = $bytes[$i + 2]
        $outBytes[$i]     = Clamp255 ($b * $ratioB)
        $outBytes[$i + 1] = Clamp255 ($g * $ratioG)
        $outBytes[$i + 2] = Clamp255 ($r * $ratioR)
        # альфа (i+3) не трогаем
    }

    $outBmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $outData = $outBmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::WriteOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    [System.Runtime.InteropServices.Marshal]::Copy($outBytes, 0, $outData.Scan0, $outBytes.Length)
    $outBmp.UnlockBits($outData)

    $outPath = Join-Path $texDir "${sp}_planks.png"
    $outMs = New-Object System.IO.MemoryStream
    $outBmp.Save($outMs, [System.Drawing.Imaging.ImageFormat]::Png)
    [System.IO.File]::WriteAllBytes($outPath, $outMs.ToArray())
    $outMs.Dispose()
    $outBmp.Dispose()
    Write-Host "  -> $outPath"
}

Write-Host "`nГотово." -ForegroundColor Green
