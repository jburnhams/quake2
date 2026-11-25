# Renderer plan: one front end, two backends

Started 2026-11-25. Jonathan asked whether the WebGL and WebGPU renderers can share one
abstraction, and how to finish both. Short answer: yes, but above the GPU calls, not as a
wrapper around them.

## Where it stood (2026-11-25)

- `IRenderer` (`render/interface.ts`) is already the shared public face. Under it are two copies
  of the same frame logic, `render/frame.ts` (WebGL) and `render/webgpu/frame.ts`, each about
  560 lines: PVS and frustum walk, opaque/transparent split, sort, then one draw per face.
- Every renderer test was synthetic (a quad or a box). All 87 WebGL and 150 WebGPU tests passed
  while the real map rendered wrong. The shared `expectSnapshot` also passes any image that is
  less than 75% different, so most baselines guard very little.
- Real-map bugs the demo1 gate found and that are fixed in the first PR:
  - **Texture coordinates were never divided by the texture's size**, so every texture repeated
    once per world unit and surfaces looked untextured (both backends).
  - **Lightmap sizes were guessed** from the lump's per-face length (which runs to the next
    face), and `createBspSurfaces` threw "Unsupported lightmap channel count" on demo1. Lightmap
    UVs mapped the surface's extremes to the first and last luxel instead of using
    `texturemins` as the original does, and a multi-style face's UVs spanned all its style
    layers.
  - **World geometry needed a WebGL context** (`buildBspGeometry(gl, …)`); WebGPU could only
    draw a map by copying buffers off WebGL surfaces.
  - **WebGPU drew no textures or lightmaps** (commented out as "Simplified for WebGPU POC").
  - **WebGPU gave every face the last face's uniforms**: one uniform buffer was rewritten with
    `queue.writeBuffer` per face inside one pass, and all writes land before the pass runs.
    A "worldPos is offset by surface mins" shader workaround was compensating for this.
  - WebGPU index uploads of one triangle (6 bytes) failed: `writeBuffer` needs a multiple of 4.
  - The WebGL surface list was filtered (hidden classnames) but looked up by BSP face number.
  - No overbright: Quake 2 lightmaps hold half intensity and both original renderers double them.

## Target shape

```
           prepareWorld(map, files)          GPU-free: worker, Node, browser
                     │  PreparedWorld: interleaved vertices, indices, lightmap atlas pixels,
                     │  RGBA textures with mips, light styles
        ┌────────────┴────────────┐
  uploadWorldWebGL(gl, w)   webgpuRenderer.uploadWorld(w)
        └────────────┬────────────┘
        per frame: shared front end → draw list → backend executes it
```

1. **Front end, no GPU code** (`@quake2ts/renderer` core). World preparation (done:
   `render/prepareWorld.ts`), then per frame: visibility (PVS + frustum + areaportals), surface
   classification, sort, and a **draw list**: plain records of pass, pipeline key (opaque,
   alpha, warp, sky, model, sprite, particle, 2D), texture and lightmap page, index range and
   per-draw values (scroll, alpha, style factors). Unit-tested in Node against demo1.
2. **Backends** run the draw list. Each owns resources, pipelines and its shaders, written by
   hand side by side (GLSL 300 es and WGSL) with one TS description of the uniform layout.
   Target: a few hundred lines each plus shaders, against about 6k lines per backend today.
   - WebGL2: one VAO for the world, `drawElements` ranges batched by texture and lightmap page.
   - WebGPU: per-draw values in a dynamic-offset uniform ring (done for BSP), bind groups cached
     per texture pair, one render bundle per static batch later.
3. **strata-gl** holds what is not Quake: WebGL2 program, buffer, texture, VAO and render
   target helpers, pixel capture for tests, and the WebGPU equivalents as `strata-gl/webgpu`
   (proposed; the library-split thread updates `LIBRARIES.md`).

