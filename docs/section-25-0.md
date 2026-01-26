# Section 25-0: BSP Generation Tools - Overview

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

| Section | Title | Dependencies | Parallelizable With |
|---------|-------|--------------|---------------------|
| 25-1 | Foundation & Infrastructure | None | - |
| 25-2 | Winding & Polygon Math | 25-1 | 25-3 |
| 25-3 | Map Parser | 25-1 | 25-2, 25-4 |
| 25-4 | Primitive Builder (MVP) | 25-2 | 25-3 |
| 25-5 | CSG Operations | 25-2 | - |
| 25-6 | BSP Tree Construction | 25-5 | - |
| 25-7 | Portals & Visibility | 25-6 | 25-8 |
| 25-8 | Lighting & Lightmaps | 25-6 | 25-7 |

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

- [ ] Generate valid BSP from programmatic primitives
- [ ] Parse and compile standard .map files
- [ ] Output matches WASM reference within floating-point tolerance
- [ ] Generated BSPs load in quake2ts engine
- [ ] Performance acceptable for real-time procedural generation of simple maps
