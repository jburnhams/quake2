# WebGPU Rendering Implementation - Master Overview

**Project:** Quake2TS WebGPU Renderer
**Version:** 1.0
**Last Updated:** 2025-12-19

---

## Executive Summary

This document provides a comprehensive plan to implement a WebGPU-based renderer alongside the existing WebGL2 renderer. The implementation will provide full feature parity with the current WebGL renderer while leveraging modern GPU APIs for improved performance and enabling headless Node.js rendering for automated testing.

**Current State:**
- WebGL2-only rendering pipeline (~5,000 lines across 15+ files)
- Well-abstracted architecture with clear pipeline separation
- Mock-based testing infrastructure
- No automated visual regression testing

**Target State:**
- Dual rendering backends: WebGL2 (existing) + WebGPU (new)
- Full feature parity between renderers
- Headless Node.js rendering with @webgpu/dawn
- PNG snapshot-based visual regression testing
- Extended renderer interface for WebGPU-specific features
- Compute shader implementations for advanced effects
- Estimated ~6,500 lines of new code

---

## Document Structure

This implementation is divided into **21 subsections** organized in **6 phases**:

| Section | Component | Priority | Phase | Dependencies |
|---------|-----------|----------|-------|--------------|
| [20-1](section-20-1.md) | WebGPU Context & Device Management | **CRITICAL** | 1 | None (start first) |
| [20-2](section-20-2.md) | Core Resource Abstractions | **CRITICAL** | 1 | 20-1 |
| [20-3](section-20-3.md) | Headless Testing Infrastructure | **CRITICAL** | 1 | 20-1, 20-2 |
| [20-4](section-20-4.md) | PNG Snapshot Testing Framework | **CRITICAL** | 1 | 20-3 |
| [20-5](section-20-5.md) | Sprite/2D Renderer (First Pipeline) | **HIGH** | 2 | 20-2 |
| [20-6](section-20-6.md) | Frame Rendering Orchestration | **HIGH** | 2 | 20-5 |
| [20-7](section-20-7.md) | Skybox Pipeline | **HIGH** | 3 | 20-2, 20-6 |
| [20-8](section-20-8.md) | BSP Surface Pipeline | **HIGH** | 3 | 20-2, 20-6 |
| [20-9](section-20-9.md) | MD2 Model Pipeline | **HIGH** | 3 | 20-2, 20-6 |
| [20-10](section-20-10.md) | MD3 Model Pipeline | **HIGH** | 3 | 20-2, 20-6 |
| [20-11](section-20-11.md) | Particle System | **HIGH** | 3 | 20-2, 20-6 |
| [20-12](section-20-12.md) | Dynamic Lighting System | **MEDIUM** | 4 | 20-8 |
| [20-13](section-20-13.md) | Post-Processing & Effects | **MEDIUM** | 4 | 20-6 |
| [20-14](section-20-14.md) | Debug Rendering | **MEDIUM** | 4 | 20-6 |
| [20-15](section-20-15.md) | Extended Renderer Interface | **MEDIUM** | 5 | 20-7 to 20-14 |
| [20-16](section-20-16.md) | Integration & Visual Regression Testing | **MEDIUM** | 5 | 20-15 |
| [20-17](section-20-17.md) | Performance Profiling Infrastructure | **LOW** | 5 | 20-15 |
| [20-18](section-20-18.md) | Compute: Particle Systems | **LOW** | 6 | 20-11, 20-15 |
| [20-19](section-20-19.md) | Compute: Dynamic Lighting | **LOW** | 6 | 20-12, 20-15 |
| [20-20](section-20-20.md) | Compute: Post-Processing | **LOW** | 6 | 20-13, 20-15 |
| [20-21](section-20-21.md) | Compute: Advanced Features | **LOW** | 6 | 20-15, 20-18 to 20-20 |

**Totals:** 21 Sections, ~180 Tasks, ~650 Subtasks (estimated)

