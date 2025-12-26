# WebGL Headless Visual Testing - Master Overview

**Project:** Quake2TS WebGL Visual Regression Testing
**Version:** 1.0
**Last Updated:** 2025-12-26

---

## Executive Summary

This document provides a comprehensive plan to implement headless visual regression testing for the existing WebGL renderer. The implementation will create a parallel testing infrastructure to the WebGPU visual tests, enabling automated detection of rendering regressions across all WebGL rendering features.

**Current State:**
- Production WebGL2 renderer (~8,000+ lines across 30+ files)
- Comprehensive rendering features (BSP, models, particles, post-processing)
- WebGPU visual tests exist but WebGL has no visual regression testing
- Manual testing required to catch visual bugs

**Target State:**
- Headless WebGL visual testing using `gl` package (headless-gl)
- PNG snapshot-based regression testing for all rendering features
- Parallel CI/CD pipeline (GitHub Actions + Pages)
- Comprehensive test coverage organized by rendering feature
- Shared test infrastructure with WebGPU tests where possible
- Estimated ~40-50 high-value visual tests covering all major features

---

## Document Structure

This implementation is divided into **19 subsections** organized in **5 phases**:

| Section | Component | Priority | Phase | Dependencies |
|---------|-----------|----------|-------|--------------|
| [21-1](section-21-1.md) | Infrastructure & Test Utilities | **CRITICAL** | 1 | None (start first) |
| [21-2](section-21-2.md) | CI/CD Pipeline & GitHub Pages | **CRITICAL** | 1 | 21-1 |
| [21-3](section-21-3.md) | 2D Rendering (Sprites, UI, Text) | **HIGH** | 2 | 21-1 |
| [21-4](section-21-4.md) | Texture & Material System | **HIGH** | 2 | 21-1 |
| [21-5](section-21-5.md) | Skybox Rendering | **HIGH** | 2 | 21-1 |
| [21-6](section-21-6.md) | BSP World Geometry & Lightmaps | **HIGH** | 3 | 21-1, 21-4 |
| [21-7](section-21-7.md) | Water & Warp Surfaces | **HIGH** | 3 | 21-6 |
| [21-8](section-21-8.md) | Transparent Surfaces & Blending | **HIGH** | 3 | 21-6 |
| [21-9](section-21-9.md) | MD2 Character Models | **HIGH** | 3 | 21-1, 21-4 |
| [21-10](section-21-10.md) | MD3 Skeletal Models | **HIGH** | 3 | 21-1, 21-4 |
| [21-11](section-21-11.md) | Dynamic Lighting System | **MEDIUM** | 4 | 21-6 |
| [21-12](section-21-12.md) | Light Styles & Animation | **MEDIUM** | 4 | 21-6, 21-11 |
| [21-13](section-21-13.md) | Particle Systems | **MEDIUM** | 4 | 21-1 |
| [21-14](section-21-14.md) | Post-Processing (Underwater Warp) | **MEDIUM** | 4 | 21-6 |
| [21-15](section-21-15.md) | Bloom Effects | **MEDIUM** | 4 | 21-6 |
| [21-16](section-21-16.md) | Debug Rendering & Visualization | **MEDIUM** | 4 | 21-6, 21-9, 21-10 |
| [21-17](section-21-17.md) | PVS & Culling Validation | **LOW** | 5 | 21-6 |
| [21-18](section-21-18.md) | Render Modes & Overrides | **LOW** | 5 | 21-6, 21-9, 21-10 |
| [21-19](section-21-19.md) | Full Scene Integration Tests | **LOW** | 5 | All previous |

**Totals:** 19 Sections, ~50 visual tests, ~15-20 new files

---

## Implementation Strategy

### Phase Overview

