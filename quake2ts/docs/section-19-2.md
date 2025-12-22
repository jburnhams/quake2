# Section 19-2: Engine/Rendering Utilities Migration

**Work Stream:** Engine and rendering test utilities
**Priority:** HIGH - Critical for engine/client testing
**Dependencies:** Section 19-1 (shared math helpers)
**Parallel Status:** Can start after Section 19-1 Task 3 completes

---

## Overview

This section covers migration of engine-specific test utilities including WebGL mocks, audio system mocks, rendering pipeline mocks, asset loading mocks, and texture/buffer utilities.

---

## Tasks

### 1. Consolidate WebGL Mocks (HIGH PRIORITY)

**Status:** Completed
**Dependencies:** None

- [x] **1.1** Create `test-utils/src/engine/mocks/webgl.ts` file

- [x] **1.2** Migrate `MockWebGL2RenderingContext` class from `engine/tests/helpers/mockWebGL.ts`
  - Class with ~194 lines including all WebGL2 constants and methods
  - Methods: `createBuffer()`, `createTexture()`, `createShader()`, `createProgram()`, `bindBuffer()`, `bufferData()`, `texImage2D()`, etc.
  - Properties: All WebGL2 constants (ARRAY_BUFFER, ELEMENT_ARRAY_BUFFER, TEXTURE_2D, etc.)

- [x] **1.3** Add factory function `createMockWebGL2Context(overrides?: Partial<WebGL2RenderingContext>): MockWebGL2RenderingContext`
  - Wraps class instantiation for convenience

- [x] **1.4** Remove duplicate simple mock from `tests/src/mocks/webgl2.ts`
  - Delete entire file after migration complete

- [x] **1.5** Update imports in `engine/tests/render/` directory
  - Replace `import { MockWebGL2RenderingContext } from '../helpers/mockWebGL'`
  - With `import { createMockWebGL2Context } from '@quake2ts/test-utils'`
  - Estimated files: ~25

- [x] **1.6** Update imports in `engine/tests/assets/` directory
  - Same import replacement pattern
  - Estimated files: ~5

- [x] **1.7** Update imports in `tests/src/` directory
  - Replace `tests/src/mocks/webgl2` imports
  - Estimated files: ~5

- [x] **1.8** Delete `engine/tests/helpers/mockWebGL.ts` after all migrations

---

### 2. Migrate Audio System Mocks (HIGH PRIORITY)

**Status:** Completed
**Dependencies:** None

- [x] **2.1** Create `test-utils/src/engine/mocks/audio.ts` file

- [x] **2.2** Migrate audio fake classes from `engine/tests/audio/fakes.ts`
  - `FakeAudioContext` - Mock Web Audio API context
  - `FakeAudioNode` - Base audio node mock
  - `FakeAudioDestinationNode` - Output destination mock
  - `FakePannerNode` - 3D audio panning mock
  - `FakeBiquadFilterNode` - Filter node mock
  - `FakeBufferSource` - Audio buffer playback mock
  - `FakeGainNode` - Volume control mock
  - Total: ~136 lines

- [x] **2.3** Add factory functions for common audio mocks
  - `createMockAudioContext(overrides?: Partial<AudioContext>): FakeAudioContext`
  - `createMockPannerNode(overrides?: Partial<PannerNode>): FakePannerNode`
  - `createMockBufferSource(buffer?: AudioBuffer): FakeBufferSource`

- [x] **2.4** Add `createMockAudioBuffer()` factory
  - Signature: `createMockAudioBuffer(duration?: number, channels?: number, sampleRate?: number): AudioBuffer`
  - Default: 1 second, stereo, 44.1kHz

- [x] **2.5** Update imports in `engine/tests/audio/` directory
  - Replace `import { FakeAudioContext, ... } from './fakes'`
  - With `import { createMockAudioContext, ... } from '@quake2ts/test-utils'`
  - Estimated files: ~8

- [x] **2.6** Update imports in `engine/tests/music/` directory
  - Same import pattern
  - Estimated files: ~3