---

## Implementation Strategy

### Phase Overview

```
Phase 1 (Foundation) - CRITICAL PATH
├─ 20-1: WebGPU Context & Device Management
├─ 20-2: Core Resource Abstractions (buffers, textures, shaders)
├─ 20-3: Headless Testing with @webgpu/dawn
└─ 20-4: PNG Snapshot Testing

Phase 2 (First Rendering) - PROOF OF CONCEPT
├─ 20-5: Sprite/2D Renderer (simplest pipeline)
└─ 20-6: Frame Rendering Orchestration

Phase 3 (Core Pipelines) - CAN PARALLELIZE
├─ 20-7: Skybox Pipeline
├─ 20-8: BSP Surface Pipeline (most complex)
├─ 20-9: MD2 Model Pipeline
├─ 20-10: MD3 Model Pipeline
└─ 20-11: Particle System

Phase 4 (Advanced Features) - CAN PARALLELIZE
├─ 20-12: Dynamic Lighting
├─ 20-13: Post-Processing & Effects
└─ 20-14: Debug Rendering

Phase 5 (Integration & Testing)
├─ 20-15: Extended Renderer Interface
├─ 20-16: Integration & Visual Regression Testing
└─ 20-17: Performance Profiling

Phase 6 (WebGPU Enhancements) - CAN PARALLELIZE
├─ 20-18: Compute Shaders - Particles
├─ 20-19: Compute Shaders - Dynamic Lighting
├─ 20-20: Compute Shaders - Post-Processing
└─ 20-21: Compute Shaders - Advanced Features
```

### Priority Levels

**CRITICAL (Phase 1):**
- Foundation for all other work
- Must be completed first
- Enables headless testing from day one
- Impact: Unlocks all subsequent phases

**HIGH (Phases 2-3):**
- Core rendering functionality
- Path to feature parity
- Impact: Visible rendering on screen

**MEDIUM (Phases 4-5):**
- Advanced rendering features
- Testing and integration
- Impact: Production readiness

**LOW (Phase 6):**
- WebGPU-specific enhancements
- Performance optimizations
- Impact: Beyond parity features

---

## Architectural Principles

### 1. Additive Changes Only

- **No modifications** to existing WebGL code unless absolutely necessary
- WebGPU code lives in separate `webgpu/` subdirectories
- Minimal shared interfaces only where needed for polymorphism
- Both renderers coexist independently

### 2. Separation of Concerns

```
packages/engine/src/render/
├── webgl/                    # Existing WebGL (minimal changes)
│   ├── resources.ts
│   ├── bspPipeline.ts
│   └── ...
│
├── webgpu/                   # New WebGPU (all new code)
│   ├── context.ts
│   ├── resources.ts
│   ├── pipelines/
│   │   ├── bspPipeline.ts
│   │   ├── md2Pipeline.ts
│   │   └── ...
│   ├── compute/
│   │   ├── particles.ts
│   │   ├── lighting.ts
│   │   └── ...
│   └── shaders/
│       ├── bsp.wgsl
│       ├── md2.wgsl
│       └── ...
│
├── interface.ts              # Minimal shared interfaces
└── renderer.ts               # Factory functions (extended)
```

### 3. Testing Philosophy

- **Unit tests** with mocked WebGPU objects for isolated logic
- **Integration tests** with headless @webgpu/dawn for real rendering
- **Visual regression** using PNG snapshots and pixelmatch
- **Performance tests** as separate phase (not blocking)

### 4. Incremental Delivery

Each section produces a **working, tested component**:
- Section 20-5 → Can render 2D sprites headlessly
- Section 20-7 → Can render skybox headlessly
- Section 20-8 → Can render BSP geometry headlessly
- Each milestone builds on previous

---

## Key Dependencies

### Critical Path

