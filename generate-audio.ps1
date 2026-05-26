# powershell -ExecutionPolicy Bypass -File .\generate-audio.ps1
#
# Reads public/script.txt, writes public/config.json, then generates
# audio files (mp3 + vtt + mouth.json) for every line of dialogue.
#
# script.txt format:
#
#   === scene-id [durationInFrames=N] [tileSize=N] ===
#   @tileSize: 200          (optional scene-level override)
#   @durationInFrames: 120  (optional fixed duration)
#   [character [x=0.75] [y=0.5] [size=2] [wave] [nametag]]
#   dialogue text here
#   (more lines...)
#
#   [next-character ...]
#   more dialogue
#
# Flags on character tag:
#   wave    -> animateHand: true
#   nametag -> show name tag (label/color defined per character below)
#   size=5  -> close-up; size=2 -> normal (default)
#   x=0.5   -> horizontal position (0.0-1.0); default per character
#   y=0.5   -> vertical position (0.0-1.0); default 0.5

$audioDir   = ".\public\audio"
$scriptFile = ".\public\script.txt"
$configFile = ".\public\config.json"

# ---------------------------------------------------------------------------
# Character config
# ---------------------------------------------------------------------------

$voices = @{
    # "dirtbag" = "en-US-AnaNeural"
    "dirtbag" = "en-US-AnaNeural"
    "bryan"   = "en-GB-MaisieNeural"
}

