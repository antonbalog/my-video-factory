# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Remotion Studio (live preview at localhost)
npm run build     # Bundle the video
npm run lint      # Run ESLint + TypeScript type-check (eslint src && tsc)
npx remotion render                              # Render default composition
npx remotion render HelloWorld out/video.mp4    # Render specific composition
```

## Core Requirements

- **Always use 60fps** for VideoFactory compositions. This is a hard requirement — never change it.

## Architecture

This is a [Remotion](https://www.remotion.dev) project — videos are React components rendered frame-by-frame.

**Entry point:** `src/index.ts` calls `registerRoot(RemotionRoot)`.

**Compositions** are registered in `src/Root.tsx`. Each `<Composition>` defines a renderable video with an `id`, React component, `durationInFrames`, `fps`, dimensions, and optional zod `schema` for typed props.

**Current compositions:**
- `HelloWorld` — original template composition (1920×1080, 150 frames @ 30fps)
- `OnlyLogo` — isolated logo component from the template
- `VideoFactory` — dynamic JSON-driven composition (1920×1080, 60fps); duration and props are computed at render time via `calculateMetadata` by fetching `public/config.json`

**VideoFactory architecture (`src/VideoFactory/`):**
- `types.ts` — `SceneConfig` and `VideoConfig` TypeScript types
- `Scene.tsx` — renders a single scene from a `SceneConfig` (background color, etc.)
- `VideoFactory.tsx` — sequences all scenes using `<Sequence>`, computing frame offsets from `durationInFrames`
- `public/config.json` — scene definitions loaded at runtime via `staticFile("config.json")`

`calculateMetadata` in `Root.tsx` fetches `config.json`, sums all scene `durationInFrames` for the total composition length, and passes the full config as props to `VideoFactory`.

**Key Remotion APIs used:**
- `useCurrentFrame()` — returns current frame number
- `useVideoConfig()` — returns `{ fps, durationInFrames, width, height }`
- `spring()` / `interpolate()` — animation primitives
- `<Sequence from={N}>` — delays child rendering by N frames
- `<AbsoluteFill>` — shorthand for absolutely positioned full-size div

**Prop validation:** Component props are typed via zod schemas using `z.object()` and `@remotion/zod-types` (e.g., `zColor()` for color values). Schemas are passed to `<Composition schema={...}>`.

**Static assets** live in `public/` and are accessible at runtime via `staticFile()` from remotion.

**Config** (`remotion.config.ts`): output format set to `jpeg`, overwrite output enabled.

**Shared constants** (colors, fonts) live in `src/HelloWorld/constants.ts`.