```
20-1 (Context) ──> 20-2 (Resources) ──> 20-3 (Headless) ──> 20-4 (Snapshots)
                                              │
                                              └──> 20-5 (2D) ──> 20-6 (Frame)
                                                                      │
                        ┌─────────────────────────────────────────────┴─────────────┐
                        │                                                           │
                   20-7 (Skybox)                                                20-8 (BSP)
                        │                                                           │
                   20-9 (MD2)                                                  20-12 (Lighting)
                        │                                                           │
                   20-10 (MD3)                                                      │
                        │                                                           │
                   20-11 (Particles) ────> 20-13 (Post-FX) ────> 20-14 (Debug)    │
                        │                        │                      │          │
                        └────────────────────────┴──────────────────────┴──────────┘
                                                  │
                                            20-15 (Interface)
                                                  │
                            ┌─────────────────────┴─────────────────────┐
                            │                                           │
                      20-16 (Testing)                            20-17 (Profiling)
                            │                                           │
                            └───────────────────┬───────────────────────┘
                                                │
                    ┌───────────────────────────┼───────────────────────────┐
                    │                           │                           │
              20-18 (Compute: Particles)  20-19 (Compute: Lighting)  20-20 (Compute: Post-FX)
                    │                           │                           │
                    └───────────────────────────┴───────────────────────────┘
                                                │
                                          20-21 (Compute: Advanced)
```

### Parallelization Opportunities

**Can work simultaneously after Phase 1:**
- 20-7, 20-8, 20-9, 20-10, 20-11 (all core pipelines)
- 20-12, 20-13, 20-14 (all advanced features)
- 20-18, 20-19, 20-20 (all compute shaders)

**Sequential dependencies:**
- Phase 1 must complete before Phase 2
- 20-6 must complete before Phase 3
- Phase 3 must complete before 20-15

---

## Project Structure

### New Files to Create (~40 files)

**WebGPU Core:**
- `packages/engine/src/render/webgpu/context.ts`
- `packages/engine/src/render/webgpu/resources.ts`
- `packages/engine/src/render/webgpu/frame.ts`

**WebGPU Pipelines (7 files):**
- `packages/engine/src/render/webgpu/pipelines/sprite.ts`
- `packages/engine/src/render/webgpu/pipelines/bspPipeline.ts`
- `packages/engine/src/render/webgpu/pipelines/md2Pipeline.ts`
- `packages/engine/src/render/webgpu/pipelines/md3Pipeline.ts`
- `packages/engine/src/render/webgpu/pipelines/skybox.ts`
- `packages/engine/src/render/webgpu/pipelines/particleSystem.ts`
- `packages/engine/src/render/webgpu/pipelines/postProcess.ts`
- `packages/engine/src/render/webgpu/pipelines/debug.ts`

**WGSL Shaders (8 files):**
- `packages/engine/src/render/webgpu/shaders/sprite.wgsl`
- `packages/engine/src/render/webgpu/shaders/bsp.wgsl`
- `packages/engine/src/render/webgpu/shaders/md2.wgsl`
- `packages/engine/src/render/webgpu/shaders/md3.wgsl`
- `packages/engine/src/render/webgpu/shaders/skybox.wgsl`
- `packages/engine/src/render/webgpu/shaders/particles.wgsl`
- `packages/engine/src/render/webgpu/shaders/postProcess.wgsl`
- `packages/engine/src/render/webgpu/shaders/debug.wgsl`

**Compute Shaders (4 files):**
- `packages/engine/src/render/webgpu/compute/particleUpdate.wgsl`
- `packages/engine/src/render/webgpu/compute/lightingAccum.wgsl`
- `packages/engine/src/render/webgpu/compute/postEffects.wgsl`
- `packages/engine/src/render/webgpu/compute/visibility.wgsl`

**Testing Infrastructure (6 files):**
- `packages/test-utils/src/engine/mocks/webgpu.ts`
- `packages/test-utils/src/setup/webgpu.ts`
- `packages/test-utils/src/visual/snapshots.ts`
- `packages/engine/tests/render/webgpu/context.test.ts`
- `packages/engine/tests/render/webgpu/resources.test.ts`
- `packages/engine/tests/integration/webgpu-rendering.test.ts`

