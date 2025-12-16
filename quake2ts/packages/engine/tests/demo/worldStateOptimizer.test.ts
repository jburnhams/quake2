import { describe, it, expect } from 'vitest';
import { WorldStateOptimizer } from '../../src/demo/worldStateOptimizer.js';
import { MessageWriter } from '../../src/demo/writer.js';
import { WorldState } from '../../src/demo/clipper.js';
import { ConfigStringIndex } from '@quake2ts/shared';
import { DemoMessageBlock } from '../../src/demo/demoReader.js';
import { createEmptyProtocolPlayerState, createEmptyEntityState, EntityState } from '../../src/demo/parser.js';

describe('WorldStateOptimizer', () => {
  const optimizer = new WorldStateOptimizer();

  // Helper to create a dummy WorldState
  const createWorldState = (): WorldState => ({
    serverData: {
      protocol: 34,
      serverCount: 1,
      attractLoop: 0,
      gameDir: 'baseq2',
      playerNum: 0,
      levelName: 'q2dm1'
    },
    configStrings: new Map(),
    entityBaselines: new Map(),
    playerState: createEmptyProtocolPlayerState(),
    currentEntities: new Map()
  });

  // Helper to create a dummy message block
  const createBlock = (data: Uint8Array): DemoMessageBlock => ({
    sequence: 0,
    data
  });

  it('should keep used configstrings and prune unused ones', () => {
    const state = createWorldState();

    // Add some config strings
    state.configStrings.set(ConfigStringIndex.Models + 1, 'models/active.md2');
    state.configStrings.set(ConfigStringIndex.Models + 2, 'models/unused.md2');
    state.configStrings.set(ConfigStringIndex.Sounds + 1, 'sound/jump.wav');

    const clipWriter = new MessageWriter();

    // Entity 1 uses Model 1
    const ent1 = createEmptyEntityState();
    ent1.number = 100;
    ent1.modelindex = 1;
    clipWriter.writeSpawnBaseline(ent1, 34);

    const clipMessages = [createBlock(clipWriter.getData())];

    const optimized = optimizer.optimizeForClip(state, clipMessages);

    // Expect Model 1 to be present
    expect(optimized.configStrings.has(ConfigStringIndex.Models + 1)).toBe(true);
    // Expect Model 2 to be removed
    expect(optimized.configStrings.has(ConfigStringIndex.Models + 2)).toBe(false);
    // Expect Sound 1 to be removed (unused)
    expect(optimized.configStrings.has(ConfigStringIndex.Sounds + 1)).toBe(false);
  });

  it('should prune unused entity baselines', () => {
    const state = createWorldState();

    const ent1 = createEmptyEntityState();
    ent1.number = 1;
    const ent2 = createEmptyEntityState();
    ent2.number = 2;

    state.entityBaselines.set(1, ent1);
    state.entityBaselines.set(2, ent2);

    // Clip only references entity 1
    const clipWriter = new MessageWriter();
    // Use spawn baseline to reference entity 1
    const entRef = createEmptyEntityState();
    entRef.number = 1;
    clipWriter.writeSpawnBaseline(entRef, 34);

    const clipMessages = [createBlock(clipWriter.getData())];

    const optimized = optimizer.optimizeForClip(state, clipMessages);

    expect(optimized.entityBaselines.has(1)).toBe(true);
    expect(optimized.entityBaselines.has(2)).toBe(false);
  });

  it('should always keep currentEntities', () => {
    const state = createWorldState();

    const ent1 = createEmptyEntityState();
    ent1.number = 1;
    state.currentEntities.set(1, ent1);

    // Empty clip
    const clipMessages: DemoMessageBlock[] = [];

    const optimized = optimizer.optimizeForClip(state, clipMessages);

    // Should keep it because it's in the start state
    expect(optimized.currentEntities.has(1)).toBe(true);
  });

  it('should preserve model dependencies from currentEntities', () => {
    const state = createWorldState();

    const ent1 = createEmptyEntityState();
    ent1.number = 1;
    ent1.modelindex = 5;
    state.currentEntities.set(1, ent1);

    state.configStrings.set(ConfigStringIndex.Models + 5, 'models/gun.md2');
    state.configStrings.set(ConfigStringIndex.Models + 6, 'models/unused.md2');

    const clipMessages: DemoMessageBlock[] = [];

    const optimized = optimizer.optimizeForClip(state, clipMessages);

    expect(optimized.configStrings.has(ConfigStringIndex.Models + 5)).toBe(true);
    expect(optimized.configStrings.has(ConfigStringIndex.Models + 6)).toBe(false);
  });
});