```
Phase 1 (Foundation) - CRITICAL PATH
├─ 21-1: Headless WebGL infrastructure, test utilities
└─ 21-2: CI/CD pipeline, GitHub Actions, Pages deployment

Phase 2 (Basic Rendering) - PARALLEL READY
├─ 21-3: 2D rendering (sprites, UI, text)
├─ 21-4: Texture & material system
└─ 21-5: Skybox rendering

Phase 3 (Core 3D) - PARALLEL READY
├─ 21-6: BSP world geometry & lightmaps (foundation for others)
├─ 21-7: Water & warp surfaces
├─ 21-8: Transparent surfaces
├─ 21-9: MD2 character models
└─ 21-10: MD3 skeletal models

Phase 4 (Advanced Features) - PARALLEL READY
├─ 21-11: Dynamic lighting
├─ 21-12: Light styles & animation
├─ 21-13: Particle systems
├─ 21-14: Post-processing (underwater warp)
├─ 21-15: Bloom effects
└─ 21-16: Debug rendering

Phase 5 (Integration & Edge Cases) - SEQUENTIAL
├─ 21-17: PVS & culling validation
├─ 21-18: Render modes & overrides
└─ 21-19: Full scene integration
```

### Priority Levels

**CRITICAL (Phase 1):**
- Foundation for all testing
- Must be completed first and sequentially
- Enables all subsequent work
- Impact: Unlocks parallel development

**HIGH (Phases 2-3):**
- Core rendering features
- Most valuable visual tests
- Impact: Catches 90% of visual bugs

**MEDIUM (Phase 4):**
- Advanced rendering features
- Important but less frequently broken
- Impact: Comprehensive coverage

**LOW (Phase 5):**
- Edge cases and integration
- Complex scenarios
- Impact: Production confidence

---

## Architectural Principles

### 1. Additive Changes Only

- **No modifications** to existing WebGL renderer code
- WebGL visual tests live in separate `tests/webgl/visual/` directory
- Shared test utilities in `test-utils` package
- Both WebGL and WebGPU tests coexist independently

### 2. Code Reuse Strategy

```
packages/test-utils/src/
├── visual/
│   └── snapshots.ts              # SHARED - renderer-agnostic snapshot utilities
├── setup/
│   ├── webgpu.ts                 # WebGPU-specific setup (existing)
│   └── headless-webgl.ts         # WebGL-specific setup (NEW)
├── engine/helpers/
│   ├── webgpu-rendering.ts       # WebGPU helpers (existing)
│   └── webgl-rendering.ts        # WebGL helpers (NEW)
└── shared/
    └── rendering-common.ts       # SHARED - common utilities (NEW)
```

### 3. Test Organization

Tests organized by **rendering feature**, not by file structure:

```
packages/engine/tests/webgl/visual/
├── README.md                      # Setup and usage guide
├── 2d/
│   ├── sprites.test.ts
│   ├── text.test.ts
│   └── ui-elements.test.ts
├── world/
│   ├── bsp-geometry.test.ts
│   ├── lightmaps.test.ts
│   ├── water-surfaces.test.ts
│   └── transparent-surfaces.test.ts
├── models/
│   ├── md2-basic.test.ts
│   ├── md2-lod.test.ts
│   ├── md3-basic.test.ts
│   └── md3-attachments.test.ts
├── lighting/
│   ├── dynamic-lights.test.ts
│   └── light-styles.test.ts
├── effects/
│   ├── particles.test.ts
│   ├── underwater-warp.test.ts
│   └── bloom.test.ts
├── debug/
│   ├── wireframe.test.ts
│   └── collision-vis.test.ts
├── integration/
│   ├── full-scene.test.ts
│   └── render-modes.test.ts
└── __snapshots__/
    ├── baselines/
    ├── actual/
    ├── diff/
    └── stats/
```

### 4. Testing Philosophy

- **High-value tests** - Each test validates distinct visual output
- **Minimal duplication** - Avoid testing same feature multiple times
- **Manual baseline review** - All baselines require human approval
- **Deterministic rendering** - Disable time-based animations in tests
- **Clear failure diagnosis** - Diff images show exactly what changed

