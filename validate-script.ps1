# powershell -ExecutionPolicy Bypass -File .\validate-script.ps1
#
# Validates public/script.txt without generating any files.
# Exits 0 on success, 1 if any errors are found.

$scriptFile   = ".\public\script.txt"
$audioGenFile = ".\generate-audio.ps1"

# ---------------------------------------------------------------------------
# Known values -- keep in sync with the files noted in comments
# ---------------------------------------------------------------------------

# src/VideoFactory/characters/index.ts -- characterRegistry keys
$knownCharacters  = @("dirtbag", "bryan", "lacey", "ufo")

# generate-audio.ps1 -- $voices keys
$voicedCharacters = @("dirtbag", "bryan")

# src/VideoFactory/characters/limbAnimations.ts -- LIMB_ANIMATIONS keys
$knownAnimations = @(
    "wave-intro", "wave-outro", "fortnite-dance", "thumb-up", "thumb-down",
    "cry", "tv-glitch", "glitch-in", "glitch-out", "ufo-fly"
)

# src/VideoFactory/types.ts -- SceneConfig.transition union
$knownTransitions = @("cut", "zoom-in", "zoom-out")

# Valid SHOW flag patterns
$showFlagPatterns = @(
    '^x=[\d.]+$', '^y=[\d.]+$', '^size=[\d.]+$',
    '^nametag$', '^wave$', '^wave=(intro|outro)$',
    '^trim-start=[\d.]+s$', '^trim-end=[\d.]+s$', '^pad-end=[\d.]+s$'
)

# ---------------------------------------------------------------------------
# Collectors
# ---------------------------------------------------------------------------

$errors   = [System.Collections.Generic.List[string]]::new()
$warnings = [System.Collections.Generic.List[string]]::new()

function Add-Error($msg)   { $script:errors.Add($msg) }
function Add-Warning($msg) { $script:warnings.Add($msg) }

function Err($n, $msg)  { Add-Error   "Line ${n}: $msg" }
function Warn($n, $msg) { Add-Warning "Line ${n}: $msg" }

# ---------------------------------------------------------------------------
# Meta block validation
# ---------------------------------------------------------------------------

$metaFields  = @{ name = ""; title = ""; description = ""; platform = "" }
$inMeta      = $false
$metaLineNum = 0
$metaFound   = $false

foreach ($line in (Get-Content $scriptFile)) {
    $metaLineNum++
    $trimmed = $line.Trim()
    if ($trimmed -match '^\[Meta\]\s*$') { $inMeta = $true; $metaFound = $true; continue }
    if ($inMeta) {
        if ($trimmed -match '^\[') { break }
        if ($trimmed -match '^(name|title|description|platform):\s*(.*)$') {
            $metaFields[$matches[1]] = $matches[2].Trim()
        }
    }
}

if (-not $metaFound) {
    Add-Error "[Meta] block is missing -- add it at the top of script.txt"
} else {
    if (-not $metaFields.name) {
        Add-Error "Meta: 'name' is required"
    } elseif ($metaFields.name -match '[\\/:*?"<>|]') {
        Add-Error "Meta: 'name' contains invalid folder characters"
    }
    if ($metaFields.platform -notin @("Youtube", "Shorts", "")) {
        Add-Error "Meta: 'platform' must be 'Youtube' or 'Shorts', got '$($metaFields.platform)'"
    }
    if (-not $metaFields.title)       { Add-Warning "Meta: 'title' is missing" }
    if (-not $metaFields.description) { Add-Warning "Meta: 'description' is missing" }
}

# ---------------------------------------------------------------------------
# Pipeline coherence
# ---------------------------------------------------------------------------

if (-not (Test-Path $audioGenFile)) {
    Add-Error "generate-audio.ps1 not found -- project setup may be broken"
}

# ---------------------------------------------------------------------------
# File existence
# ---------------------------------------------------------------------------

if (-not (Test-Path $scriptFile)) {
    Write-Host "ERROR: script.txt not found at $scriptFile" -ForegroundColor Red
    exit 1
}

$lines = Get-Content $scriptFile
if ($lines.Count -lt 2) {
    Add-Error "script.txt has fewer than 2 lines"
}

# ---------------------------------------------------------------------------
# Parse loop
# ---------------------------------------------------------------------------

$curSceneId      = $null
$curSceneLabel   = $null
$sceneHasContent = $false
$nextSceneNum    = 1
$seenSceneIds    = @{}
$lineNum         = 0

$inMetaBlock = $false

