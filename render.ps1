# powershell -ExecutionPolicy Bypass -File .\render.ps1 [-Composition Youtube|Shorts|All]
#
# Renders video compositions to out/<name>/youtube.mp4 and/or out/<name>/shorts.mp4.
# Shorts rendering is blocked if total duration exceeds 60s (YouTube Shorts limit).
# Instagram Reels allows up to 90s, TikTok up to 60s -- 60s is the safe limit for all.

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

# Ask Remotion for the real durations -- calculateMetadata in Root.tsx can pad
# scenes, so summing config.json would not match what actually renders.
# Output rows look like: "Shorts     60      1080x1920      3840 (64.00 sec)"
$durations = @{}
npx remotion compositions 2>$null | ForEach-Object {
    if ($_ -match '^(\w+)\s+(\d+)\s+\d+x\d+\s+(\d+)') {
        $durations[$matches[1]] = [math]::Round([int]$matches[3] / [int]$matches[2], 1)
    }
}

function Assert-ShortsDuration {
    $seconds = $durations["Shorts"]
    if ($null -eq $seconds) {
        Write-Error "Could not read Shorts duration from 'npx remotion compositions'."
        exit 1
    }
    if ($seconds -gt 60) {
        Write-Error ("Shorts is ${seconds}s -- exceeds the 60s limit for YouTube Shorts / TikTok. " +
                     "Shorten the script and re-run generate-audio.ps1 before rendering.")
        exit 1
    }
    Write-Host "Duration check passed: ${seconds}s (limit 60s)"
}

function Invoke-Render($id) {
    $platformDir = "$outDir\$videoName\$id"
    if (-not (Test-Path $platformDir)) { New-Item -ItemType Directory $platformDir | Out-Null }
    $outFile = "$platformDir\$($id.ToLower()).mp4"
    Write-Host "`nRendering $id -> $outFile  ($($durations[$id])s)"
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
