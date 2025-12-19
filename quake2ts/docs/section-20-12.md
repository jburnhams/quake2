# Section 20-12: Dynamic Lighting System

**Phase:** 4 (Advanced Features)
**Priority:** MEDIUM
**Dependencies:** 20-8 (BSP Pipeline)
**Estimated Effort:** 3-4 days

---

## Overview

Implement dynamic point lights that illuminate BSP surfaces and models in real-time.

**Reference Implementation:** Integrated in `bspPipeline.ts` and `md2Pipeline.ts`

---

## Tasks

1. **Light Uniform Buffer Management**
   - Structure for up to 8 dynamic lights
   - Light position, color, radius, intensity
   - Update buffer per frame

2. **Per-Pixel Lighting Calculations** (already in shaders)
   - Attenuation based on distance
   - Diffuse lighting (N·L)
   - Color modulation

3. **Light Culling**
   - Frustum culling for lights
   - Surface-light intersection testing
   - Only pass relevant lights to shader

4. **Integration & Testing**
   - Visual test: `lighting-point.png`
   - Visual test: `lighting-multiple.png`
   - Visual test: `lighting-colored.png`

**Test Cases:**
- Lights illuminate surfaces correctly
- Attenuation smooth and realistic
- Multiple lights accumulate
- Colored lights tint surfaces
- Off-screen lights culled

---

**Next Section:** [20-13: Post-Processing & Effects](section-20-13.md)
