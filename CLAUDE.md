# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev            # Remotion Studio (live preview at localhost)
npm run lint           # ESLint + TypeScript type-check (eslint src && tsc)
npm run validate       # Check public/script.txt without generating anything
npm run audio          # validate + generate-audio.ps1 (TTS, enhance, lip sync, config.json)
npm run render         # render.ps1 for the platform in [Meta] (or render:youtube / render:shorts)
npm run factory        # audio + render, end to end
npx remotion compositions   # real frame counts after calculateMetadata
```

## Core Requirements

- **Always use 60fps** for all compositions. This is a hard requirement — never change it.
- **Windows PowerShell 5.1** runs the `.ps1` scripts. Keep string literals ASCII-only (use `--`, not `—`): BOM-less UTF-8 is read as ANSI and a non-ASCII byte can terminate a string.

## Pipeline

`public/script.txt` (source of truth) → `validate-script.ps1` → `generate-audio.ps1` → `public/config.json` + `public/audio/` → Remotion (`src/Root.tsx`) → `render.ps1` → `out/<meta.name>/<Platform>/<platform>.mp4` (+ `script.txt` and `config.json` snapshot).

- `generate-audio.ps1`: parses script.txt (incl. `[Meta]` block), applies auto-direction (closeups / zoom transitions), and per dialogue line runs edge-tts → ffmpeg → Resemble Enhance (WSL) → loudnorm → rhubarb. Hash-based cache in `public/audio/.audiocache.json`. `public/audio/` is gitignored; `config.json` is committed.
- `render.ps1`: reads real durations from `npx remotion compositions` (not from config.json) and blocks Shorts over 60s.

## Architecture

[Remotion](https://www.remotion.dev) project — videos are React components rendered frame by frame. Entry point `src/index.ts` → `registerRoot(RemotionRoot)`.

**Compositions** (`src/Root.tsx`): `Youtube` (1920×1080) and `Shorts` (1080×1920), both 60fps, same `VideoFactory` component. `calculateMetadata` → `loadConfig()` fetches `config.json` and, per scene:
- derives clip timing (from precomputed `durationMs`, falling back to `parseMedia`), loads VTT captions and rhubarb mouth cues
- sets scene length from its clips (300 frames if none), then **extends it until every animation finishes** (`LIMB_ANIMATIONS[type].duration`)
- pads the last pre-outro scene to a music-loop boundary **only when music is not muted**

**`src/VideoFactory/`:**
- `types.ts` — `VideoConfig`, `SceneConfig`, `AudioConfig`, `AnimationEvent`, `BackgroundConfig` (chessboard only)
- `VideoFactory.tsx` — sequences scenes and intro/loop/outro music
- `Scene.tsx` — background, zoom transitions, audio + bleeps + SFX, characters (animations, glitch, lip sync), name tags, captions
- `SubtitleOverlay.tsx` — TikTok-style captions, max 5 words per page, active word white
- `characters/` — character components + `characterRegistry` (`index.ts`); `limbAnimations.ts` defines every animation's `duration` and `evaluate`
- `backgrounds/` — `ChessboardBackground` only (dark `#141414`/`#1F1F1F`, tile 80)
- `utils/` — `seededRand` (`sr`, deterministic randomness), mouth shapes, blink, VTT parsing
- `fonts.ts` — Press Start 2P (Google Fonts)

**`characters.json`** (repo root) is the single source of truth for characters: voice, rate/pitch, default position and name tag. `generate-audio.ps1` and `validate-script.ps1` read it, and `characters/index.ts` is type-checked against it (`satisfies Record<CharacterId, ...>`), so a character missing a component fails `npm run lint`. Animation names are read by `validate-script.ps1` straight from the `LIMB_ANIMATIONS` keys in `limbAnimations.ts` (keep the two-space `  "name": {` format).

To add a character: add it to `characters.json` (with `voice` if it speaks), add its component to `characters/` and the registry. To add an animation: add it to `LIMB_ANIMATIONS`.

## Remotion rules (partly enforced by ESLint)

- No CSS `transition`/`animation`; drive everything from `useCurrentFrame()`.
- `<Audio volume>` must be a callback: `volume={() => v}`.
- No `Math.random()` / `random(null)` — use `sr()` so every render worker draws the same frames.
- `calculateMetadata` gets no `fps`; use the `FPS` constant in `Root.tsx`.
- Static assets live in `public/` and are loaded via `staticFile()`.