Why not a thin GL-style wrapper (one "device" API both backends implement)? WebGL is a state
machine and WebGPU is pipelines and bind groups; a wrapper either recreates WebGL's state machine
on WebGPU (slow, and it hides WebGPU's validation) or forces WebGL into pipeline objects it cannot
cache. Engines that support both (Babylon, PlayCanvas, three.js's WebGPURenderer) share scene
logic and generate per-backend command streams instead.

## Phases and their gates

Every phase lands with the demo1 gate green in both backends, plus new shots for what it adds.

| # | Phase | Gate |
|---|---|---|
| 0 | **demo1 gate** (done): 5 spawn-point shots through `prepareWorld`, both backends, strict baselines, cross-backend parity under 0.5% | `tests/webgpu/demo1.test.ts`, `tests/webgl/demo1.test.ts`, `tests/unit-node/render/demo1-parity.test.ts` |
| 1 | **First light in the client**: fill the client's empty "Construct world state" with `prepareWorld` + upload; pick WebGPU when present, else WebGL | Playwright walkthrough screenshot shows the world; tell the library-split thread "first light" |
| 2a | **Shared front end + draw list** (done): `render/worldDrawList.ts` does visibility, opaque/transparent split, sort, light styles, animated textures (texinfo chains, 2 Hz) and batch boundaries; both `frame.ts` files only execute it. Surface state, light-style factors, render modes, frame stats and the world state type have one copy (`utils/surface.ts`, `frame.ts`) | Same demo1 baselines; `tests/unit-node/render/worldDrawList.test.ts` on demo1 |
| 2b | **One world VB/IB per backend, batched draws, back-face culling in both** | Draw calls per shot drop from about 1 per face to about 1 per texture/lightmap pair; same baselines |
| 3 | **Sky, warp, flowing, transparent surfaces** from the draw list; sky from worldspawn `sky` | demo1 shots facing sky and water reach full coverage |
| 4 | **Models**: brush models (doors, lifts) with entity transforms (done: `brushModels` in the frame options, `brushModelsFromEntities` in `render/sceneEntities.ts`, back faces culled per R_DrawInlineBModel); MD2s from game entities and the view weapon (done: `prepareModels`, `uploadModels`, `modelEntitiesFromEntities`, `viewWeaponEntity`; WebGPU MD2 draws get their own uniforms and meshes, as BSP draws do; frames blend over the 100 ms animation step, timed by `FrameLerpTracker` for a source that only knows the current frame, shot `view-blaster-blend`); MD3 (WebGPU has no MD3 or particles yet); model-only preview for the explorer | demo1 shots with monsters and items; explorer model preview |
| 5 | **Effects and 2D**: particles, sprites, dlights, HUD and console text, post (gamma, underwater warp, bloom) | HUD shot; dlight shot |
| 6 | **Cleanup and split**: delete the per-face path, `render/bsp/geometry.ts` (a second `buildBspGeometry`), the surface-mins field, `logging`/`null` renderers if unused; move to `@quake2ts/renderer` and `strata-gl` | Package boundary checks; explorer uses the packages |

Lighting rules both backends now share: a translucent or warping surface is drawn unlit at its
texture's colour (R_DrawAlphaSurfaces), dynamic lights add only to lightmapped surfaces
(R_AddDynamicLights), and blending leaves the framebuffer's alpha at 1.

## API the explorer asked for (agreed with the library-split thread)

- `prepareWorld(map, files)` with `files` any `{ readFile(path): Promise<Uint8Array> }`; palette
  from `pics/colormap.pcx`; no DOM, so it runs in a worker. (Done.)
- A backend takes an app-owned canvas or context, a camera as matrices or as origin and angles,
  renders on demand, and has `resize(width, height)` and `dispose()`.
- One MD2 or MD3 at a chosen frame with no world (model preview).

## Running the gate

```sh
scripts/fetch-paks.sh                      # demo pak0.pak into .paks/ (CI: .github/actions/demo-paks)
pnpm run build
cd packages/engine
VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.json pnpm test:webgpu tests/webgpu/demo1.test.ts
pnpm test:webgl tests/webgl/demo1.test.ts
UPDATE_VISUAL=1 …                          # rewrite baselines; look at them first
```

Baselines are `packages/engine/tests/demo1/__snapshots__/baselines/{webgl,webgpu}-<shot>.png`;
a failing shot writes `actual/` beside them, and CI uploads the folder.
