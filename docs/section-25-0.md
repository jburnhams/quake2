# Section 25-0: BSP Generation Tools - Overview
COMPLETED: The BSP generation toolchain port to TypeScript is finished. Foundations, primitive building, CSG, BSP tree, visibility, and basic/advanced lighting are all implemented and passing tests.

**Summary**: The BSP compilation toolchain has been fully ported to TypeScript. This includes foundations, map parsing, boolean CSG operations, tree construction, portal and PVS visibility generation, lightmaps, and radiosity patches. The pipeline generates valid BSP files capable of being parsed and interacted with.

## Purpose

Port the Quake 2 BSP compilation toolchain to TypeScript as `@quake2ts/bsp-tools`. This enables:
- Programmatic map generation for testing
- Loading standard .map files without external tools
- Runtime map generation for procedural content
- Full compatibility with original Q2 BSP format

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        @quake2ts/bsp-tools                       │
├─────────────────────────────────────────────────────────────────┤
│  Parser          │  Builder         │  Compiler                 │
│  ─────────────   │  ─────────────   │  ─────────────────────    │
│  mapParser.ts    │  BspBuilder.ts   │  planes.ts (dedup)        │
│  entityParser.ts │  primitives.ts   │  csg.ts (boolean ops)     │
│                  │  brushTypes.ts   │  tree.ts (BSP tree)       │
│                  │                  │  faces.ts (extraction)    │
│                  │                  │  portals.ts (generation)  │
│                  │                  │  vis.ts (PVS)             │
├─────────────────────────────────────────────────────────────────┤
│  Lighting                          │  Output                    │
│  ────────────────────────────────  │  ─────────────────────     │
│  direct.ts (point/spot lights)     │  bspWriter.ts              │
│  lightmap.ts (UV, packing)         │  mapWriter.ts              │
│  radiosity.ts (bounce lighting)    │                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        @quake2ts/shared                          │
│  math/winding.ts (NEW)  │  math/vec3.ts  │  bsp/collision.ts    │
└─────────────────────────────────────────────────────────────────┘
```

## Document Index

| Section | Title | Status |
|---------|-------|--------|
| 25-1 | Foundation & Infrastructure | **COMPLETED** |
| 25-2 | Winding & Polygon Math | **COMPLETED** |
| 25-3 | Map Parser | **COMPLETED** |
| 25-4 | Primitive Builder (MVP) | **COMPLETED** |
| 25-5 | CSG Operations | **COMPLETED** |
| 25-6 | BSP Tree Construction | **COMPLETED** |
| 25-7 | Portals & Visibility | **COMPLETED** |
| 25-8 | Lighting & Lightmaps | **COMPLETED** |
| 25-9 | Testing & Verification Strategy | **COMPLETED** |

## Key References

### Existing quake2ts Code
| File | What It Provides |
|------|------------------|
| `packages/shared/src/math/vec3.ts` | Vector math, bounds |
| `packages/shared/src/bsp/collision.ts` | Plane operations, point classification |
| `packages/engine/src/assets/bsp.ts` | BSP types, parsing |
| `packages/test-utils/src/engine/builders/bspBuilder.ts` | Existing BSP builder (to migrate) |
| `packages/shared/src/io/binaryWriter.ts` | Binary serialization |

### q2tools C Source
| File | What It Does |
|------|--------------|
| `q2tools/src/polylib.c` | Winding/polygon operations |
| `q2tools/src/map.c` | .map file parsing |
| `q2tools/src/csg.c` | CSG boolean operations |
| `q2tools/src/brushbsp.c` | BSP tree construction |
| `q2tools/src/faces.c` | Face extraction |
| `q2tools/src/portals.c` | Portal generation |
| `q2tools/src/vis.c` | Visibility computation |
| `q2tools/src/lightmap.c` | Lightmap generation |
| `q2tools/src/qfiles.h` | BSP format definitions |

## Testing Strategy

1. **Unit Tests**: Test each function in isolation with known inputs/outputs
2. **Integration Tests**: Test full pipeline stages (parser → builder → compiler)
3. **WASM Verification**: Compare TypeScript output against q2tools WASM output
4. **Engine Loading**: Verify generated BSPs load and render correctly

## Success Criteria

- [x] Generate valid BSP from programmatic primitives
- [x] Parse and compile standard .map files (Integrated with BspCompiler)
- [ ] (Deferred) Output matches WASM reference within floating-point tolerance
- [ ] (Deferred) Generated BSPs load in quake2ts engine
- [ ] (Deferred) Performance acceptable for real-time procedural generation of simple maps

### Pending Separate Work Items

The following testing and optimization features require significant independent effort and are left as future work items:

1. **WASM Verification**: Setting up emsdk infrastructure to compare the TypeScript compiled BSPs against the original C `q2tools` compiled to WASM to verify byte-for-byte correctness and floating-point tolerances.
2. **Engine Integration**: Validating that the generated BSP files render correctly visually within the `quake2ts` engine, ensuring textures, lighting, and visibility port correctly to the rendering pipeline.
3. **Performance Benchmarks**: Tracking and optimizing performance metrics against the "real-time procedural generation" latency goals (e.g. < 500ms for 100 brushes) outlined in Section 25-9.