**Interfaces (2 files):**
- `packages/engine/src/render/interface.ts` (minimal shared interfaces)
- `packages/engine/src/render/webgpu/renderer.ts`

### Files to Modify (minimal - ~5 files)

**Only for factory/export additions:**
- `packages/engine/src/render/renderer.ts` - Add `createWebGPURenderer()` export
- `packages/engine/src/render/index.ts` - Export WebGPU renderer
- `packages/engine/src/render/interface.ts` - Create new file for shared types
- `packages/engine/package.json` - Add @webgpu/types dependency
- `packages/test-utils/package.json` - Add @webgpu/dawn for headless testing

---

## Technology Stack

### Runtime Dependencies

**Browser WebGPU:**
- Native browser WebGPU API (Chrome 113+, Safari 18+)
- `@webgpu/types` for TypeScript definitions

**Node.js Headless:**
- `@webgpu/dawn` - Native WebGPU implementation for Node.js
- Enables real GPU rendering in CI/CD environments

### Development Dependencies

**Testing:**
- `vitest` (existing) - Test runner
- `pixelmatch` - PNG comparison for visual regression
- `pngjs` - PNG encoding/decoding
- WebGPU mocks for unit tests

**Shader Development:**
- WGSL (WebGPU Shading Language)
- No build step required (loaded as strings)

---

## Feature Parity Checklist

WebGPU renderer must support all existing WebGL features:

### Core Rendering
- [ ] Static world geometry (BSP surfaces)
- [ ] Lightmap application and blending
- [ ] Multi-style lightmap accumulation
- [ ] Dynamic point lights
- [ ] Texture scrolling/animation
- [ ] Skybox rendering with parallax
- [ ] MD2 character models with frame interpolation
- [ ] MD3 skeletal models with per-surface materials
- [ ] Particle systems (explosions, blood, trails)
- [ ] 2D sprite/HUD rendering
- [ ] Text rendering

### Advanced Features
- [ ] Water warping/refraction (post-processing)
- [ ] Underwater effects
- [ ] Gamma correction and brightness
- [ ] PVS-based visibility culling
- [ ] Frustum culling for entities
- [ ] Entity highlighting system
- [ ] Debug visualization (wireframe, bounds, normals, PVS)
- [ ] Render mode overrides (solid, faceted, etc.)

### Performance Features
- [ ] Geometry batching and sorting
- [ ] Texture atlas support
- [ ] GPU memory tracking
- [ ] Render statistics

---

## Testing Strategy

### Unit Tests (with mocks)

Each component has isolated unit tests:
- WebGPU context creation and configuration
- Resource management (buffers, textures, bind groups)
- Shader compilation and pipeline creation
- Individual pipeline logic

**Mocking Approach:**
Similar to existing `test-utils/src/mocks/webgl2.ts`, create `webgpu.ts` mock that simulates WebGPU API without actual GPU.

### Integration Tests (headless with @webgpu/dawn)

Real GPU rendering in Node.js:
- Complete frame rendering tests
- Multi-pipeline rendering
- Resource lifecycle tests
- Error handling and recovery

**Example Test:**
```typescript
test('renders BSP geometry with lightmaps', async () => {
  const device = await initHeadlessWebGPU();
  const renderer = createWebGPURenderer(device);

  // Render frame
  renderer.renderFrame(options, entities);

  // Capture output
  const snapshot = await captureFramebuffer(device);

  // Compare with baseline
  await expectSnapshot(snapshot).toMatchBaseline('bsp-lightmaps.png');
});
```

### Visual Regression Tests (PNG snapshots)

Key rendering scenarios captured as PNG baselines:
- Empty scene (skybox only)
- Simple BSP geometry
- Complex BSP with lightmaps
- Animated MD2 models
- Particle effects
- Post-processing effects
- Combined rendering scenarios

