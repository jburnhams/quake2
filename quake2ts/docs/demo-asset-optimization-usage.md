# Demo Asset Optimization Usage Guide

This guide describes how to use the Demo Asset Optimization tools included in the Quake 2 TS engine. These tools allow you to analyze demo files (`.dm2`), extract specific clips, and create optimized asset packages (`.pak`) containing only the resources required for playback.

## CLI Tool

The CLI tool is located at `packages/engine/src/cli/demoOptimizer.ts`. You can run it using `ts-node` or by building the project and running the compiled output.

### Commands

#### 1. Analyze Demo
Analyzes a demo file and provides a summary of its duration, events, and resource usage.

```bash
ts-node packages/engine/src/cli/demoOptimizer.ts analyze <path/to/demo.dm2>
```

**Output:** JSON report containing summary statistics and optimal window suggestions.

#### 2. Extract Clip
Extracts a raw clip from a demo file based on start time and duration.

```bash
ts-node packages/engine/src/cli/demoOptimizer.ts extract <path/to/demo.dm2> <start_seconds> <duration_seconds> -o <output.dm2>
```

**Example:**
```bash
ts-node packages/engine/src/cli/demoOptimizer.ts extract baseq2/demos/demo1.dm2 10 30 -o clips/clip1.dm2
```

#### 3. Optimize Package
Creates a fully self-contained, optimized package (clip + assets) for a specific duration. This is useful for creating web-ready demo packages.

```bash
ts-node packages/engine/src/cli/demoOptimizer.ts optimize <path/to/demo.dm2> <path/to/pak0.pak> [path/to/pak1.pak...] -d <duration_seconds> -o <output_directory>
```

**Output:**
- `demo.dm2`: The extracted clip.
- `assets.pak`: An optimized PAK file containing only the textures, models, and sounds visible/audible in the clip.
- `manifest.json`: Metadata about the package.

#### 4. Find Best Clips
Automatically searches the demo for the most "interesting" or resource-efficient windows.

```bash
ts-node packages/engine/src/cli/demoOptimizer.ts find-best <path/to/demo.dm2> --duration <seconds> --top <N>
```

**Example:**
```bash
ts-node packages/engine/src/cli/demoOptimizer.ts find-best demo1.dm2 --duration 60 --top 5
```

## API Usage

You can also use the high-level API programmatically in your TypeScript code.

```typescript
import { DemoOptimizerApi } from '@quake2ts/engine';

const api = new DemoOptimizerApi();

// 1. Analyze
const report = await api.analyzeDemo(demoBuffer);

// 2. Create Clip
const clipData = await api.createDemoClip(demoBuffer, 10, 60);

// 3. Create Optimized Package
const pkg = await api.createOptimalDemoPackage(
    demoBuffer,
    [{ name: 'pak0.pak', data: pakBuffer }],
    { duration: 60 }
);

console.log(`Created package with ${pkg.pakData.byteLength} bytes of assets`);
```
