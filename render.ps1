# powershell -ExecutionPolicy Bypass -File .\render.ps1 [-Composition Youtube|Shorts|All]
#
# Renders video compositions to out/<name>/youtube.mp4 and/or out/<name>/shorts.mp4.
# Shorts rendering is blocked if total duration exceeds 60s (YouTube Shorts limit).
# Instagram Reels allows up to 90s, TikTok up to 60s — 60s is the safe limit for all.

param(
    [ValidateSet("Youtube", "Shorts", "All", "")]
    [string]$Composition = ""
)

$configFile = ".\public\config.json"
$outDir     = ".\out"

if (-not (Test-Path $configFile)) {
    Write-Error "public/config.json not found. Run generate-audio.ps1 first."
    exit 1
}

if (-not (Test-Path $outDir)) { New-Item -ItemType Directory $outDir | Out-Null }

# Load config and metadata
$config    = Get-Content $configFile -Raw | ConvertFrom-Json
$meta      = $config.meta
$videoName = if ($meta -and $meta.name) { $meta.name } else { "video" }
$platform  = if ($meta -and $meta.platform) { $meta.platform } else { "Youtube" }

$resolvedComposition = if ($Composition -ne "") { $Composition } else { $platform }

# Sum scene durations from config.json
$totalFrames = 0
foreach ($scene in $config.scenes) {
    if ($scene.durationInFrames) { $totalFrames += $scene.durationInFrames }
}
$totalSeconds = [math]::Round($totalFrames / 60.0, 1)

function Assert-ShortsDuration {
    if ($totalSeconds -gt 60) {
        Write-Error ("Shorts is ${totalSeconds}s — exceeds the 60s limit for YouTube Shorts / TikTok. " +
                     "Shorten the script and re-run generate-audio.ps1 before rendering.")
        exit 1
    }
    Write-Host "Duration check passed: ${totalSeconds}s (limit 60s)"
}

function Invoke-Render($id) {
    $platformDir = "$outDir\$videoName\$id"
    if (-not (Test-Path $platformDir)) { New-Item -ItemType Directory $platformDir | Out-Null }
    $outFile = "$platformDir\$($id.ToLower()).mp4"
    Write-Host "`nRendering $id -> $outFile  (${totalSeconds}s)"
    npx remotion render $id $outFile
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Render failed for $id (exit $LASTEXITCODE)"
        exit $LASTEXITCODE
    }
    $size = [math]::Round((Get-Item $outFile).Length / 1MB, 1)
    Write-Host "$id done -- ${size}MB"
    Copy-Item ".\public\script.txt"  "$platformDir\script.txt"  -Force
    Copy-Item ".\public\config.json" "$platformDir\config.json" -Force
    Write-Host "Snapshot saved to $platformDir"
}

switch ($resolvedComposition) {
    "Youtube" { Invoke-Render "Youtube" }
    "Shorts"  { Assert-ShortsDuration; Invoke-Render "Shorts" }
    "All"     { Invoke-Render "Youtube"; Assert-ShortsDuration; Invoke-Render "Shorts" }
}

Write-Host "`nAll done."
