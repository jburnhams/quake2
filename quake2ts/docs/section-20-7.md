# Section 20-7: Skybox Pipeline

**Phase:** 3 (Core Pipelines)
**Priority:** HIGH
**Dependencies:** 20-2 (Resources), 20-6 (Frame Orchestration)
**Estimated Effort:** 2-3 days

---

## Overview

Implement skybox rendering with cubemap textures. Relatively simple pipeline, good warm-up for more complex BSP rendering.

**Reference Implementation:** `packages/engine/src/render/skybox.ts` (162 lines)

---

## Tasks

1. **Translate WGSL Shader** (`shaders/skybox.wgsl`)
   - Cubemap sampling
   - View direction calculation
   - Reference: `skybox.ts` lines 15-94

2. **Implement SkyboxPipeline** (`pipelines/skybox.ts`)
   - Cube geometry generation
   - Cubemap texture binding
   - Depth test configuration (always pass, no write)
   - Reference: `skybox.ts:SkyboxRenderer`

3. **Cubemap Texture Loading**
   - TextureCubeMap from section 20-2
   - 6 face uploads
   - Mipmap generation

4. **Integration Tests**
   - Headless rendering test
   - Cubemap sampling test

5. **Visual Regression Tests**
   - `skybox-basic.png` - Simple gradient sky
   - `skybox-scrolling.png` - Parallax scrolling sky

**Test Cases:**
- Skybox renders behind all geometry
- Cubemap sampled correctly
- No depth writes
- Scrolling animation works

**Reference:** `packages/engine/src/render/skybox.ts`

---

**Next Section:** [20-8: BSP Surface Pipeline](section-20-8.md)
