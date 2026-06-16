# powershell -ExecutionPolicy Bypass -File .\render.ps1 [-Composition Youtube|Shorts|All]
#
# Renders video compositions to out/youtube.mp4 and/or out/shorts.mp4.
# Shorts rendering is blocked if total duration exceeds 60s (YouTube Shorts limit).
# Instagram Reels allows up to 90s, TikTok up to 60s — 60s is the safe limit for all.

param(
    [ValidateSet("Youtube", "Shorts", "All")]
    [string]$Composition = "All"
)

$configFile = ".\public\config.json"
$outDir     = ".\out"

if (-not (Test-Path $configFile)) {
    Write-Error "public/config.json not found. Run generate-audio.ps1 first."
    exit 1
}

if (-not (Test-Path $outDir)) { New-Item -ItemType Directory $outDir | Out-Null }

# Sum scene durations from config.json
$config      = Get-Content $configFile -Raw | ConvertFrom-Json
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
    $outFile = "$outDir\$($id.ToLower()).mp4"
    Write-Host "`nRendering $id → $outFile  (${totalSeconds}s)"
    npx remotion render $id $outFile
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Render failed for $id (exit $LASTEXITCODE)"
        exit $LASTEXITCODE
    }
    $size = [math]::Round((Get-Item $outFile).Length / 1MB, 1)
    Write-Host "$id done — ${size}MB"
}

switch ($Composition) {
    "Youtube" { Invoke-Render "Youtube" }
    "Shorts"  { Assert-ShortsDuration; Invoke-Render "Shorts" }
    "All"     { Invoke-Render "Youtube"; Assert-ShortsDuration; Invoke-Render "Shorts" }
}

Write-Host "`nAll done."