foreach ($line in $lines) {
    $lineNum++
    $trimmed = $line.Trim()
    if ($trimmed -eq '' -or $trimmed.StartsWith('#')) { continue }

    if ($trimmed -match '^\[Meta\]\s*$') { $inMetaBlock = $true; continue }
    if ($inMetaBlock) {
        if ($trimmed -match '^\[') { $inMetaBlock = $false }
        else { continue }
    }

    # --- Scene / Intro / Outro header ---
    if ($trimmed -match '^\[(.+)\]\s*$') {

        if ($null -ne $curSceneId -and -not $sceneHasContent) {
            Warn $lineNum "Scene '$curSceneLabel' has no dialogue and no duration= -- will render as 5s of silence"
        }

        $content = $matches[1].Trim()

        if ($content -match '^Scene\s+(\d+)(.*)$') {
            $sceneId      = "scene-$($matches[1])"
            $opts         = $matches[2]
            $nextSceneNum = [int]$matches[1] + 1
        } elseif ($content -match '^Scene(.*)$') {
            $sceneId      = "scene-$nextSceneNum"
            $opts         = $matches[1]
            $nextSceneNum++
        } elseif ($content -match '^(Intro|Outro)(.*)$') {
            $sceneId = $matches[1].ToLower()
            $opts    = $matches[2]
        } else {
            Err $lineNum "Unrecognized header '$trimmed'"
            continue
        }

        if ($seenSceneIds.ContainsKey($sceneId)) {
            Err $lineNum "Duplicate scene id '$sceneId'"
        }
        $seenSceneIds[$sceneId] = $true
        $curSceneId      = $sceneId
        $curSceneLabel   = $content.Trim()
        $sceneHasContent = $false
        $hasDuration     = $false

        foreach ($part in ($opts.Trim() -split '\s+' | Where-Object { $_ -ne '' })) {
            if ($part -match '^transition=([\w-]+)$') {
                $tv = $matches[1]
                if ($knownTransitions -notcontains $tv) {
                    Err $lineNum "Unknown transition '$tv' -- valid: $($knownTransitions -join ', ')"
                }
            } elseif ($part -match '^duration=(\d+)$') {
                $hasDuration     = $true
                $sceneHasContent = $true
            } elseif ($part -match '^tileSize=\d+$') {
                # valid
            } else {
                Warn $lineNum "Unrecognized scene option '$part'"
            }
        }

        if ($sceneId -in @("intro", "outro") -and -not $hasDuration) {
            Warn $lineNum "'$sceneId' has no duration= -- will render as empty scene"
        }

        continue
    }

    $inScene = $null -ne $curSceneId

    # --- SHOW ---
    if ($trimmed -match '^SHOW\s+(\S+)(.*)$') {
        $charName = $matches[1].ToLower()
        $flagStr  = $matches[2].Trim()
        if (-not $inScene) { Err $lineNum "SHOW before any scene header" }
        if ($knownCharacters -notcontains $charName) {
            Err $lineNum "SHOW unknown character '$charName' -- known: $($knownCharacters -join ', ')"
        }
        foreach ($flag in ($flagStr -split '\s+' | Where-Object { $_ -ne '' })) {
            $matched = $false
            foreach ($pat in $showFlagPatterns) {
                if ($flag -match $pat) { $matched = $true; break }
            }
            if (-not $matched) { Warn $lineNum "Unrecognized SHOW flag '$flag'" }
        }
        continue
    }

    # --- ANIMATE ---
    if ($trimmed -match '^ANIMATE\s+(\S+)\s+(\S+)(.*)$') {
        $charName = $matches[1].ToLower()
        $animType = $matches[2]
        $animOpts = $matches[3]
        if (-not $inScene) { Err $lineNum "ANIMATE before any scene header" }
        if ($knownCharacters -notcontains $charName) {
            Err $lineNum "ANIMATE unknown character '$charName' -- known: $($knownCharacters -join ', ')"
        }
        if ($knownAnimations -notcontains $animType) {
            Err $lineNum "Unknown animation '$animType' -- known: $($knownAnimations -join ', ')"
        }
        if ($animOpts -notmatch 'at=[\d.]+s') {
            Warn $lineNum "ANIMATE missing 'at=Xs' timestamp"
        }
        continue
    }

    # --- SFX ---
    if ($trimmed -match '^SFX\s+(\S+)') {
        $sfxPath = $matches[1]
        if (-not $inScene) { Err $lineNum "SFX before any scene header" }
        if (-not (Test-Path ".\public\$sfxPath")) {
            Err $lineNum "SFX file not found: $sfxPath"
        }
        continue
    }

    # --- CHARACTER: dialogue ---
    if ($trimmed -match '^([A-Z][A-Z0-9_-]*):\s*(.+)$') {
        $charName = $matches[1].ToLower()
        $dialogue = $matches[2]
        if (-not $inScene) { Err $lineNum "Dialogue before any scene header" }
        if ($knownCharacters -notcontains $charName) {
            Err $lineNum "Unknown character '$charName' in dialogue"
        } elseif ($voicedCharacters -notcontains $charName) {
            Err $lineNum "'$charName' has no voice configured in generate-audio.ps1"
        }
        $check = $dialogue
        while ($check -match '\{bleep:([^}]*)\}') {
            $word  = $matches[1]
            $found = $matches[0]
            $check = $check.Substring($check.IndexOf($found) + $found.Length)
            if ($word -eq '') {
                Err $lineNum "Empty {bleep:} -- missing the censored word"
            } elseif ($word -match '\s') {
                Err $lineNum "{bleep:$word} contains spaces -- must be a single word"
            }
        }
        if ($dialogue -match '\{[^}]*$') {
            Err $lineNum "Unclosed '{' in dialogue"
        }
        $sceneHasContent = $true
        continue
    }

    # --- Unrecognized ---
    Warn $lineNum "Unrecognized line: '$trimmed'"
}

# Last scene check
if ($null -ne $curSceneId -and -not $sceneHasContent) {
    Warn $lineNum "Last scene '$curSceneLabel' has no dialogue and no duration="
}

if ($seenSceneIds.Count -eq 0) {
    Add-Error "No scenes found in script.txt"
}

# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------

$wCount = $warnings.Count
$eCount = $errors.Count

if ($wCount -gt 0) {
    Write-Host ""
    Write-Host "Warnings:" -ForegroundColor Yellow
    foreach ($w in $warnings) { Write-Host "  $w" -ForegroundColor Yellow }
}

if ($eCount -gt 0) {
    Write-Host ""
    Write-Host "Errors:" -ForegroundColor Red
    foreach ($e in $errors) { Write-Host "  $e" -ForegroundColor Red }
    Write-Host ""
    Write-Host "Validation FAILED -- $eCount errors, $wCount warnings." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Validation passed -- $($seenSceneIds.Count) scenes, $wCount warnings." -ForegroundColor Green
exit 0