---

## Technology Stack

### Headless WebGL

**Package:** `gl` (formerly `stackgl/headless-gl`)
- Provides WebGL 1.0/2.0 contexts in Node.js
- Works without display/window
- Platform support:
  - **Linux:** Uses Mesa OpenGL (likely already installed)
  - **macOS:** Uses system OpenGL (built-in)
  - **Windows:** Uses ANGLE (bundled)

**System Dependencies:**
- Linux: Typically no additional deps (Mesa already present for WebGPU)
- macOS: None (system OpenGL)
- Windows: None (ANGLE bundled)

### Visual Testing

**Existing Infrastructure (reuse):**
- `pngjs` - PNG encoding/decoding
- `pixelmatch` - Pixel-by-pixel comparison
- `vitest` - Test runner

**New Infrastructure:**
- `gl` - Headless WebGL context
- Custom helpers for WebGL framebuffer readback

---

## Key Dependencies

### Critical Path

```
21-1 (Infrastructure) ──> 21-2 (CI/CD)
         │
         ├──> 21-3 (2D)
         ├──> 21-4 (Textures) ──> 21-6 (BSP) ──┬──> 21-7 (Water)
         ├──> 21-5 (Skybox)                     ├──> 21-8 (Transparent)
         ├──> 21-9 (MD2)                        ├──> 21-11 (Lighting) ──> 21-12 (Light Styles)
         ├──> 21-10 (MD3)                       ├──> 21-14 (Warp)
         └──> 21-13 (Particles)                 ├──> 21-15 (Bloom)
                                                 └──> 21-16 (Debug)
                                                            │
                                    ┌───────────────────────┴───────────────────────┐
                                    │                                               │
                              21-17 (PVS/Culling)                           21-18 (Render Modes)
                                    │                                               │
                                    └───────────────────┬───────────────────────────┘
                                                        │
                                                  21-19 (Integration)
```

### Parallelization Opportunities

**Can work simultaneously after Phase 1:**
- 21-3, 21-4, 21-5, 21-9, 21-10, 21-13 (no dependencies on BSP)
- 21-7, 21-8, 21-11, 21-12, 21-14, 21-15, 21-16 (after 21-6 completes)

**Sequential dependencies:**
- Phase 1 must complete before all others
- 21-6 (BSP) must complete before most Phase 4 tests
- Phase 5 should be done after Phase 4

---

## WebGL Rendering Features Coverage

### Core Rendering (HIGH Priority)

✓ **2D Rendering**
- Sprites (`SpriteRenderer`)
- UI elements (rectangles, lines)
- Text rendering with font textures
- Texture sampling and filtering

✓ **World Geometry**
- BSP surface rendering (`BspSurfacePipeline`)
- Lightmap application and blending
- Multi-style lightmap accumulation
- Texture coordinate generation
- Surface batching and sorting

✓ **Models**
- MD2 character models (`Md2Pipeline`)
  - Frame interpolation
  - LOD system
  - Tinting and lighting
- MD3 skeletal models (`Md3Pipeline`)
  - Multi-surface rendering
  - Model attachments
  - Per-surface materials

✓ **Skybox**
- 6-sided cubemap rendering (`SkyboxPipeline`)
- Texture scrolling animation
- Depth testing behavior

### Advanced Features (MEDIUM Priority)

✓ **Lighting**
- Static lightmaps
- Dynamic point lights (`DLight`)
- Light culling
- Light styles (pulsing, flickering)
- Brightness/gamma/fullbright modes

✓ **Special Surfaces**
- SURF_WARP (animated water)
- SURF_TRANS33/66 (transparent surfaces)
- SURF_SKY (sky surfaces)
- Texture scrolling/animation

✓ **Effects**
- Particle systems (`ParticleSystem`, `ParticleRenderer`)
- Post-processing underwater warp (`PostProcessPipeline`)
- Bloom effects (`BloomPipeline`)

