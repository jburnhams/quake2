// Export core engine
export { createGameEngine } from './engine.js';
export * from './types.js';

// Export systems
export { Camera } from './render/camera.js';
export { InputSystem } from './input/index.js';
export { AudioSystem } from './audio/index.js';
export { TextureCache } from './render/textureCache.js';
export { MaterialManager } from './render/material.js';
export { SpriteLoader } from './assets/sprite.js';
export { MdxLoader } from './assets/mdx.js';
export { PakArchive } from './assets/pak.js';
export { BspLoader } from './assets/bsp.js';
export { parseBsp } from './assets/bsp.js';
export { createBspSurfaces } from './render/bspTraversal.js';
export { buildBspGeometry } from './render/bspGeometry.js';

// Export render types for consumers (e.g. client)
export type { Renderer } from './render/renderer.js';
export type { RenderableEntity } from './render/scene.js';
export type { Pic } from './assets/pic.js';

// Export demo types
export * from './demo/types.js';
export * from './demo/parser.js';
export { serializeSnapshot } from './demo/serialization/snapshot.js';

// Commands
export { CommandRegistry } from './commands.js';
export type { CommandContext } from './commands.js';