- [x] **2.7** Delete `engine/tests/audio/fakes.ts` after migration

---

### 3. Create Rendering Mock Factories (HIGH PRIORITY)

**Status:** Completed
**Dependencies:** Task 1 (WebGL mocks)

- [x] **3.1** Create `test-utils/src/engine/mocks/renderer.ts` file

- [x] **3.2** Add `createMockRenderer()` factory
  - Signature: `createMockRenderer(overrides?: Partial<Renderer>): Renderer`
  - Methods: `render()`, `setClearColor()`, `setPostProcess()`, `resize()`, `getContext()`
  - Return mock WebGL context from method

- [x] **3.3** Add `createMockFrameRenderer()` factory
  - Signature: `createMockFrameRenderer(overrides?: Partial<FrameRenderer>): FrameRenderer`
  - Methods: `renderFrame()`, `clear()`, `setViewport()`

- [x] **3.4** Add `createMockBspPipeline()` factory
  - Signature: `createMockBspPipeline(overrides?: Partial<BspPipeline>): BspPipeline`
  - Methods: `render()`, `setup()`, `cleanup()`

- [x] **3.5** Add `createMockMd2Pipeline()` factory
  - Signature: `createMockMd2Pipeline(overrides?: Partial<Md2Pipeline>): Md2Pipeline`

- [x] **3.6** Add `createMockMd3Pipeline()` factory
  - Signature: `createMockMd3Pipeline(overrides?: Partial<Md3Pipeline>): Md3Pipeline`

- [x] **3.7** Add `createMockSpritePipeline()` factory
  - Signature: `createMockSpritePipeline(overrides?: Partial<SpritePipeline>): SpritePipeline`

- [x] **3.8** Add `createMockSkyboxPipeline()` factory
  - Signature: `createMockSkyboxPipeline(overrides?: Partial<SkyboxPipeline>): SkyboxPipeline`

- [x] **3.9** Cleanup inline renderer mocks in `client/tests/view/` directory
  - Replace inline `mockRenderer = { ... }` with `createMockRenderer()`
  - Estimated files: ~12

- [x] **3.10** Cleanup inline renderer mocks in `client/tests/renderer/` directory
  - Same pattern
  - Estimated files: ~8

- [x] **3.11** Cleanup inline renderer mocks in `engine/tests/render/` directory
  - Same pattern
  - Estimated files: ~10
  - *Note:* `renderer.test.ts` uses standardized inline mocks due to `vi.mock` hoisting limitations. Dependency injection refactor documented as option for future.

---

### 4. Create Asset/Resource Mock Factories (MEDIUM PRIORITY)

**Status:** Partially Completed
**Dependencies:** None

- [x] **4.1** Create `test-utils/src/engine/mocks/assets.ts` file

- [x] **4.2** Add `createMockAssetManager()` factory
  - Signature: `createMockAssetManager(overrides?: Partial<AssetManager>): AssetManager`
  - Methods: `loadModel()`, `loadTexture()`, `loadSound()`, `loadMap()`
  - Return resolved promises with mock assets

- [x] **4.3** Add `createMockTexture()` factory
  - Signature: `createMockTexture(width?: number, height?: number, data?: Uint8Array): Texture`
  - Default to 1x1 white texture

- [x] **4.4** Add `createMockMd2Model()` factory
  - Signature: `createMockMd2Model(overrides?: Partial<Md2Model>): Md2Model`
  - Include: frames, vertices, triangles, glCommands

- [x] **4.5** Add `createMockMd3Model()` factory
  - Signature: `createMockMd3Model(overrides?: Partial<Md3Model>): Md3Model`
  - Include: surfaces, frames, tags

- [x] **4.6** Add `createMockBspMap()` factory
  - Signature: `createMockBspMap(overrides?: Partial<BspMap>): BspMap`
  - Include: models, nodes, leafs, planes, brushes
  - Integrate with BSP helpers from Section 19-1

- [ ] **4.7** Cleanup inline asset mocks in `engine/tests/assets/` directory
  - Replace inline mocks with factories
  - Estimated files: ~15

