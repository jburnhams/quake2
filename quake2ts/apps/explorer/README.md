# Quake 2 explorer

Browse Quake 2 PAK files in the browser: a folder tree of every open PAK, the chosen file drawn as
what it is, and its facts. A rewrite of [quake2ts-explorer](https://github.com/jburnhams/quake2ts-explorer)
on [strata-react](https://github.com/jburnhams/strata-react), reading files through the monorepo's
libraries (`strata-vfs`, `@quake2ts/formats`) rather than the whole engine.

```bash
pnpm --filter @quake2ts/explorer dev      # http://localhost:5173, opens on the demo PAK
pnpm --filter @quake2ts/explorer test     # Vitest + Testing Library + MSW, against the demo PAK
pnpm --filter @quake2ts/explorer build    # typecheck, then dist/
apps/explorer/scripts/build-site.sh .paks/q2-314-demo-x86.exe   # the Pages site (from quake2ts/)
```

The site is this app: the intro at `/` (`src/screens/IntroScreen.tsx`), the explorer at `/explore`,
and the game at `/play` (`src/screens/PlayScreen.tsx`, `src/play/session.ts`): `LocalHost` runs
`map demo1` at 40 Hz and the engine's WebGL renderer draws the world from the player's eyes. It
imports `@quake2ts/engine` and `@quake2ts/server` from their `dist/`, so run `pnpm run build` in
`quake2ts/` before the typecheck or a build.
`.github/workflows/pages.yml` builds and deploys it on every push to main that touches `quake2ts/`.
`scripts/fetch-paks.sh --unpinned` keeps the archive in `.paks/` for a local site build.

It opens on the committed demo PAK (`public/pak.pak` links to `quake2ts/pak.pak`); the GitHub Pages
build opens on the demo's whole `baseq2/pak0.pak` instead, which the browser takes out of the original
demo archive (`src/library/demo.ts`, `src/library/zip.ts`), since id's demo licence lets only the
unmodified archive be passed on. The archive is kept in Cache Storage, so it downloads once. **Open PAK files**
mounts more above it, as the game's search path does, so a later PAK wins any path it shares.

| File | Shown as |
|---|---|
| `.pcx`, `.wal`, `.tga` | The picture at a whole-number zoom; WAL through `pics/colormap.pcx`'s palette, with its surface flags and contents named |
| `.bsp` | Title, size figures, a sortable entity table (`?sort=`), and its textures as links |
| `.md2`, `.md3` | Size figures, animations or surfaces, skins as links |
| `.sp2` | Frames, each linking to its picture |
| `.wav` | A player, with rate, channels and length |
| `.cfg`, `.txt` and other text | The text |
| Anything else (`.dm2` for now) | The first 512 bytes |

The chosen file and the open folders are in the URL (`?file=maps/demo1.bsp&open=maps/`), so a view
can be linked.

## Layout

- `src/library/`: the open PAKs in one `VirtualFileSystem` (`Library`), its React context, and the demo PAK read.
- `src/files/`: the tree (strata `Tree`) and the details pane (strata `Inspector`).
- `src/preview/`: `decode.ts` (bytes to what is drawn; tested in Node) and the previews.
- `src/screens/ExplorerScreen.tsx`: the strata `Workspace` of three panes.
- `src/labs/`: what every lab shares: `LabScreen` (the frame: sliders left, stage right, Reset),
  `LabScene` (demo1 through the engine's WebGL renderer with the lab's lines in it, on the
  `orbit.ts` camera), `params.ts` (numbers on sliders held in the URL) and `world.ts` (demo1's
  collision and player start, read once for every lab).
- `src/labs/movement/`: the movement lab (`/labs/movement`): the game's `runPmove` on demo1 with its
  constants on sliders held in the URL, drawn beside the run the game's values give. `simulate.ts` is
  the run, pure and tested in Node on demo1.
- `src/labs/traces/`: the traces lab (`/labs/traces`): a box swept from demo1's player start by the
  game's `traceBox`, aimed by sliders, with the mask a choice of the game's callers; it says how far
  the box got and the face it met (normal, slope, contents, surface flags). `trace.ts` is the sweep.
- `src/routes.tsx`: the route tree, shared by `main.tsx` and the tests (`renderRoutes`).

## Still in the old explorer

3D map and model views, demo playback, the game mode and the analysis tools move over as their
libraries split out (renderer, demo, LocalHost); see [`../../LIBRARIES.md`](../../LIBRARIES.md).
