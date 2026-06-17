# powershell -ExecutionPolicy Bypass -File .\generate-audio.ps1
#
# Reads public/script.txt, writes public/config.json, then generates
# audio files (mp3 + vtt + mouth.json) for every line of dialogue.
#
# script.txt format:
#
#   [Scene N]                     scene header (also [Intro duration=120], [Outro duration=120])
#   [Scene N transition=cut]      optional transition and other options in header
#   SHOW character [flags]        character visual config
#   ANIMATE char type at=Xs       animation (optional cycles=N return=N)
#   SFX path at=Xs                sound effect
#   CHARACTER: dialogue text      dialogue line — generates one TTS clip
#   {bleep:word}                  censored word inline in dialogue
#
# SHOW flags:
#   wave=(intro|outro)  animate hand
#   nametag             show name tag
#   size=5              close-up; size=2 normal (default)
#   x=0.5               horizontal position (0.0-1.0)
#   y=0.5               vertical position (0.0-1.0); default 0.5
#   trim-start=0.5s     trim leading silence
#   trim-end=0.2s       trim trailing silence
#   pad-end=0.5s        add silence at end

$audioDir   = ".\public\audio"
$scriptFile = ".\public\script.txt"
$configFile = ".\public\config.json"

$meta   = [ordered]@{ name = ""; title = ""; description = ""; platform = "Youtube" }
$inMeta = $false

# ---------------------------------------------------------------------------
# Character config
# ---------------------------------------------------------------------------

$voices = @{
    "dirtbag" = "en-US-AnaNeural"
    "bryan"   = "en-GB-MaisieNeural"
}

$voiceArgs = @{
    "dirtbag" = @("--rate=+15%")
    "bryan"   = @("--rate=+15%", "--pitch=+20Hz")
}

$charDefaults = @{
    "dirtbag" = @{ x = 0.75; y = 0.5; size = 2 }
    "bryan"   = @{ x = 0.25; y = 0.5; size = 2 }
}

$charNameTags = @{
    "dirtbag" = [ordered]@{ label = "dirtbag"; color = "#F3E5AB" }
    "bryan"   = [ordered]@{ label = "bryan"; color = "#E40078"; strikePrefix = "brain" }
}

$defaultBackground = [ordered]@{
    type     = "chessboard"
    tileSize = 80
    color1   = "#141414"
    color2   = "#1F1F1F"
}

# ---------------------------------------------------------------------------
# Generate censor beep (once)
# ---------------------------------------------------------------------------