- [ ] **4.8** Cleanup inline asset mocks in `client/tests/` directories
  - Same pattern
  - Estimated files: ~8

---

### 5. Create Buffer/Shader Mock Factories (MEDIUM PRIORITY)

**Status:** Not started
**Dependencies:** Task 1 (WebGL mocks)

- [ ] **5.1** Create `test-utils/src/engine/mocks/buffers.ts` file

- [ ] **5.2** Add `createMockVertexBuffer()` factory
  - Signature: `createMockVertexBuffer(data?: Float32Array, usage?: number): VertexBuffer`
  - Methods: `bind()`, `update()`, `destroy()`

- [ ] **5.3** Add `createMockIndexBuffer()` factory
  - Signature: `createMockIndexBuffer(data?: Uint16Array, usage?: number): IndexBuffer`

- [ ] **5.4** Add `createMockShader()` factory
  - Signature: `createMockShader(vertSource?: string, fragSource?: string): Shader`
  - Methods: `use()`, `setUniform()`, `destroy()`

- [ ] **5.5** Add `createMockShaderProgram()` factory
  - Signature: `createMockShaderProgram(overrides?: Partial<ShaderProgram>): ShaderProgram`

---

### 6. Create Lighting Mock Factories (MEDIUM PRIORITY)

**Status:** Currently inline mocks
**Dependencies:** Section 19-1 Task 3 (math helpers)

- [ ] **6.1** Create `test-utils/src/engine/mocks/lighting.ts` file

- [ ] **6.2** Add `createMockDLight()` factory
  - Signature: `createMockDLight(position?: Vector3, color?: Vector3, intensity?: number): DLight`
  - Include origin, color, intensity, decay

- [ ] **6.3** Add `createMockDLightManager()` factory
  - Signature: `createMockDLightManager(overrides?: Partial<DLightManager>): DLightManager`
  - Methods: `addLight()`, `removeLight()`, `clear()`, `getLights()`

- [ ] **6.4** Add `createMockLightmap()` factory
  - Signature: `createMockLightmap(width?: number, height?: number): Lightmap`

- [ ] **6.5** Cleanup inline lighting mocks in `client/tests/` directory
  - Estimated files: ~6

---

### 7. Create Particle System Mocks (LOW PRIORITY)

**Status:** Not started
**Dependencies:** Section 19-1 Task 3 (math helpers)

- [ ] **7.1** Create `test-utils/src/engine/mocks/particles.ts` file

- [ ] **7.2** Add `createMockParticle()` factory
  - Signature: `createMockParticle(overrides?: Partial<Particle>): Particle`
  - Include: position, velocity, color, lifetime

- [ ] **7.3** Add `createMockParticleEmitter()` factory
  - Signature: `createMockParticleEmitter(overrides?: Partial<ParticleEmitter>): ParticleEmitter`

- [ ] **7.4** Add `createMockParticleSystem()` factory
  - Signature: `createMockParticleSystem(overrides?: Partial<ParticleSystem>): ParticleSystem`

---

### 8. Documentation and Exports (LOW PRIORITY)

**Status:** Not started
**Dependencies:** Tasks 1-7

- [ ] **8.1** Add JSDoc comments to all engine utilities
  - Include usage examples for WebGL, audio, renderer mocks

- [ ] **8.2** Update `test-utils/README.md` with engine utilities section
  - Document: WebGL mocks, audio mocks, renderer factories, asset mocks

- [ ] **8.3** Verify all engine utilities exported from `test-utils/src/index.ts`
  - Organized by category: `engine/mocks/*`, `engine/factories/*`

- [ ] **8.4** Add TypeScript type exports
  - Export mock types and interfaces

---

## Summary

**Total Tasks:** 8
**Total Subtasks:** 58
**Estimated Impact:** ~100+ test files updated, ~600 lines of new utilities
**Critical Path:** Task 1 (WebGL consolidation) blocks Task 3 and 5; Task 2 (audio) is independent
**Parallel Opportunities:** Tasks 1-2 can run in parallel, Tasks 4-7 can run in parallel after Task 1
