# Pixi Particles

[![CI](https://github.com/repepto/pixi-particles/actions/workflows/ci.yml/badge.svg)](https://github.com/repepto/pixi-particles/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A modular 2D particle engine for **TypeScript and PixiJS 8**, with a browser editor for authoring and exporting effects.

The engine and editor are separate packages. The editor consumes the engine as a **local npm tarball**; no private registry or account is required.

## Quick start

Requirements: Node.js 20 or newer and npm. `.nvmrc` selects Node.js 22. The first installation needs access to the public npm registry.

```sh
git clone https://github.com/repepto/pixi-particles.git
cd pixi-particles
npm run setup
npm run dev
```

Open the URL printed by Vite (normally `http://localhost:5173`). `setup` installs the engine dependencies, compiles the engine, creates `particle-core/particle-core-1.0.5.tgz`, updates its checksum in the editor lockfile, and installs the editor.

The repository and shareable archive include the tarball, so the editor can also be started directly:

```sh
cd particle-editor
npm ci
npm run dev
```

## Try an effect

1. Start with the default effect; drag in the preview to move its emitter.
2. Change a parameter and use **Apply Config** to rebuild the preview.
3. Use **Load Config** to select a JSON preset from `particle-editor/presets`.
4. Add another particle system to combine effects. Use **Get Configs** to export them together as a ZIP, then load that ZIP to restore the collection.

Built-in textures need no external assets. Raster and texture-sequence configurations refer to image filenames; the images are **not embedded** in configuration exports. Keep the images alongside your effects and use **Load Config** to select the JSON and all its images together when moving to another browser or machine. ZIP imports can reuse images previously cached this way; missing images produce an error and leave the current project intact. Directory access depends on browser support; ordinary image selection is also available.

## Commands

Run these from this directory:

| Command | Purpose |
| --- | --- |
| `npm run setup` | Install dependencies and rebuild/install the local core package |
| `npm run dev` | Run the editor with Vite |
| `npm run check` | Type-check both packages and run regression tests |
| `npm run build` | Repack the current core, install it in the editor, and build the editor |
| `npm run preview` | Serve the editor production build locally |
| `npm run release` | Repack, test, build, and create `release/particle-system-showcase.zip` |

After editing the engine, run `npm run build` or `npm run setup` so the editor receives the updated package. It deliberately tests the packaged API rather than resolving imports directly to the adjacent source folder. `npm run release` excludes Git history, editor settings, caches and installed dependencies from the archive.

## What the engine supports

- Point, circle and box emitters; continuous emission, initial bursts, timed bursts and bursts on demand.
- Pooled particles and reusable state, with constant-time removal from the active list.
- Local/world simulation space, finite/looping emission and prewarming.
- Lifetime curves for size, alpha, colour, scale and speed; gravity, turbulence, rotation and bouncing.
- Raster textures and frame sequences, plus generated built-in shapes.
- Serializable effect configurations and composition through `MultiParticleSystem`.

## Architecture

```text
particle-core/
  src/config/       Runtime and serialized configuration types
  src/contracts/    Small interfaces for effect modules
  src/modules/      Emitters, curves, forces and value providers
  src/system/       Simulation, pooling, configuration conversion
  tests/            Engine regression tests
particle-editor/
  src/config/       Editor state and configuration conversion
  src/preview/      Pixi application and preview lifecycle
  src/textures/     Built-in, raster and sequence textures
  src/ui/           Controls and interaction
  tests/            Import/export and lifecycle regression tests
scripts/            Local package and release preparation
```

Small module interfaces make new behaviours composable. The simulation reuses particle objects, state and temporary vectors to avoid per-particle allocations in the usual update path. Serialization is a boundary between authoring data and runtime module instances.

The core package contains compiled ESM, TypeScript declarations and source maps. See [its README](particle-core/README.md) for integration examples and lifecycle semantics.

## Verification and scope

The regression suite covers emission boundaries and replay, configuration changes, texture disposal, preview replacement and configuration import/export. Production builds run TypeScript checks. GitHub Actions installs from scratch, runs the checks, builds the editor and packages a downloadable showcase archive.

This is a browser-oriented authoring tool and engine sample. There is no measured performance guarantee or automated cross-browser rendering suite. Rendering cost depends on the particle count, enabled modules, textures and device; benchmark the intended effect on its target hardware. The editor controller remains the main place for further UI decomposition as features grow.

## License

[MIT](LICENSE). Copyright (c) 2026 Serhii Synelnykov.