$beepFile = ".\public\assets\sfx\censor-beep.wav"
if (-not (Test-Path $beepFile)) {
    Write-Host "Generating censor beep..."
    ffmpeg -f lavfi -i "sine=frequency=1000:duration=0.7,volume=0.7" `
        -af "afade=t=in:st=0:d=0.01,afade=t=out:st=0.68:d=0.02" $beepFile -y 2>$null
    if ($LASTEXITCODE -ne 0) { Write-Warning "Failed to generate censor beep" }
    else { Write-Host "  censor-beep.wav created." }
}

# ---------------------------------------------------------------------------
# Clean audio folder
# ---------------------------------------------------------------------------

$cacheFile = "$audioDir\.audiocache.json"
$cache = @{}
if (Test-Path $cacheFile) {
    $parsed = Get-Content $cacheFile -Raw | ConvertFrom-Json
    $parsed.PSObject.Properties | ForEach-Object { $cache[$_.Name] = $_.Value }
}
$newCache = @{}

# ---------------------------------------------------------------------------
# Parsing helpers
# ---------------------------------------------------------------------------

function Get-EffectiveMs($rawMs, $entry) {
    $ts = if ($null -ne $entry.trimStart) { [math]::Round($entry.trimStart * 1000) } else { 0 }
    $te = if ($null -ne $entry.trimEnd)   { [math]::Round($entry.trimEnd   * 1000) } else { 0 }
    $pe = if ($null -ne $entry.padEnd)    { [math]::Round($entry.padEnd    * 1000) } else { 0 }
    return [math]::Round($rawMs - $ts - $te + $pe)
}

function Parse-SceneHeader($line) {
    if ($line -notmatch '^\[(.+)\]\s*$') { return $null }
    $content = $matches[1].Trim()
    if ($content -match '^Scene\s+(\d+)(.*)$') {
        $id   = "scene-$($matches[1])"
        $opts = $matches[2]
    } elseif ($content -match '^Scene(.*)$') {
        $id   = $null   # caller assigns auto-number
        $opts = $matches[1]
    } elseif ($content -match '^(Intro|Outro)(.*)$') {
        $id   = $matches[1].ToLower()
        $opts = $matches[2]
    } else {
        return $null
    }
    $result = @{ id = $id; durationInFrames = $null; tileSize = $null; transition = $null }
    foreach ($part in ($opts.Trim() -split '\s+' | Where-Object { $_ -ne '' })) {
        if ($part -match '^duration=(\d+)$')      { $result.durationInFrames = [int]$matches[1] }
        if ($part -match '^tileSize=(\d+)$')      { $result.tileSize         = [int]$matches[1] }
        if ($part -match '^transition=([\w-]+)$') { $result.transition       = $matches[1] }
    }
    return $result
}

function Parse-ShowTag($line) {
    if ($line -notmatch '^SHOW\s+(.+)$') { return $null }
    $parts    = $matches[1].Trim() -split '\s+'
    $charName = $parts[0].ToLower()
    $def      = $script:charDefaults[$charName]
    $result   = @{
        name         = $charName
        x            = if ($def) { $def.x }    else { 0.5 }
        y            = if ($def) { $def.y }    else { 0.5 }
        size         = if ($def) { $def.size } else { 2 }
        sizeExplicit = $false
        wave         = $null
        nametag      = $false
        trimStart    = $null
        trimEnd      = $null
        padEnd       = $null
    }
    foreach ($part in $parts[1..($parts.Count - 1)]) {
        if    ($part -match '^x=(.+)$')                { $result.x           = [double]$matches[1] }
        elseif ($part -match '^y=(.+)$')                { $result.y           = [double]$matches[1] }
        elseif ($part -match '^size=([\d.]+)$')         { $result.size        = [double]$matches[1]; $result.sizeExplicit = $true }
        elseif ($part -match '^wave=(intro|outro)$')    { $result.wave      = $matches[1] }
        elseif ($part -eq 'wave')                       { $result.wave      = "intro" }
        elseif ($part -eq 'nametag')                    { $result.nametag   = $true }
        elseif ($part -match '^trim-start=([\d.]+)s$') { $result.trimStart = [double]$matches[1] }
        elseif ($part -match '^trim-end=([\d.]+)s$')   { $result.trimEnd   = [double]$matches[1] }
        elseif ($part -match '^pad-end=([\d.]+)s$')    { $result.padEnd    = [double]$matches[1] }
    }
    return $result
}

# ---------------------------------------------------------------------------
# Rule-based auto-direction
# Closeup rules: intro/outro = never; first scene = never; single speaker = closeup
# ---------------------------------------------------------------------------

function Invoke-AutoDirection($scenes) {
    Write-Host "[auto-direction] Applying rules..."
    $applied = 0

    $firstSceneId = $null
    foreach ($s in $scenes) {
        if ($s.id -notin @("intro", "outro")) { $firstSceneId = $s.id; break }
    }

    $lastSceneId = $null
    for ($i = $scenes.Count - 1; $i -ge 0; $i--) {
        if ($scenes[$i].id -notin @("intro", "outro")) { $lastSceneId = $scenes[$i].id; break }
    }

    foreach ($scene in $scenes) {
        $sid = $scene.id

        if ($sid -in @("intro", "outro") -or $sid -eq $firstSceneId) { continue }

        if ($scene.charMap.Count -eq 1) {
            $charName = @($scene.charMap.Keys)[0]
            $entry    = $scene.charMap[$charName]
            if (-not $entry.sizeExplicit) {
                $entry.size = 5
                $entry.x    = 0.5
                Write-Host "  [$sid] closeup -> $charName" -ForegroundColor DarkCyan
                $applied++
            }
        }

        if ($null -eq $scene.transition) {
            if ($sid -eq $lastSceneId) {
                $scene.transition = 'zoom-out'
                Write-Host "  [$sid] transition -> zoom-out (last scene)" -ForegroundColor DarkCyan
                $applied++
            } elseif ($scene.charMap.Count -le 1) {
                $scene.transition = 'zoom-in'
                Write-Host "  [$sid] transition -> zoom-in" -ForegroundColor DarkCyan
                $applied++
            } elseif ($scene.charMap.Count -ge 2) {
                $scene.transition = 'zoom-out'
                Write-Host "  [$sid] transition -> zoom-out" -ForegroundColor DarkCyan
                $applied++
            }
        }
    }

    Write-Host "[auto-direction] Done -- $applied suggestions applied." -ForegroundColor Cyan
}

# ---------------------------------------------------------------------------
# Parse script.txt
# ---------------------------------------------------------------------------

$scenes     = [System.Collections.Generic.List[hashtable]]::new()
$clips      = [System.Collections.Generic.List[PSCustomObject]]::new()
$sceneIndex = @{}

$curScene = $null

function Emit-Clip($Scene, $CharInfo, $Text) {
    $ttsInput = $Text.Trim()
    if ($ttsInput -eq '') { return }

    $sid    = $Scene.id
    $charId = $CharInfo.name

    if (-not $script:sceneIndex.ContainsKey($sid)) { $script:sceneIndex[$sid] = 0 }
    $script:sceneIndex[$sid]++
    $idx = $script:sceneIndex[$sid]

    $bleepWordIndices  = [System.Collections.Generic.List[int]]::new()
    $censoredWordsList = [System.Collections.Generic.List[string]]::new()
    $words = $ttsInput -split '\s+'
    for ($w = 0; $w -lt $words.Count; $w++) {
        if ($words[$w] -match '^\{bleep:(.+?)\}') {
            $bleepWordIndices.Add($w)
            $censoredWordsList.Add($matches[1])
            $words[$w] = $words[$w] -replace '^\{bleep:(.+?)\}', '$1'
        }
    }
    $ttsText   = $words -join ' '
    $wordCount = $words.Count

    $audioEntry = [ordered]@{
        src         = "audio/$sid-$charId-$idx.mp3"
        subtitles   = "audio/$sid-$charId-$idx.vtt"
        mouthCues   = "audio/$sid-$charId-$idx-mouth.json"
        characterId = $charId
        text        = $ttsText
    }
    if ($censoredWordsList.Count -gt 0) {
        $audioEntry.censoredWords = $censoredWordsList.ToArray()
    }
    if ($null -ne $CharInfo.trimStart) { $audioEntry.trimStart = $CharInfo.trimStart }
    if ($null -ne $CharInfo.trimEnd)   { $audioEntry.trimEnd   = $CharInfo.trimEnd   }
    if ($null -ne $CharInfo.padEnd)    { $audioEntry.padEnd    = $CharInfo.padEnd    }
    $Scene.audioList.Add($audioEntry)

    $script:clips.Add([PSCustomObject]@{
        Scene            = $sid
        Character        = $charId
        Index            = $idx
        Text             = $ttsText
        Words            = $words
        BleepWordIndices = $bleepWordIndices
        WordCount        = $wordCount
        AudioEntry       = $audioEntry
    })
}

function Flush-Scene {
    if ($null -ne $script:curScene) { $script:scenes.Add($script:curScene) }
}

$seenSceneIds = @{}
$nextSceneNum = 1

foreach ($line in (Get-Content $scriptFile)) {
    if ($line -match '^\[Meta\]\s*$') { $inMeta = $true; continue }
    if ($inMeta) {
        if ($line -match '^\[') { $inMeta = $false }
        elseif ($line -match '^(name|title|description|platform):\s*(.+)$') {
            $meta[$matches[1]] = $matches[2].Trim()
        }
        if ($inMeta) { continue }
    }

    $sh = Parse-SceneHeader $line
    if ($sh) {
        Flush-Scene
        if ($null -eq $sh.id) {
            $sh.id = "scene-$nextSceneNum"
        }
        if ($sh.id -match '^scene-(\d+)$') { $nextSceneNum = [int]$matches[1] + 1 }
        if ($seenSceneIds.ContainsKey($sh.id)) {
            Write-Warning "Duplicate scene id '$($sh.id)' - skipping second occurrence"
            $curScene = $null
            continue
        }
        $seenSceneIds[$sh.id] = $true
        $curScene = @{
            id               = $sh.id
            durationInFrames = $sh.durationInFrames
            tileSize         = $sh.tileSize
            transition       = $sh.transition
            charMap          = [ordered]@{}
            audioList        = [System.Collections.Generic.List[object]]::new()
            sfxList          = [System.Collections.Generic.List[object]]::new()
            animList         = [System.Collections.Generic.List[object]]::new()
        }
        continue
    }

    if ($line -match '^ANIMATE\s+([\w-]+)\s+([\w-]+)\s+at=([\d.]+)s(.*)') {
        if ($curScene) {
            $entry = [ordered]@{
                characterId = $matches[1]
                type        = $matches[2]
                atMs        = [math]::Round([double]$matches[3] * 1000)
            }
            $rest = $matches[4]
            if ($rest -match 'cycles=(\d+)') { $entry.params = [ordered]@{ cycles = [int]$matches[1] } }
            if ($rest -match 'return=(\d+)') {
                if ($null -eq $entry.params) { $entry.params = [ordered]@{} }
                $entry.params.returnFrames = [int]$matches[1]
            }
            $curScene.animList.Add($entry)
        }
        continue
    }

    if ($line -match '^SFX\s+([\S]+)\s+at=([\d.]+)s') {
        if ($curScene) {
            $curScene.sfxList.Add([ordered]@{ src = $matches[1]; atMs = [math]::Round([double]$matches[2] * 1000) })
        }
        continue
    }

    $st = Parse-ShowTag $line
    if ($st) {
        if ($curScene -and -not $curScene.charMap.Contains($st.name)) {
            $curScene.charMap[$st.name] = $st
        }
        continue
    }

    if ($line -match '^([A-Z][A-Z0-9_-]*):\s*(.+)$') {
        $charName = $matches[1].ToLower()
        $dialogue = $matches[2].Trim()
        if ($curScene) {
            if (-not $curScene.charMap.Contains($charName)) {
                $def = $script:charDefaults[$charName]
                $curScene.charMap[$charName] = @{
                    name         = $charName
                    x            = if ($def) { $def.x }    else { 0.5 }
                    y            = if ($def) { $def.y }    else { 0.5 }
                    size         = if ($def) { $def.size } else { 2 }
                    sizeExplicit = $false
                    wave         = $null
                    nametag      = $false
                    trimStart    = $null
                    trimEnd      = $null
                    padEnd       = $null
                }
            }
            Emit-Clip -Scene $curScene -CharInfo $curScene.charMap[$charName] -Text $dialogue
        }
        continue
    }
}
Flush-Scene
Invoke-AutoDirection $scenes

# ---------------------------------------------------------------------------
# Build and write config.json
# ---------------------------------------------------------------------------

$scenesJson = [System.Collections.Generic.List[object]]::new()

foreach ($scene in $scenes) {
    $obj = [ordered]@{ id = $scene.id }

    if ($null -ne $scene.durationInFrames) { $obj.durationInFrames = $scene.durationInFrames }
    if ($null -ne $scene.transition)       { $obj.transition       = $scene.transition }
    if ($scene.audioList.Count -gt 0)      { $obj.audio            = $scene.audioList }
    if ($scene.sfxList.Count -gt 0)        { $obj.sfx              = $scene.sfxList }

    $charsArr = [System.Collections.Generic.List[object]]::new()
    foreach ($charName in $scene.charMap.Keys) {
        $a       = $scene.charMap[$charName]
        $charObj = [ordered]@{ id = $charName; x = $a.x; y = $a.y; size = $a.size }
        if ($a.wave) {
            $scene.animList.Add([ordered]@{
                characterId = $a.name
                type        = "wave-$($a.wave)"
                atMs        = 0
            })
        }
        if ($a.nametag -and $script:charNameTags.ContainsKey($charName)) {
            $charObj.nameTag = $script:charNameTags[$charName]
        }
        $charsArr.Add($charObj)
    }
    $obj.characters = $charsArr
    if ($scene.animList.Count -gt 0)       { $obj.animations       = $scene.animList }

    $scenesJson.Add($obj)
}

$music = [ordered]@{
    muted = $true
    intro = [ordered]@{ src = "assets/music/intro.wav"; volume = 0.3 }
    loop  = [ordered]@{ src = "assets/music/loop.wav";  volume = 0.3 }
    outro = [ordered]@{ src = "assets/music/outro.wav"; volume = 0.3 }
}

$config = [ordered]@{
    meta              = $meta
    music             = $music
    defaultBackground = $defaultBackground
    defaultCharacters = @()
    scenes            = $scenesJson
}

# ---------------------------------------------------------------------------
# Generate audio (must run before writing config.json — bleeps need ffprobe)
# ---------------------------------------------------------------------------

foreach ($clip in $clips) {
    $base = "$($clip.Scene)-$($clip.Character)-$($clip.Index)"
    $mp3  = Join-Path $audioDir "$base.mp3"
    $vtt  = Join-Path $audioDir "$base.vtt"
    $wav  = Join-Path $audioDir "$base.wav"
    $json = Join-Path $audioDir "$base-mouth.json"
    $tmp  = Join-Path $audioDir "$base.tmp.txt"

    if (-not $voices.ContainsKey($clip.Character)) {
        Write-Warning "Unknown character '$($clip.Character)' in [$base] - skipping"
        continue
    }

    $charArgs = $voiceArgs[$clip.Character]
    $rateVal  = "+0%"
    $pitchVal = "+0Hz"
    foreach ($a in $charArgs) {
        if ($a -match '^--rate=(.+)$')  { $rateVal  = $matches[1] }
        if ($a -match '^--pitch=(.+)$') { $pitchVal = $matches[1] }
    }

    $hashInput = "$($clip.Text)|$($clip.Character)|$($voices[$clip.Character])|$rateVal|$pitchVal|$($clip.BleepWordIndices -join ',')"
    $hashBytes = [System.Text.Encoding]::UTF8.GetBytes($hashInput)
    $sha       = [System.Security.Cryptography.SHA256]::Create()
    $hashStr   = [System.BitConverter]::ToString($sha.ComputeHash($hashBytes)) -replace '-', ''

    $cached = $cache[$base]
    if ($cached -and $cached.hash -eq $hashStr -and (Test-Path $mp3) -and (Test-Path $vtt) -and (Test-Path $json)) {
        Write-Host "[$base] cached, skipping."
        if ($cached.bleeps) { $clip.AudioEntry.bleeps = $cached.bleeps }
        if ($cached.durationMs) {
            $clip.AudioEntry.durationMs = $cached.durationMs
        } elseif (Test-Path $mp3) {
            $rawMs = [math]::Round([double](ffprobe -v quiet -show_entries format=duration -of csv=p=0 $mp3) * 1000)
            $clip.AudioEntry.durationMs = Get-EffectiveMs $rawMs $clip.AudioEntry
        }
        $newCache[$base] = $cached
        continue
    }

    $preview = $clip.Text.Substring(0, [Math]::Min(60, $clip.Text.Length))
    Write-Host "[$base] $preview..."

    Set-Content -Path $tmp -Value $clip.Text -Encoding UTF8

    Write-Host "  1/3 edge-tts..."
    python "$PSScriptRoot\edge-tts-words.py" $tmp $voices[$clip.Character] $rateVal $pitchVal $mp3 $vtt
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "  edge-tts failed (exit $LASTEXITCODE) - skipping [$base]"
        Remove-Item $tmp -ErrorAction SilentlyContinue
        continue
    }

    # Compute bleep timings by running TTS on pre-bleep text and measuring duration
    if ($clip.BleepWordIndices.Count -gt 0) {
        $bleepsArr = [System.Collections.Generic.List[object]]::new()
        foreach ($wi in $clip.BleepWordIndices) {
            $startMs = 0
            if ($wi -gt 0) {
                $probeText    = ($clip.Words[0..($wi - 1)]) -join ' '
                $probeMp3     = Join-Path $audioDir "$base-probe-$wi.mp3"
                $probeTrimmed = Join-Path $audioDir "$base-probe-$wi-trimmed.mp3"
                $probeTmp     = Join-Path $audioDir "$base-probe-$wi.tmp.txt"
                Set-Content -Path $probeTmp -Value $probeText -Encoding UTF8
                edge-tts -f $probeTmp -v $voices[$clip.Character] $voiceArgs[$clip.Character] --write-media $probeMp3 2>$null
                if (Test-Path $probeMp3) {
                    # Strip trailing silence so we get when speech actually ends
                    ffmpeg -i $probeMp3 -af "areverse,silenceremove=start_periods=1:start_duration=0.05:start_threshold=-40dB,areverse" $probeTrimmed -y 2>$null
                    $measureFile = if (Test-Path $probeTrimmed) { $probeTrimmed } else { $probeMp3 }
                    $startMs = [math]::Round([double](ffprobe -v quiet -show_entries format=duration -of csv=p=0 $measureFile) * 1000)
                }
                Remove-Item $probeMp3, $probeTrimmed, $probeTmp -ErrorAction SilentlyContinue
            }
            $endMs = $startMs + 800
            $bleepsArr.Add([ordered]@{ startMs = $startMs; endMs = $endMs })
            Write-Host "  bleep word[$wi]: ${startMs}ms-${endMs}ms"
        }
        $clip.AudioEntry.bleeps = $bleepsArr
    }

    Write-Host "  2/4 ffmpeg (mp3 -> wav)..."
    ffmpeg -y -i $mp3 $wav 2>$null
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $wav)) {
        Write-Warning "  ffmpeg failed - skipping enhance+rhubarb for [$base]"
    } else {
        Write-Host "  3/5 resemble-enhance (wav -> enhanced wav)..."
        $wavAbs = (Resolve-Path $wav).Path
        $wavWsl = "/mnt/" + $wavAbs[0].ToString().ToLower() + ($wavAbs.Substring(2) -replace '\\', '/')
        wsl -e bash -c "~/enhance-env/bin/python ~/enhance.py '$wavWsl' '$wavWsl' 2>&1 | grep -v pynvml | grep -v ds_accelerator" | Write-Host
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "  resemble-enhance failed (exit $LASTEXITCODE) for [$base] - continuing with unenhanced wav"
        }
        Write-Host "  4/5 ffmpeg (loudnorm -14 LUFS -> mp3)..."
        ffmpeg -y -i $wav -af "loudnorm=I=-14:LRA=11:TP=-1.5" $mp3 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "  loudnorm failed for [$base]"
        }
        $rawMs = [math]::Round([double](ffprobe -v quiet -show_entries format=duration -of csv=p=0 $mp3) * 1000)
        $clip.AudioEntry.durationMs = Get-EffectiveMs $rawMs $clip.AudioEntry
        Write-Host "  5/5 rhubarb (wav -> mouth.json)..."
        rhubarb -f json -o $json $wav
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "  rhubarb failed (exit $LASTEXITCODE) for [$base]"
        }
        Remove-Item $wav -ErrorAction SilentlyContinue
    }

    Remove-Item $tmp -ErrorAction SilentlyContinue

    $cacheEntry = @{ hash = $hashStr }
    if ($clip.AudioEntry.bleeps)    { $cacheEntry.bleeps    = $clip.AudioEntry.bleeps    }
    if ($clip.AudioEntry.durationMs) { $cacheEntry.durationMs = $clip.AudioEntry.durationMs }
    $newCache[$base] = $cacheEntry
    Write-Host "  done."
}

# Remove orphaned audio files and save updated cache
$expectedBases = $clips | ForEach-Object { "$($_.Scene)-$($_.Character)-$($_.Index)" }
Get-ChildItem $audioDir -File | Where-Object { $_.Name -ne ".audiocache.json" } | ForEach-Object {
    $baseName = $_.BaseName -replace '-mouth$', ''
    if ($baseName -notin $expectedBases) {
        Remove-Item $_.FullName -Force
        Write-Host "Removed orphan: $($_.Name)"
    }
}
# Compute clip-level startMs/endMs and scene-level durationMs/durationInFrames
for ($i = 0; $i -lt $scenes.Count; $i++) {
    $scene  = $scenes[$i]
    $obj    = $scenesJson[$i]
    $cursor = 0
    foreach ($entry in $scene.audioList) {
        $ms          = if ($entry.durationMs) { $entry.durationMs } else { 0 }
        $entry.startMs = $cursor
        $entry.endMs   = $cursor + $ms
        $cursor       += $ms
    }
    $sceneMs = if ($null -ne $scene.durationInFrames) {
        [math]::Round($scene.durationInFrames / 60.0 * 1000)
    } else {
        $cursor
    }
    if ($sceneMs -gt 0) {
        $obj.durationMs       = $sceneMs
        $obj.durationInFrames = [math]::Round($sceneMs / 1000.0 * 60)
    }
}

$newCache | ConvertTo-Json -Depth 5 | Set-Content $cacheFile -Encoding UTF8

$tmpConfig = $configFile + ".tmp"
$config | ConvertTo-Json -Depth 10 | Set-Content -Path $tmpConfig -Encoding UTF8
Move-Item -Path $tmpConfig -Destination $configFile -Force
Write-Host "config.json written - $($scenesJson.Count) scenes"

Write-Host "All done."
