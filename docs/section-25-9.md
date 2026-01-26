# Section 25-9: Testing & Verification Strategy

## Overview

Comprehensive testing strategy using unit tests, integration tests, and WASM reference verification.

**Dependencies**: All previous sections
**Purpose**: Ensure correctness and compatibility with original q2tools

---

## 1. Test Categories

### 1.1 Unit Tests

Test individual functions in isolation with known inputs/outputs.

| Module | Test File | Key Cases |
|--------|-----------|-----------|
| Winding | `winding.test.ts` | Clip, split, area, bounds |
| Planes | `planes.test.ts` | Dedup, hash, type detection |
| Tokenizer | `tokenizer.test.ts` | All token types, edge cases |
| Map Parser | `mapParser.test.ts` | Entities, brushes, formats |
| Primitives | `primitives.test.ts` | Box, wedge, stairs, cylinder |
| CSG | `csg.test.ts` | Split, subtract, fragment |
| Tree | `tree.test.ts` | Build, partition, flatten |
| Faces | `faces.test.ts` | Extract, T-junction, merge |
| Portals | `portals.test.ts` | Generate, clip |
| VIS | `vis.test.ts` | Flood, PVS, compress |
| Lighting | `lighting.test.ts` | Trace, sample, pack |

### 1.2 Integration Tests

Test complete pipelines with realistic data.

```typescript
// tests/integration/compile.test.ts
describe('BSP Compilation Pipeline', () => {
  it('compiles empty worldspawn', async () => {
    const bsp = await compileMap(EMPTY_WORLDSPAWN);
    expect(bsp.nodes.length).toBe(1);
    expect(bsp.leafs.length).toBe(2);
  });

  it('compiles single room', async () => {
    const bsp = await compileMap(SINGLE_ROOM);
    expect(bsp.faces.length).toBe(6);
    // Verify in engine
    const result = await loadInEngine(bsp);
    expect(result.valid).toBe(true);
  });

  it('compiles multi-room map', async () => {
    const bsp = await compileMap(MULTI_ROOM);
    // Verify portals between rooms
    expect(countPortals(bsp)).toBeGreaterThan(0);
  });
});
```

### 1.3 WASM Reference Tests

Compare TypeScript output against q2tools WASM.

```typescript
// tests/verification/wasm.test.ts
describe('WASM Reference Comparison', () => {
  let wasmRef: Q2ToolsReference;

  beforeAll(async () => {
    wasmRef = new Q2ToolsReference();
    await wasmRef.init();
  });

  it('produces matching plane count', async () => {
    const mapContent = generateTestMap();
    const tsBsp = compile(mapContent);
    const wasmBsp = wasmRef.compile(mapContent);

    expect(tsBsp.planes.length).toBe(wasmBsp.planes.length);
  });

  it('produces matching node structure', async () => {
    // Compare tree depth, node count
  });

  it('produces matching PVS', async () => {
    // Compare cluster visibility
  });
});
```

---

## 2. Test Fixtures

### 2.1 Programmatic Map Generation

```typescript
// tests/fixtures/maps/index.ts
export const EMPTY_WORLDSPAWN = generateMap([
  worldspawn({})
]);

export const SINGLE_ROOM = generateMap([
  worldspawn({
    brushes: hollowBox({ size: [512, 512, 256] })
  }),
  playerStart([256, 256, 32])
]);

export const CORRIDOR = generateMap([
  worldspawn({
    brushes: [
      ...hollowBox({ origin: [0, 0, 0], size: [256, 256, 128] }),
      ...hollowBox({ origin: [256, 0, 0], size: [256, 256, 128] }),
      // Connecting corridor
      ...corridor({ from: [128, 128, 0], to: [384, 128, 0], size: [64, 128] })
    ]
  })
]);

export const STAIRS_MAP = generateMap([...]);
export const COMPLEX_CSG = generateMap([...]);  // Overlapping brushes
export const LIGHTING_TEST = generateMap([...]);  // Multiple lights
```

### 2.2 Reference .map Files

For cases where programmatic generation is complex:

```
tests/fixtures/reference/
├── simple_box.map       # Minimal valid map
├── two_rooms.map        # Portal test
├── pillar.map           # CSG test (pillar through floor)
├── stairs.map           # Multiple brushes
├── lighting.map         # Light entities
└── valve220.map         # Valve 220 texture format
```

---

## 3. Verification Criteria

### 3.1 Structural Verification