$voiceArgs = @{
    # "dirtbag" = @("--rate=-5%")
    # "bryan"   = @("--pitch=+25Hz")
    "dirtbag" = @("--rate=+15%", "--pitch=+5Hz")
    "bryan"   = @("--rate=+15%", "--pitch=+15Hz")
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

$beepFile = ".\public\sfx\censor-beep.wav"
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

Write-Host "Cleaning $audioDir..."
Get-ChildItem $audioDir -File | Where-Object {
    $_.Extension -in @(".mp3", ".vtt", ".json", ".txt", ".wav")
} | Remove-Item -Force
Write-Host "Done."

# ---------------------------------------------------------------------------
# Parsing helpers
# ---------------------------------------------------------------------------

function Parse-SceneHeader($line) {
    if ($line -notmatch '^\s*===\s*(.+?)\s*===\s*$') { return $null }
    $parts = $matches[1].Trim() -split '\s+'
    $result = @{ id = $parts[0]; durationInFrames = $null; tileSize = $null }
    foreach ($part in $parts[1..($parts.Count - 1)]) {
        if ($part -match '^durationInFrames=(\d+)$') { $result.durationInFrames = [int]$matches[1] }
        if ($part -match '^tileSize=(\d+)$')         { $result.tileSize         = [int]$matches[1] }
    }
    return $result
}

function Parse-CharTag($line) {
    if ($line -notmatch '^\s*\[(.+?)\]\s*$') { return $null }
    $parts    = $matches[1].Trim() -split '\s+'
    $charName = $parts[0].ToLower()
    $def      = $script:charDefaults[$charName]
    $result   = @{
        name      = $charName
        x         = if ($def) { $def.x }    else { 0.5 }
        y         = if ($def) { $def.y }    else { 0.5 }
        size      = if ($def) { $def.size } else { 2 }
        wave      = $null
        nametag   = $false
        trimStart = $null
        trimEnd   = $null
        padEnd    = $null
    }
    foreach ($part in $parts[1..($parts.Count - 1)]) {
        if    ($part -match '^x=(.+)$')                { $result.x         = [double]$matches[1] }
        elseif ($part -match '^y=(.+)$')                { $result.y         = [double]$matches[1] }
        elseif ($part -match '^size=(\d+)$')            { $result.size      = [int]$matches[1] }
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
# Parse script.txt
# ---------------------------------------------------------------------------

$scenes     = [System.Collections.Generic.List[hashtable]]::new()
$clips      = [System.Collections.Generic.List[PSCustomObject]]::new()
$sceneIndex = @{}

$curScene = $null
$curChar  = $null
$curLines = [System.Collections.Generic.List[string]]::new()

function Flush-Clip {
    if ($null -eq $script:curScene -or $null -eq $script:curChar) { return }
    $text = ($script:curLines | Where-Object { $_.Trim() -ne '' }) -join ' '
    if ($text.Trim() -eq '') { return }

    $sid  = $script:curScene.id
    $char = $script:curChar.name

    if (-not $script:sceneIndex.ContainsKey($sid)) { $script:sceneIndex[$sid] = 0 }
    $script:sceneIndex[$sid]++
    $idx = $script:sceneIndex[$sid]

    # Detect [bleep] markers — record word positions, strip brackets for TTS
    # Handles trailing punctuation: [shit]! -> shit!
    $bleepWordIndices = [System.Collections.Generic.List[int]]::new()
    $censoredWordsList = [System.Collections.Generic.List[string]]::new()
    $words = $text -split '\s+'
    for ($w = 0; $w -lt $words.Count; $w++) {
        if ($words[$w] -match '^\[(.+?)\]') {
            $bleepWordIndices.Add($w)
            $censoredWordsList.Add($matches[1])
            $words[$w] = $words[$w] -replace '^\[(.+?)\]', '$1'
        }
    }
    $ttsText  = $words -join ' '
    $wordCount = $words.Count

    $audioEntry = [ordered]@{
        src         = "audio/$sid-$char-$idx.mp3"
        subtitles   = "audio/$sid-$char-$idx.vtt"
        mouthCues   = "audio/$sid-$char-$idx-mouth.json"
        characterId = $char
    }
    if ($censoredWordsList.Count -gt 0) {
        $audioEntry.censoredWords = $censoredWordsList.ToArray()
    }
    if ($null -ne $script:curChar.trimStart) { $audioEntry.trimStart = $script:curChar.trimStart }
    if ($null -ne $script:curChar.trimEnd)   { $audioEntry.trimEnd   = $script:curChar.trimEnd   }
    if ($null -ne $script:curChar.padEnd)    { $audioEntry.padEnd    = $script:curChar.padEnd    }
    $script:curScene.audioList.Add($audioEntry)

    $script:clips.Add([PSCustomObject]@{
        Scene            = $sid
        Character        = $char
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

foreach ($line in (Get-Content $scriptFile)) {
    $sh = Parse-SceneHeader $line
    if ($sh) {
        Flush-Clip; Flush-Scene
        if ($seenSceneIds.ContainsKey($sh.id)) {
            Write-Warning "Duplicate scene id '$($sh.id)' - skipping second occurrence"
            $curScene = $null
            $curChar  = $null
            $curLines = [System.Collections.Generic.List[string]]::new()
            continue
        }
        $seenSceneIds[$sh.id] = $true
        $curScene = @{
            id               = $sh.id
            durationInFrames = $sh.durationInFrames
            tileSize         = $sh.tileSize
            transition       = $null
            charMap          = [ordered]@{}
            audioList        = [System.Collections.Generic.List[object]]::new()
            sfxList          = [System.Collections.Generic.List[object]]::new()
            animList         = [System.Collections.Generic.List[object]]::new()
        }
        $curChar  = $null
        $curLines = [System.Collections.Generic.List[string]]::new()
        continue
    }

    if ($line -match '^\s*@tileSize:\s*(\d+)') {
        if ($curScene) { $curScene.tileSize = [int]$matches[1] }
        continue
    }

    if ($line -match '^\s*@durationInFrames:\s*(\d+)') {
        if ($curScene) { $curScene.durationInFrames = [int]$matches[1] }
        continue
    }

    if ($line -match '^\s*@transition:\s*([\w-]+)') {
        if ($curScene) { $curScene.transition = $matches[1] }
        continue
    }

    if ($line -match '^\s*@animate:\s+([\w-]+)\s+([\w=-]+)\s+at=([\d.]+)s(.*)') {
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

    if ($line -match '^\s*@sfx:\s*([\S]+)\s+at=([\d.]+)s') {
        if ($curScene) {
            $curScene.sfxList.Add([ordered]@{ src = $matches[1]; atMs = [math]::Round([double]$matches[2] * 1000) })
        }
        continue
    }

    $ct = Parse-CharTag $line
    if ($ct) {
        Flush-Clip
        $curChar  = $ct
        $curLines = [System.Collections.Generic.List[string]]::new()
        if (-not $curScene.charMap.Contains($ct.name)) {
            $curScene.charMap[$ct.name] = $ct
        }
        continue
    }

    $curLines.Add($line)
}
Flush-Clip; Flush-Scene

# ---------------------------------------------------------------------------
# Build and write config.json
# ---------------------------------------------------------------------------

$scenesJson = [System.Collections.Generic.List[object]]::new()

foreach ($scene in $scenes) {
    $obj = [ordered]@{ id = $scene.id }

    if ($null -ne $scene.durationInFrames) { $obj.durationInFrames = $scene.durationInFrames }
    if ($null -ne $scene.tileSize)         { $obj.tileSize         = $scene.tileSize }
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
    intro = [ordered]@{ src = "assets/intro.wav"; volume = 0.3 }
    loop  = [ordered]@{ src = "assets/loop.wav";  volume = 0.3 }
    outro = [ordered]@{ src = "assets/outro.wav"; volume = 0.3 }
}

$config = [ordered]@{
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

    $preview = $clip.Text.Substring(0, [Math]::Min(60, $clip.Text.Length))
    Write-Host "[$base] $preview..."

    Set-Content -Path $tmp -Value $clip.Text -Encoding UTF8

    Write-Host "  1/3 edge-tts..."
    $charArgs = $voiceArgs[$clip.Character]
    $rateVal  = "+0%"
    $pitchVal = "+0Hz"
    foreach ($a in $charArgs) {
        if ($a -match '^--rate=(.+)$')  { $rateVal  = $matches[1] }
        if ($a -match '^--pitch=(.+)$') { $pitchVal = $matches[1] }
    }
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

    Write-Host "  2/3 ffmpeg (mp3 -> wav)..."
    ffmpeg -y -i $mp3 $wav 2>$null
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $wav)) {
        Write-Warning "  ffmpeg failed - skipping rhubarb for [$base]"
    } else {
        Write-Host "  3/3 rhubarb (wav -> mouth.json)..."
        rhubarb -f json -o $json $wav
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "  rhubarb failed (exit $LASTEXITCODE) for [$base]"
        }
        Remove-Item $wav -ErrorAction SilentlyContinue
    }

    Remove-Item $tmp -ErrorAction SilentlyContinue
    Write-Host "  done."
}

$tmpConfig = $configFile + ".tmp"
$config | ConvertTo-Json -Depth 10 | Set-Content -Path $tmpConfig -Encoding UTF8
Move-Item -Path $tmpConfig -Destination $configFile -Force
Write-Host "config.json written - $($scenesJson.Count) scenes"

Write-Host "All done."
