# Section 20-11: Particle System

**Phase:** 3 (Core Pipelines)
**Priority:** HIGH
**Dependencies:** 20-2 (Resources), 20-6 (Frame Orchestration)
**Estimated Effort:** 3-4 days

---

## Overview

Implement particle rendering for explosions, blood, trails, etc.

**Reference Implementation:** `packages/engine/src/render/particleSystem.ts` (805 lines)

---

## Tasks

### Task 1: WGSL Shader

**File:** `shaders/particles.wgsl`

**Features:**
- Billboard quads (always face camera)
- Per-particle color and alpha
- Texture atlas sampling
- Additive blending

**Reference:** `particleSystem.ts` (inline GLSL)

### Task 2: ParticleRenderer Implementation

**File:** `pipelines/particleSystem.ts`

**Subtasks:**
1. Instanced rendering (one quad per particle)
2. Dynamic vertex buffer updates
3. Additive blending
4. Depth test (no write for transparency)
5. Batching by texture

### Task 3: Testing

**Visual Tests:**
- `particles-smoke.png`
- `particles-explosion.png`
- `particles-blood.png`

**Test Cases:**
- Billboarding works
- Additive blending correct
- Alpha fade works
- Many particles performant

**Reference:** `packages/engine/src/render/particleSystem.ts`

---

**Next Section:** [20-12: Dynamic Lighting System](section-20-12.md)