| Property | Check | Tolerance |
|----------|-------|-----------|
| Magic | `IBSP` or `QBSP` | Exact |
| Version | 38 | Exact |
| Plane count | Match WASM | Exact |
| Node count | Match WASM | ±5% |
| Leaf count | Match WASM | ±5% |
| Face count | Match WASM | ±10% |
| Edge count | Match WASM | ±10% |

### 3.2 Semantic Verification

```typescript
// Verify point queries return same results
function verifyPointQueries(tsBsp: BspData, wasmBsp: BspData) {
  const testPoints = generateTestPoints(1000);
  for (const point of testPoints) {
    const tsLeaf = findLeaf(tsBsp, point);
    const wasmLeaf = findLeaf(wasmBsp, point);
    expect(tsLeaf.contents).toBe(wasmLeaf.contents);
  }
}

// Verify visibility queries
function verifyVisibility(tsBsp: BspData, wasmBsp: BspData) {
  for (let i = 0; i < tsBsp.numClusters; i++) {
    for (let j = 0; j < tsBsp.numClusters; j++) {
      const tsVisible = isClusterVisible(tsBsp, i, j);
      const wasmVisible = isClusterVisible(wasmBsp, i, j);
      expect(tsVisible).toBe(wasmVisible);
    }
  }
}
```

### 3.3 Engine Loading Verification

```typescript
// Verify BSP loads in quake2ts engine
async function verifyEngineLoading(bsp: BspData) {
  const engine = await createTestEngine();
  const result = await engine.loadMap(bsp);

  expect(result.loaded).toBe(true);
  expect(result.errors).toHaveLength(0);

  // Verify player can spawn
  const spawnPoint = engine.findSpawnPoint();
  expect(spawnPoint).toBeDefined();

  // Verify basic navigation
  const trace = engine.trace(spawnPoint, addVec3(spawnPoint, { x: 100, y: 0, z: 0 }));
  expect(trace.fraction).toBeGreaterThan(0);
}
```

---

## 4. Performance Benchmarks

### 4.1 Compilation Benchmarks

```typescript
// tests/benchmarks/compile.bench.ts
describe('Compilation Performance', () => {
  bench('empty worldspawn', () => compile(EMPTY_WORLDSPAWN));
  bench('single room', () => compile(SINGLE_ROOM));
  bench('10 rooms', () => compile(TEN_ROOMS));
  bench('100 brushes', () => compile(HUNDRED_BRUSHES));
  bench('1000 brushes', () => compile(THOUSAND_BRUSHES));
});
```

### 4.2 Target Performance

| Map Size | Target Time |
|----------|-------------|
| Empty | <10ms |
| Single room | <50ms |
| 10 rooms | <200ms |
| 100 brushes | <500ms |
| 1000 brushes | <5s |

---

## 5. Test Commands

```bash
# Unit tests only
pnpm --filter @quake2ts/bsp-tools test:unit

# Integration tests (requires built package)
pnpm --filter @quake2ts/bsp-tools test:integration

# WASM verification (requires WASM build)
pnpm --filter @quake2ts/bsp-tools test:wasm

# All tests
pnpm --filter @quake2ts/bsp-tools test

# Benchmarks
pnpm --filter @quake2ts/bsp-tools test:bench

# Coverage
pnpm --filter @quake2ts/bsp-tools test:coverage
```

---

## 6. CI Pipeline

```yaml
# .github/workflows/bsp-tools.yml
jobs:
  test:
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm --filter @quake2ts/bsp-tools build
      - run: pnpm --filter @quake2ts/bsp-tools test:unit
      - run: pnpm --filter @quake2ts/bsp-tools test:integration

  wasm-verification:
    steps:
      - uses: actions/checkout@v4
      - uses: mymindstorm/setup-emsdk@v12
      - run: cd packages/bsp-tools/wasm && ./build.sh
      - run: pnpm --filter @quake2ts/bsp-tools test:wasm
```

---

## 7. Known Differences

Some differences with WASM are acceptable:

| Difference | Reason | Acceptable |
|------------|--------|------------|
| Plane order | Hash ordering varies | Yes |
| Face order | Tree traversal order | Yes |
| Lighting values | Algorithm variations | ±10% |
| VIS tightness | Anti-penumbra precision | Slightly looser OK |
| Node count | Split heuristics | ±5% |

---

## Verification Checklist

- [ ] Unit tests for all modules
- [ ] Integration tests for pipelines
- [ ] WASM comparison infrastructure
- [ ] Test fixture generation
- [ ] Reference .map files created
- [ ] Performance benchmarks
- [ ] CI pipeline configured
- [ ] Coverage targets met (>80%)
