# Quake 2 explorer

Browse Quake 2 PAK files in the browser: a folder tree of every open PAK, the chosen file drawn as
what it is, and its facts. A rewrite of [quake2ts-explorer](https://github.com/jburnhams/quake2ts-explorer)
on [strata-react](https://github.com/jburnhams/strata-react), reading files through the monorepo's
libraries (`strata-vfs`, `@quake2ts/formats`) rather than the whole engine.

```bash
pnpm --filter @quake2ts/explorer dev      # http://localhost:5173, opens on the demo PAK
pnpm --filter @quake2ts/explorer test     # Vitest + Testing Library + MSW, against the demo PAK
pnpm --filter @quake2ts/explorer build    # typecheck, then dist/
apps/explorer/scripts/build-site.sh .paks/q2-314-demo-x86.exe   # the Pages site (from the repository root)
```

The site is this app: the intro at `/` (`src/screens/IntroScreen.tsx`), the explorer at `/explore`,
and the game at `/play` (`src/screens/PlayScreen.tsx`, `src/play/session.ts`): `LocalHost` runs
`map demo1` at 40 Hz and the engine's WebGL renderer draws the world from the player's eyes. It
imports `@quake2ts/engine` and `@quake2ts/server` from their `dist/`, so run `pnpm run build` at
the repository root before the typecheck or a build.
`.github/workflows/pages.yml` builds and deploys it on every push to main.
`scripts/fetch-paks.sh --unpinned` keeps the archive in `.paks/` for a local site build.

It opens on the committed demo PAK (`public/pak.pak` links to `pak.pak`); the GitHub Pages
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
  the run, pure and tested in Node on demo1. Its second view (`?view=air`, `AirView.tsx`, `air.ts`)
  takes one frame of the air move apart to show why strafe-jumping beats the top speed, with presets
  for Quake III and QuakeWorld.
- `src/labs/net/`: the lag lab (`/labs/lag`): one player through a client, a server and a network
  with latency, jitter and loss, on the port's NetChan and runPmove arranged as id's client and
  server are (`simulate.ts`: three commands a packet, net_drop, CL_PredictMovement,
  CL_CheckPredictionError), with a packet strip and id's code beside the port's.
- `src/labs/pvs/`: the visibility lab (`/labs/pvs`): demo1 from above, each floor filled by what
  the renderer does with it from an eye held in the URL (its own cluster, drawn, cut off by the shut
  door's area portal, or outside the PVS), by the engine's own culling (`pvs.ts`); a click on a floor
  moves the eye. The 3D view stands the renderer at the eye (`LabScene standAt`, with the door's
  portal set), so the same cull is what it draws. id's ref_gl and cmodel code beside the port's.
- `src/labs/slide/`: the slide and step lab (`/labs/slide`): a second of running from a place in
  demo1 (a wall met at 45°, a staircase) by the game's `runPmove`, with every trace it asks for
  recorded (`slide.ts`), so one frame is taken apart: each sweep, what it met, the step up and the
  push down. STEPSIZE and the heading are on sliders; id's PM_ClipVelocity, PM_StepSlideMove_Generic
  and PM_StepSlideMove (2023 and 1997) beside the port's `frame.ts`.
- `src/labs/light/`: the light styles lab (`/labs/light`): one of demo1's lights with a style
  (the flickering room's style 6, or the strobe's style 4) played letter by letter in the engine's
  renderer, or as another pattern of the game's table or typed; the view can draw lightmaps only or
  textures only. `light.ts` counts the faces each style lights. id's SP_worldspawn table,
  CL_SetLightstyle and CL_RunLightStyles, R_BuildLightMap and SP_light beside the port's.
- `src/labs/source/`: id's code beside the port's. `excerpt.ts` cuts a function out of a file by
  name; the labs read `rerelease/` and `full/` (outside the workspace, allowed in `vite.config.ts`)
  and the port's files with `?raw`, so what is shown is what runs.
- `src/labs/traces/`: the traces lab (`/labs/traces`): a box swept from demo1's player start by the
  game's `traceBox`, aimed by sliders, with the mask a choice of the game's callers; it says how far
  the box got and the face it met (normal, slope, contents, surface flags). `trace.ts` is the sweep.
- `src/routes.tsx`: the route tree, shared by `main.tsx` and the tests (`renderRoutes`).

## Still in the old explorer

3D map and model views, demo playback, the game mode and the analysis tools move over as their
libraries split out (renderer, demo, LocalHost); see [`../../LIBRARIES.md`](../../LIBRARIES.md).
