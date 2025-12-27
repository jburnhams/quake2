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

### Task 1: WGSL Shader [COMPLETED]

**File:** `shaders/particles.wgsl`

**Features:**
- Billboard quads (always face camera)
- Per-particle color and alpha
- Additive blending

**Reference:** `particleSystem.ts` (inline GLSL)

### Task 2: ParticleRenderer Implementation [IN PROGRESS]

**File:** `pipelines/particleSystem.ts`

**Subtasks:**
1. Instanced rendering (one quad per particle) [COMPLETED]
2. Dynamic vertex buffer updates [COMPLETED]
3. Additive blending [COMPLETED]
4. Depth test (no write for transparency) [COMPLETED]
5. Batching by texture [COMPLETED]

### Task 3: Testing [COMPLETED]

**Visual Tests:**
- `particles-basic.png` [COMPLETED]
- `particles-smoke.png` [COMPLETED]
- `particles-explosion.png` [COMPLETED]
- `particles-blood.png` [COMPLETED]

**Test Cases:**
- Billboarding works [COMPLETED]
- Additive blending correct [COMPLETED]
- Alpha fade works [COMPLETED]
- Many particles performant [COMPLETED]

**Reference:** `packages/engine/src/render/particleSystem.ts`

---

**Next Section:** [20-12: Dynamic Lighting System](section-20-12.md)
