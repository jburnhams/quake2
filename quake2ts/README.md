# quake2ts

> A TypeScript/WebGL port of the Quake II re-release engine for creating interactive web-based game engine visualizations and experiments.

[![License: GPL-2.0](https://img.shields.io/badge/License-GPL%202.0-blue.svg)](https://opensource.org/licenses/GPL-2.0)
[![npm version](https://badge.fury.io/js/quake2ts.svg)](https://www.npmjs.com/package/quake2ts)

## Overview

**quake2ts** is a modular, browser-first implementation of the Quake II engine in TypeScript with WebGL2 rendering. It provides a complete game engine architecture broken into composable packages, making it ideal for:

- 🎮 **Interactive engine visualizations** - Build web apps that explore game engine internals
- 🔬 **Educational projects** - Learn game engine architecture through a well-structured codebase
- 🛠️ **Asset viewers** - Create BSP map viewers, MD2 model viewers, or PAK file explorers
- 🧪 **Physics experiments** - Test and visualize player movement, collision detection, and game mechanics
- 🎨 **Retro game development** - Build new games using classic Quake II technology

The library is organized as a **pnpm monorepo** with independent packages for different engine layers, allowing you to use only what you need.

## Installation

```bash
npm install quake2ts
# or
pnpm add quake2ts
# or
yarn add quake2ts
```

### Browser CDN

```html
<script src="https://unpkg.com/@quake2ts/shared"></script>
<script src="https://unpkg.com/@quake2ts/engine"></script>
<script src="https://unpkg.com/@quake2ts/game"></script>
<script>
  // Access via global: window.Quake2Shared, window.Quake2Engine, etc.
</script>
```

## Quick Start

### Running the Complete Engine

```typescript
import { bootstrapViewer } from '@quake2ts/viewer';

// Bootstrap the complete engine with game logic and rendering
const { engine, game, client, runtime } = bootstrapViewer();
// Runtime automatically starts at 40Hz simulation tick
```

### Building Custom Visualizations

For interactive engine exploration, import individual packages:

```typescript
import { createEngineRuntime } from '@quake2ts/engine';
import { createGame } from '@quake2ts/game';
import { createClient } from '@quake2ts/client';
import { ingestPakFiles, wireFileInput } from '@quake2ts/engine';

// 1. Set up asset loading with progress tracking
const input = document.getElementById('pak-input') as HTMLInputElement;
wireFileInput(input, async (pakSources) => {
  await ingestPakFiles(pakSources, (progress) => {
    console.log(`Loading assets: ${progress.percent}%`);
  });

  // 2. Create engine, game, and client
  const engine = createEngine({ /* trace callback */ });
  const game = createGame({ /* trace callback */ });
  const client = createClient({ engine });

  // 3. Bootstrap runtime
  const runtime = createEngineRuntime(engine, game, client);
  runtime.start();
});
```

## Package Architecture

quake2ts is organized into **5 core packages** and a viewer app:

### 📦 `@quake2ts/shared` - Foundation Layer

Shared math, physics, and protocol utilities.

**Key Exports:**
- **Math utilities:** `Vec3` operations, angle conversions, color blending, random number generation
- **Collision detection:** `CONTENTS_*`, `SURF_*`, `MASK_*` constants
- **Player movement physics:** Complete `pmove` implementation with friction, acceleration, jumping, water/air movement, ducking, and stuck detection

```typescript
import { Vec3, pmove, MASK_PLAYERSOLID } from '@quake2ts/shared';

// Use Quake II's player movement physics
const result = pmove(playerState, userCmd, traceFunction);
console.log('New position:', result.origin);
console.log('New velocity:', result.velocity);
```

### 🎨 `@quake2ts/engine` - Platform & Rendering Layer

Web-facing services: WebGL2 rendering, asset loading, virtual filesystem, and engine runtime.

**Key Exports:**

**Asset System:**
- `PakArchive`, `VirtualFileSystem` - PAK file reading and virtual filesystem
- `ingestPaks`, `ingestPakFiles` - Asset ingestion pipeline with progress callbacks
- `wireFileInput`, `wireDropTarget` - Browser file handling helpers
- `BspLoader`, `parseBsp` - BSP map parsing
- `Md2Loader`, `parseMd2` - MD2 model parsing with animation support
- `LruCache` - Asset caching system

**Rendering:**
- `createWebGLContext` - WebGL2 context initialization
- `ShaderProgram`, `VertexBuffer`, `IndexBuffer`, `Texture2D` - GPU resource wrappers
- `createBspSurfaces` - Converts parsed BSP map data into renderable surfaces
- `buildBspGeometry` - BSP geometry builder with lightmap atlas packing

**Engine Core:**
- `FixedTimestepLoop` - Deterministic 40Hz simulation loop with interpolation
- `EngineHost` - Game/client lifecycle manager
- `EngineRuntime`, `createEngineRuntime` - Complete runtime bootstrap
- `CvarRegistry`, `Cvar` - Configuration variable system
- `ConfigStringRegistry` - Deterministic asset indexing

```typescript
import {
  ingestPakFiles,
  buildBspGeometry,
  createWebGLContext,
  FixedTimestepLoop
} from '@quake2ts/engine';

// Create a BSP map viewer
const vfs = await ingestPakFiles(pakSources);
const bspData = vfs.readFile('maps/base1.bsp');
const geometry = buildBspGeometry(bspData);

// Set up WebGL rendering
const gl = createWebGLContext(canvas);
const loop = new FixedTimestepLoop(
  (dt) => { /* simulate */ },
  (alpha) => { /* render with interpolation */ }
);
loop.start();
```

### 🎯 `@quake2ts/game` - Game Logic Layer

Authoritative simulation and entity system.

**Key Exports:**
- `createGame` - Main game factory function
- `EntitySystem` - Entity management with pooling
- `Entity` - Base entity class with `MoveType`, `Solid`, think callbacks, and field metadata
- `GameFrameLoop` - Frame timing with prep/simulate/post stages
- `LevelClock` - Level time tracking

```typescript
import { createGame, Entity, MoveType, Solid } from '@quake2ts/game';

const game = createGame(
  { trace: /* collision trace */ },
  { gravity: { x: 0, y: 0, z: -800 } }
);

// Create custom entities
const platform = new Entity();
platform.moveType = MoveType.Push;
platform.solid = Solid.Bsp;
platform.think = () => {
  // Update logic
};

game.entitySystem.spawn(platform);
```

### 🖥️ `@quake2ts/client` - Client & Prediction Layer

Client-side rendering interface and state prediction.

**Key Exports:**
- `createClient` - Client factory with prediction support
- `ClientRenderer` - Rendering interface
- `PredictionState` - Client-side state prediction

```typescript
import { createClient } from '@quake2ts/client';

const client = createClient({ engine });
// Client handles HUD rendering and prediction
```

### 🔧 `@quake2ts/tools` - Asset Tools

Utilities for asset preparation and inspection.

**Key Exports:**
- `describeAsset` - Asset summary and metadata extraction

```typescript
import { describeAsset } from '@quake2ts/tools';

const info = describeAsset(assetBuffer);
console.log(info);
```

### 👁️ `@quake2ts/viewer` - Demo Application

Minimal viewer harness demonstrating complete engine integration.

**Key Exports:**
- `bootstrapViewer` - Complete engine/game/client bootstrap

## Interactive Visualization Examples

### Example 1: BSP Map Explorer

```typescript
import { ingestPakFiles, buildBspGeometry, VirtualFileSystem } from '@quake2ts/engine';

// Load PAK files
const vfs = await ingestPakFiles(pakSources, (progress) => {
  updateProgressBar(progress.percent);
});

// List all maps
const maps = vfs.listFiles('maps/*.bsp');
console.log('Available maps:', maps);

// Render a specific map
const bspBuffer = await vfs.readFile('maps/base1.bsp');
const bspMap = parseBsp(bspBuffer);
const surfaces = createBspSurfaces(bspMap);
const geometry = buildBspGeometry(gl, surfaces);

// Display geometry stats
console.log(`Surfaces: ${geometry.surfaces.length}`);
console.log(`Lightmaps: ${geometry.lightmaps.length}`);

// Render with WebGL
// (Use BspSurfacePipeline or your own shader to render `geometry.surfaces`)
```

### Example 2: MD2 Model Viewer with Animations

```typescript
import { Md2Loader, parseMd2 } from '@quake2ts/engine';

// Load MD2 model
const modelData = vfs.readFile('models/monsters/soldier/tris.md2');
const model = parseMd2(modelData);

// Display model info
console.log(`Frames: ${model.header.numFrames}`);
console.log(`Animation groups:`, model.animations);

// Animate between frames
let currentFrame = 0;
const animationGroup = model.animations.find(a => a.name === 'run');

function animate() {
  currentFrame = (currentFrame + 1) % animationGroup.frameCount;
  const frame = model.frames[animationGroup.firstFrame + currentFrame];
  renderMd2Frame(gl, frame, model.triangles);
  requestAnimationFrame(animate);
}
animate();
```

### Example 3: Player Movement Physics Visualization

```typescript
import { pmove, Vec3 } from '@quake2ts/shared';
import { createGame } from '@quake2ts/game';

// Set up player state
const playerState = {
  origin: { x: 0, y: 0, z: 24 },
  velocity: { x: 0, y: 0, z: 0 },
  // ... other pmove fields
};

// Simulate user input
const userCmd = {
  forwardmove: 400,  // Move forward
  sidemove: 0,
  upmove: 0,
  buttons: 0,
  angles: { pitch: 0, yaw: 90, roll: 0 }
};

// Run one physics tick
const result = pmove(playerState, userCmd, traceFunction);

// Visualize the movement
drawPlayerPosition(result.origin);
drawVelocityVector(result.origin, result.velocity);
console.log(`Speed: ${Vec3.length(result.velocity)} units/sec`);
```

### Example 4: Entity System Explorer

```typescript
import { createGame, MoveType, Solid } from '@quake2ts/game';

const game = createGame({ trace }, { gravity: { x: 0, y: 0, z: -800 } });

// Spawn various entity types
const entities = [
  { type: 'static', moveType: MoveType.None, solid: Solid.Bsp },
  { type: 'physics', moveType: MoveType.Toss, solid: Solid.BoundingBox },
  { type: 'player', moveType: MoveType.Walk, solid: Solid.BoundingBox },
  { type: 'trigger', moveType: MoveType.None, solid: Solid.Trigger }
];

entities.forEach(config => {
  const entity = new Entity();
  entity.moveType = config.moveType;
  entity.solid = config.solid;
  entity.think = () => {
    // Visualize entity state in real-time
    highlightEntity(entity);
  };
  game.entitySystem.spawn(entity);
});

// Run simulation and visualize
game.loop.start();
```

## Build Formats

Each package is published in **three formats**:

- **ESM** - `dist/esm/index.js` - Modern ES modules (recommended)
- **CJS** - `dist/cjs/index.cjs` - CommonJS for Node.js
- **Browser** - `dist/browser/index.js` - Minified IIFE for `<script>` tags

TypeScript declarations are included at `dist/types/index.d.ts`.

## Key Features

### ✅ Implemented

- ✅ **Complete player movement physics** - Full pmove with friction, acceleration, jumping, water/air movement
- ✅ **Asset loading pipeline** - PAK files, virtual filesystem, MD2 models, BSP geometry
- ✅ **WebGL2 rendering foundation** - Context management, shader compilation, GPU resources
- ✅ **Deterministic engine loop** - Fixed 40Hz simulation with frame interpolation
- ✅ **Entity system** - Component-based entities with pooling and think scheduler
- ✅ **Configuration system** - Cvars and ConfigStrings for runtime configuration
- ✅ **Lightmap atlas packing** - Efficient texture packing for BSP lightmaps

### 🚧 In Progress

- 🚧 BSP traversal and PVS (Potentially Visible Set) culling
- 🚧 Complete rendering pipeline (BSP surfaces, MD2/MD3 models, particles)
- 🚧 HUD and UI rendering
- 🚧 Audio system (WebAudio integration)
- 🚧 Combat and items
- 🚧 AI and monsters
- 🚧 Save/load serialization

## Documentation

Comprehensive documentation is available in the `quake2ts/docs` folder:

- **[overview.md](docs/overview.md)** - Architecture overview and package descriptions
- **[progress.md](docs/progress.md)** - Detailed progress log with completed features
- **[implementation.md](implementation.md)** - Detailed implementation plan and milestones
- **Section guides** - 10 detailed guides covering asset loading, rendering, physics, entities, combat, AI, audio, input, save/load, and testing

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm run build

# Run tests
pnpm run test

# Watch mode for development
pnpm run dev
```

## Requirements

- **Node.js** 18+ (for development)
- **pnpm** 8.15.7+ (package manager)
- **Modern browser** with WebGL2 support (for runtime)

## Browser Compatibility

- Chrome 56+
- Firefox 51+
- Safari 15+
- Edge 79+

All browsers must support **WebGL2** and **ES6 modules**.

## License

**GPL-2.0** - This project is a port of Quake II, which is licensed under GPL-2.0. See [LICENSE](LICENSE) for details.

## Repository

- **GitHub:** https://github.com/jburnhams/quake2
- **Issues:** https://github.com/jburnhams/quake2/issues
- **npm:** https://www.npmjs.com/package/quake2ts

## Contributing

Contributions are welcome! Please see the [implementation.md](implementation.md) for the current roadmap and open issues.

## Credits

Based on the [Quake II re-release](https://github.com/id-Software/quake2-rerelease-dll) by id Software. This project is an independent TypeScript/WebGL port for educational and experimental purposes.

---

**Happy hacking!** 🚀