**Workflow:**
1. Run test with headless renderer
2. Capture framebuffer as PNG
3. Compare with baseline using pixelmatch
4. Fail if difference exceeds threshold
5. Manual review and approval for legitimate changes

### Performance Tests (Phase 5)

Separate performance test suite (not blocking):
- Frame time measurements
- GPU memory usage
- Draw call counts
- Compute shader performance
- Comparison with WebGL baseline

---

## Risk Mitigation

### Risk 1: WebGPU API Complexity

**Risk:** WebGPU is more verbose and complex than WebGL

**Mitigation:**
- Start with simplest pipeline (2D sprites)
- Build resource abstractions early
- Reference existing patterns in WebGL code
- Comprehensive documentation in code

### Risk 2: Shader Translation (GLSL → WGSL)

**Risk:** WGSL syntax and semantics differ from GLSL

**Mitigation:**
- Translate one shader at a time
- Test each shader in isolation
- Use shader validation tools
- Document translation decisions

### Risk 3: Headless Testing Reliability

**Risk:** @webgpu/dawn may have platform-specific issues

**Mitigation:**
- Test on multiple platforms early
- Provide clear setup documentation
- Have fallback to mock-based tests
- CI/CD environment validation

### Risk 4: Feature Parity Gaps

**Risk:** Missing subtle rendering differences between WebGL and WebGPU

**Mitigation:**
- Visual regression tests catch differences
- Side-by-side rendering comparisons
- Incremental feature validation
- Manual QA on complex scenes

### Risk 5: Performance Regression

**Risk:** WebGPU implementation slower than WebGL initially

**Mitigation:**
- Accept initial performance gaps
- Phase 6 dedicated to optimization
- Profile and optimize hot paths
- Leverage compute shaders for parallelism

---

## Success Criteria

### Phase 1 Complete (Foundation)
- [ ] WebGPU context creation working in browser and Node.js
- [ ] Resource abstractions (buffers, textures, shaders) implemented
- [ ] Headless rendering produces valid framebuffer output
- [ ] PNG snapshot testing framework functional

### Phase 2 Complete (First Rendering)
- [ ] 2D sprites render correctly (headless test validates)
- [ ] Frame rendering orchestration handles render passes
- [ ] Visual regression test for 2D rendering passes

### Phase 3 Complete (Core Pipelines)
- [ ] All 5 core pipelines implemented
- [ ] Visual regression tests for each pipeline
- [ ] Complex scenes render without visual artifacts

### Phase 4 Complete (Advanced Features)
- [ ] Dynamic lighting matches WebGL implementation
- [ ] Post-processing effects functional
- [ ] Debug rendering available

### Phase 5 Complete (Integration)
- [ ] Extended renderer interface supports all features
- [ ] Comprehensive integration test suite (20+ tests)
- [ ] Visual regression baseline established (30+ snapshots)
- [ ] Performance profiling infrastructure available

### Phase 6 Complete (Compute Enhancements)
- [ ] Compute shaders for particles, lighting, post-processing
- [ ] Performance improvements measurable
- [ ] New capabilities not possible with WebGL

### Overall Success
- [ ] 100% feature parity with WebGL renderer
- [ ] Zero visual regressions in automated tests
- [ ] Headless testing runs in CI/CD
- [ ] Documentation complete for all components
- [ ] Both renderers maintained independently

---

## Timeline Estimate

Based on 1-2 developers working incrementally:

**Phase 1: Foundation (2-3 weeks)**
- Critical path, cannot parallelize
- Sections 20-1 to 20-4
- Enables all subsequent work

**Phase 2: First Rendering (1 week)**
- Proof of concept
- Sections 20-5 to 20-6
- Validates approach

**Phase 3: Core Pipelines (4-6 weeks)**
- Can parallelize across multiple developers
- Sections 20-7 to 20-11
- Bulk of rendering work

