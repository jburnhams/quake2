// Export all test utilities
export * from './shared/mocks.js';
export * from './shared/bsp.js';
export * from './shared/pak-loader.js';
export * from './shared/math.js';
export * from './shared/collision.js';
export * from './shared/factories.js';
export * from './game/factories.js';
export * from './game/helpers.js';
export * from './game/helpers/physics.js';
export * from './game/helpers/save.js';
export * from './game/mocks/ai.js';
export * from './game/mocks/combat.js';
export * from './game/mocks/items.js';
// Removed export * from './game/mocks.js';
export * from './server/mocks/transport.js';
export * from './server/mockTransport.js';
export * from './server/mockNetDriver.js';
export * from './server/mocks/state.js';
export * from './server/mocks/connection.js';
export * from './server/mocks/commands.js';
export * from './server/mocks/master.js';
export * from './server/mocks/physics.js';
export * from './server/helpers/multiplayer.js';
export * from './server/helpers/snapshot.js';
export * from './server/helpers/bandwidth.js';

// Setup
export * from './setup/browser.js';
export * from './setup/canvas.js';
export * from './setup/webgpu.js';
// Safe to export now as gl is lazy loaded
export * from './setup/headless-webgl.js';
export * from './engine/mocks/webgpu.js';
export * from './setup/timing.js';
export * from './setup/node.js';
export * from './engine/mocks/webgl.js';
export * from './engine/mocks/audio.js';
export * from './engine/mocks/renderer.js';
export * from './engine/mocks/assets.js';
export * from './engine/mocks/buffers.js';
export * from './engine/mocks/lighting.js';
export * from './engine/mocks/particles.js';
export * from './engine/rendering.js';
export * from './setup/storage.js';
export * from './setup/audio.js';
export * from './engine/helpers/webgpu-rendering.js';
export * from './engine/helpers/webgl-rendering.js';
export * from './engine/helpers/webgl-playwright.js';
export * from './engine/helpers/pipeline-test-template.js';
export * from './engine/helpers/textures.js';
export * from './engine/renderers.js';

// Client Mocks
export * from './client/mocks/input.js';
export * from './client/helpers/view.js';
export * from './client/helpers/hud.js';
export * from './client/mocks/network.js';
export * from './client/mocks/download.js';
export * from './client/mocks/state.js';
export * from './client/mocks/console.js';
export * from './client/helpers/prediction.js';

// Visual Testing
export * from './visual/snapshots.js';
export * from './visual/animation-snapshots.js';

// E2E
export * from './e2e/playwright.js';
export * from './e2e/network.js';
export * from './e2e/visual.js';

// Export types
export type { BrowserSetupOptions } from './setup/browser.js';
export type { NodeSetupOptions } from './setup/node.js';
export type { MockRAF } from './setup/timing.js';
export type { StorageScenario } from './setup/storage.js';
export type { NetworkSimulator, NetworkCondition } from './e2e/network.js';
export type { VisualScenario, VisualDiff } from './e2e/visual.js';
export type { HeadlessWebGPUSetup, WebGPUContextState } from './setup/webgpu.js';
export type { HeadlessWebGLContext, HeadlessWebGLOptions } from './setup/headless-webgl.js';
export type { RenderTestSetup, ComputeTestSetup } from './engine/helpers/webgpu-rendering.js';
export type { WebGLRenderTestSetup } from './engine/helpers/webgl-rendering.js';
export type { WebGLPlaywrightSetup, WebGLPlaywrightOptions } from './engine/helpers/webgl-playwright.js';
export type { GeometryBuffers } from './engine/helpers/pipeline-test-template.js';

// Shared Types
export type {
    BinaryWriterMock,
    BinaryStreamMock,
    MessageWriterMock,
    MessageReaderMock,
    PacketMock
} from './shared/mocks.js';
export type { TraceMock, SurfaceMock } from './shared/collision.js';
export type { Transform } from './shared/math.js';
export type {
    CaptureOptions,
    ComparisonResult,
    ComparisonOptions,
    SnapshotTestOptions
} from './visual/snapshots.js';
export type {
    AnimationSnapshotOptions,
    AnimationSnapshotResult
} from './visual/animation-snapshots.js';
export type { MockCollisionEntityIndex } from './server/mocks/physics.js';
