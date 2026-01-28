import { describe, expect, it } from 'vitest';
import { Entity } from '../../../src/entities/entity.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { createCallbackRegistry, registerCallback } from '../../../src/entities/callbacks.js';
import type { GameEngine } from '../../../src/index.js';

const mockEngine: GameEngine = {
  trace: () => ({}),
};

describe('Callback Serialization', () => {
  it('should serialize and deserialize function references', () => {
    const callbackRegistry = createCallbackRegistry();
    const testThink = (self: Entity) => {};
    registerCallback(callbackRegistry, 'testThink', testThink);

    const mockImports = {
      trace: () => ({} as any),
      pointcontents: () => 0,
      linkentity: () => {},
      areaEdicts: () => null, // default
      multicast: () => {},
      unicast: () => {},
    };

    const entitySystem = new EntitySystem(mockEngine, mockImports, { x: 0, y: 0, z: 0 }, 1, callbackRegistry);
    const entity = entitySystem.world;
    entity.think = testThink;

    const snapshot = entitySystem.createSnapshot();
    const newEntitySystem = new EntitySystem(mockEngine, mockImports, { x: 0, y: 0, z: 0 }, 1, callbackRegistry);
    newEntitySystem.restore(snapshot, callbackRegistry);

    const restoredEntity = newEntitySystem.world;
    expect(restoredEntity.think).toBe(testThink);
  });
});