**Phase 4: Advanced Features (2-3 weeks)**
- Can parallelize
- Sections 20-12 to 20-14
- Completes feature parity

**Phase 5: Integration & Testing (2 weeks)**
- Sequential after Phase 4
- Sections 20-15 to 20-17
- Production readiness

**Phase 6: Compute Enhancements (3-4 weeks)**
- Can parallelize
- Sections 20-18 to 20-21
- Beyond parity features

**Total Duration:** 14-19 weeks with 1-2 developers

---

## Getting Started

### Prerequisites

```bash
# Install dependencies
npm install --save-dev @webgpu/types
npm install --save-dev @webgpu/dawn  # For headless testing
npm install --save-dev pixelmatch pngjs
```

### Recommended Approach

1. **Read Section 20-1 first** - WebGPU context management
2. **Complete Phase 1 sequentially** - Foundation is critical
3. **Branch strategy:**
   - One branch per phase (e.g., `feat/webgpu-phase-1-foundation`)
   - Or one branch per section for granular PRs
   - Merge to main after each phase completes

4. **Testing strategy:**
   - Write tests alongside implementation
   - Run headless tests for each component
   - Build visual regression baseline incrementally

5. **Review strategy:**
   - Architectural review for Phase 1 (critical decisions)
   - Code review for each section
   - Visual review for regression test baselines

### First Steps

```bash
# Create WebGPU directory structure
cd quake2ts/packages/engine/src/render
mkdir -p webgpu/{pipelines,shaders,compute}

# Begin Section 20-1: WebGPU Context
touch webgpu/context.ts

# Follow section-20-1.md checklist
```

---

## Appendix: Quick Reference

### Section Quick Links

**Phase 1: Foundation**
- [Section 20-1: WebGPU Context & Device](section-20-1.md)
- [Section 20-2: Core Resource Abstractions](section-20-2.md)
- [Section 20-3: Headless Testing Infrastructure](section-20-3.md)
- [Section 20-4: PNG Snapshot Testing](section-20-4.md)

**Phase 2: First Rendering**
- [Section 20-5: Sprite/2D Renderer](section-20-5.md)
- [Section 20-6: Frame Rendering Orchestration](section-20-6.md)

**Phase 3: Core Pipelines**
- [Section 20-7: Skybox Pipeline](section-20-7.md)
- [Section 20-8: BSP Surface Pipeline](section-20-8.md)
- [Section 20-9: MD2 Model Pipeline](section-20-9.md)
- [Section 20-10: MD3 Model Pipeline](section-20-10.md)
- [Section 20-11: Particle System](section-20-11.md)

**Phase 4: Advanced Features**
- [Section 20-12: Dynamic Lighting](section-20-12.md)
- [Section 20-13: Post-Processing & Effects](section-20-13.md)
- [Section 20-14: Debug Rendering](section-20-14.md)

**Phase 5: Integration**
- [Section 20-15: Extended Renderer Interface](section-20-15.md)
- [Section 20-16: Integration & Visual Regression Testing](section-20-16.md)
- [Section 20-17: Performance Profiling](section-20-17.md)

**Phase 6: Compute Enhancements**
- [Section 20-18: Compute - Particle Systems](section-20-18.md)
- [Section 20-19: Compute - Dynamic Lighting](section-20-19.md)
- [Section 20-20: Compute - Post-Processing](section-20-20.md)
- [Section 20-21: Compute - Advanced Features](section-20-21.md)

### Browser Compatibility

**WebGPU Support:**
- Chrome/Edge 113+ (stable)
- Safari 18+ (stable)
- Firefox: Behind flag (experimental)

**Fallback Strategy:**
- Feature detection at runtime
- Gracefully fallback to WebGL2 if WebGPU unavailable
- User-facing applications handle renderer selection

---

**Next Steps:** Begin with [Section 20-1: WebGPU Context & Device Management](section-20-1.md)
