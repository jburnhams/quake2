# Section 20-7: Skybox Pipeline

## COMPLETED ✅ (Architecture Refactored by Section 22-4)

**Summary:** Skybox pipeline implemented with WGSL shader, cubemap sampling, scrolling animation, and depth handling. **Section 22-4 completely refactored** the architecture:
- Changed from cube geometry to **full-screen quad** approach (fixes w≈0 issue at diagonal view angles)
- Now uses **CameraState** and **WebGPUMatrixBuilder** for correct coordinate handling
- Shader computes world-space directions analytically per-pixel with proper Quake→GL cubemap coordinate transform
- Removed double-transform bug present in original implementation

**Original Implementation:** Cube geometry with viewProjection matrix
**Current Implementation:** Full-screen quad with inverse view rotation and analytical direction computation

---

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
   - [x] Cubemap sampling
   - [x] View direction calculation
   - [x] Reference: `skybox.ts` lines 15-94

2. **Implement SkyboxPipeline** (`pipelines/skybox.ts`)
   - [x] Cube geometry generation
   - [x] Cubemap texture binding
   - [x] Depth test configuration (always pass, no write)
   - [x] Reference: `skybox.ts:SkyboxRenderer`

3. **Cubemap Texture Loading**
   - [x] TextureCubeMap from section 20-2
   - [x] 6 face uploads
   - [x] Mipmap generation (supported via texture views, though skybox usually doesn't need mips or handled manually)

4. **Integration Tests**
   - [x] Headless rendering test
   - [x] Cubemap sampling test

5. **Visual Regression Tests**
   - [x] `skybox-basic.png` - Simple gradient sky (Tested with colored faces)
   - [x] `skybox-scrolling.png` - Parallax scrolling sky (Verified with scrolling test)
   - Created `tests/webgpu/visual/skybox.test.ts`

**Test Cases:**
- [x] Skybox renders behind all geometry
- [x] Cubemap sampled correctly
- [x] No depth writes
- [x] Scrolling animation works

**Reference:** `packages/engine/src/render/skybox.ts`

---

**Next Section:** [20-8: BSP Surface Pipeline](section-20-8.md)