✓ **Debug**
- Wireframe rendering (`DebugRenderer`)
- Collision visualization (`CollisionVisRenderer`)
- Bounding box display
- Normal visualization
- PVS debugging

### Integration (LOW Priority)

✓ **Culling & Optimization**
- PVS (Potentially Visible Set) culling
- Frustum culling
- Light culling
- Portal/area visibility

✓ **Render Modes**
- Textured (default)
- Wireframe
- Solid color
- Faceted (per-triangle colors)
- Entity/surface highlighting

---

## Project Structure

### New Files to Create (~15-20 files)

**Test Infrastructure:**
- `packages/test-utils/src/setup/headless-webgl.ts` (~150 lines)
- `packages/test-utils/src/engine/helpers/webgl-rendering.ts` (~200 lines)
- `packages/test-utils/src/shared/rendering-common.ts` (~100 lines)

**CI/CD:**
- `.github/workflows/webgl-visual.yml` (~80 lines)
- `packages/tools/src/generate-webgl-gallery.ts` (adapt existing)

**Documentation:**
- `packages/engine/tests/webgl/visual/README.md` (~200 lines)

**Visual Tests (~40-50 test files):**
- 2D rendering: 3 test files
- World geometry: 4 test files
- Models: 4 test files
- Lighting: 2 test files
- Effects: 3 test files
- Debug: 2 test files
- Integration: 2 test files

### Files to Modify (minimal)

**Package configuration:**
- `packages/engine/package.json` - Add `gl` dev dependency, new test scripts
- `packages/test-utils/package.json` - Add `gl` dev dependency
- `packages/test-utils/src/visual/snapshots.ts` - Minor refactor for renderer-agnostic use

**No modifications to:**
- Existing WebGL renderer code
- Existing WebGPU tests
- Any production code

---

## Success Criteria

### Phase 1 Complete (Foundation)
- [ ] Headless WebGL context creation working in Node.js
- [ ] Framebuffer readback produces valid RGBA pixel data
- [ ] Snapshot comparison framework functional for WebGL
- [ ] CI/CD pipeline builds and runs tests
- [ ] GitHub Pages deploys visual test results

### Phase 2 Complete (Basic Rendering)
- [ ] 2D sprite rendering validated
- [ ] Texture loading and filtering verified
- [ ] Skybox rendering correct
- [ ] 10+ visual tests passing

### Phase 3 Complete (Core 3D)
- [ ] BSP geometry renders correctly
- [ ] Lightmaps apply properly
- [ ] Water surfaces warp correctly
- [ ] MD2 and MD3 models render
- [ ] 25+ visual tests passing

### Phase 4 Complete (Advanced)
- [ ] Dynamic lights accumulate correctly
- [ ] Light styles animate properly
- [ ] Particles render and blend
- [ ] Post-processing effects work
- [ ] 40+ visual tests passing

### Phase 5 Complete (Integration)
- [ ] Full scenes render correctly
- [ ] PVS culling validated
- [ ] Render modes work
- [ ] 50+ visual tests passing

### Overall Success
- [ ] Zero modifications to production renderer code
- [ ] All visual tests pass in CI
- [ ] Baseline images reviewed and approved
- [ ] Documentation complete
- [ ] GitHub Pages shows test results
- [ ] Can catch regressions automatically

---

## Timeline Estimate

Based on 1-2 developers working incrementally:

**Phase 1: Foundation (1 week)**
- Critical path, cannot parallelize
- Sections 21-1 to 21-2
- Enables all subsequent work

**Phase 2: Basic Rendering (1 week)**
- Can parallelize across developers
- Sections 21-3 to 21-5
- Establishes test patterns

**Phase 3: Core 3D (2-3 weeks)**
- Can parallelize after 21-6
- Sections 21-6 to 21-10
- Bulk of visual coverage

