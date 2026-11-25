# Libraries

The monorepo is being split into libraries in two tiers (Track B of the plan). Each tier depends only
on the tier below. Packages start `private` and live here until they are mature; the old import
paths keep working through re-exports while code moves.

## General tier (`strata-*`): no Quake knowledge

| Package | Holds | Comes from | Status |
|---|---|---|---|
| [`strata-binary`](packages/strata-binary) | Little-endian reader and growable writer | `shared/src/io` | Split |
| [`strata-math`](packages/strata-math) | vec3, mat4, angles, windings, MT19937 | `shared/src/math` | Split |
| [`strata-vfs`](packages/strata-vfs) | Mount archives in order, look up, list and stream files; LRU cache | `engine/src/assets/vfs.ts`, `cache.ts` | Split |
| `strata-loop` | Fixed-step simulation tick with render interpolation | `engine/src/loop.ts` | Planned |
| `strata-console` | Cvars with flags, command registry and parser | `engine/src/cvars.ts`, `commands.ts` | Planned |
| `strata-gl` | WebGL shader programs, buffers, atlas packing | `engine/src/render` (non-Quake parts) | Planned |
| `strata-audio` | WebAudio channels, attenuation, OGG and WAV decode | `engine/src/audio` | Planned |
| `strata-netchan` | Sequenced reliable and unreliable messages over any transport | `shared/src/net` | Planned |
| `strata-bsp` | Box sweeps through a BSP of convex brushes, PVS | `shared/src/bsp` | After the trace oracle passes |

## Quake 2 tier (`@quake2ts/*`)

| Package | Holds | Comes from | Status |
|---|---|---|---|
| [`@quake2ts/formats`](packages/formats) | PAK, BSP, MD2, MD3, SP2, PCX, WAL, TGA, WAV, entity lump | `engine/src/assets` | Split |
| `@quake2ts/demo` | Protocol 34 and rerelease messages, dm2 read and write | `engine/src/demo`, `shared/src/protocol` | Planned |
| `@quake2ts/renderer` | BSP world, lightmaps, sky, MD2 and MD3, particles | `engine/src/render` | After first light |
| `@quake2ts/pmove` | `runPmove` and its helpers | `shared/src/pmove` | After the pmove oracle passes |

## Rules

- A small public API and a README per package; no import from a higher tier
  (`packages/tools/src/validate-deps.ts` checks the existing packages).
- Tests against real data or the C oracle, not mocks. Unit tests live in `tests/` and run in the
  root node suite (`pnpm test:unit:node`).
- A private package's `exports` point at its TypeScript source, so Vitest, Vite and `tsc -b`
  (through project references) use it without a build or an alias. Packages that are published
  bundle it (`tsup` inlines it), so it is a `devDependency` of theirs.
- A library that simulates (movement, collision, monster AI, the renderer) can be driven on its
  own, because the explorer's labs run the real code with sliders on its behaviour: a pure step
  (state in, state out, the world as functions such as `trace`), its constants as one typed
  object whose defaults are the game's (`PmoveTuning` and `DEFAULT_PMOVE_TUNING` for `runPmove`),
  output a demo can draw, and no game, DOM or GPU dependency.
- Released per library, once the explorer ([`apps/explorer`](apps/explorer), on strata-react) uses it.

## Consumers

- [`apps/explorer`](apps/explorer): the PAK browser, on `strata-vfs` and `@quake2ts/formats`, and the
  movement lab, on `@quake2ts/shared`'s pmove and BSP collision (through its source subpaths).
- The game packages (`engine`, `client`, `server`, `game`), through the old paths for now.