**Phase 4: Advanced Features (2 weeks)**
- Can parallelize
- Sections 21-11 to 21-16
- Comprehensive coverage

**Phase 5: Integration (1 week)**
- Sequential after Phase 4
- Sections 21-17 to 21-19
- Edge cases and confidence

**Total Duration:** 7-10 weeks with 1-2 developers

---

## Getting Started

### Prerequisites

```bash
# Navigate to engine package
cd quake2ts/packages/engine

# Install headless WebGL dependency
pnpm add -D gl @types/gl
```

### Recommended Approach

1. **Read Section 21-1 first** - Infrastructure setup
2. **Complete Phase 1 sequentially** - Foundation is critical
3. **Branch strategy:**
   - One branch per phase (e.g., `feat/webgl-visual-phase-1`)
   - Or one branch per section for granular PRs
   - Merge to main after each phase completes

4. **Testing strategy:**
   - Write tests alongside implementation
   - Generate baselines, manually review each one
   - Start with simple tests, build complexity
   - Aim for high-value tests, not exhaustive coverage

5. **Review strategy:**
   - Code review for test utilities
   - Visual review for ALL baseline images
   - Integration review for CI/CD pipeline

### First Steps

```bash
# Create test directory structure
cd quake2ts/packages/engine/tests
mkdir -p webgl/visual/{2d,world,models,lighting,effects,debug,integration,__snapshots__}

# Begin Section 21-1: Infrastructure
# Follow section-21-1.md checklist
```

---

## Comparison with WebGPU Tests

| Aspect | WebGPU Tests | WebGL Tests |
|--------|-------------|-------------|
| **Maturity** | New, evolving | Production renderer |
| **Organization** | Disorganized, needs refactor | Organized by feature |
| **Coverage** | ~8 test files | ~20 test files (planned) |
| **Headless** | `webgpu` package (Dawn) | `gl` package |
| **System Deps** | mesa-vulkan-drivers | Minimal/none |
| **Readback** | Async (buffer mapping) | Sync (readPixels) |
| **Y-axis** | Top-down | Bottom-up (flip needed) |

**Key Advantage:** WebGL tests validate the production renderer actually used by users.

---

## Appendix: Quick Reference

### Section Quick Links

**Phase 1: Foundation**
- [Section 21-1: Infrastructure & Test Utilities](section-21-1.md)
- [Section 21-2: CI/CD Pipeline & GitHub Pages](section-21-2.md)

**Phase 2: Basic Rendering**
- [Section 21-3: 2D Rendering](section-21-3.md)
- [Section 21-4: Texture & Material System](section-21-4.md)
- [Section 21-5: Skybox Rendering](section-21-5.md)

**Phase 3: Core 3D**
- [Section 21-6: BSP World Geometry & Lightmaps](section-21-6.md)
- [Section 21-7: Water & Warp Surfaces](section-21-7.md)
- [Section 21-8: Transparent Surfaces & Blending](section-21-8.md)
- [Section 21-9: MD2 Character Models](section-21-9.md)
- [Section 21-10: MD3 Skeletal Models](section-21-10.md)

**Phase 4: Advanced Features**
- [Section 21-11: Dynamic Lighting System](section-21-11.md)
- [Section 21-12: Light Styles & Animation](section-21-12.md)
- [Section 21-13: Particle Systems](section-21-13.md)
- [Section 21-14: Post-Processing (Underwater Warp)](section-21-14.md)
- [Section 21-15: Bloom Effects](section-21-15.md)
- [Section 21-16: Debug Rendering & Visualization](section-21-16.md)

**Phase 5: Integration**
- [Section 21-17: PVS & Culling Validation](section-21-17.md)
- [Section 21-18: Render Modes & Overrides](section-21-18.md)
- [Section 21-19: Full Scene Integration Tests](section-21-19.md)

---

**Next Steps:** Begin with [Section 21-1: Infrastructure & Test Utilities](section-21-1.md)
