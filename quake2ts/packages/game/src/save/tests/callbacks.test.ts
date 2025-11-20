import { describe, expect, it } from 'vitest';
import { Entity } from '../../entities/entity.js';
import { EntitySystem } from '../../entities/system.js';
import { createCallbackRegistry, registerCallback } from '../../entities/callbacks.js';
import type { GameEngine } from '../../index.js';
import { TraceResult } from '@quake2ts/shared';

const mockEngine: GameEngine = {
  trace: (): TraceResult => ({
    fraction: 1,
    plane: null,
    surfaceFlags: 0,
    contents: 0,
    allsolid: false,
    startsolid: false,
  }),
};

describe('Callback Serialization', () => {
  it('should serialize and deserialize function references', () => {
    const callbackRegistry = createCallbackRegistry();
    const testThink = (self: Entity) => {};
    registerCallback(callbackRegistry, 'testThink', testThink);

    const entitySystem = new EntitySystem(mockEngine, 1, callbackRegistry);
    const entity = entitySystem.world;
    entity.think = testThink;

    const snapshot = entitySystem.createSnapshot();
    const newEntitySystem = new EntitySystem(mockEngine, 1);
    newEntitySystem.restore(snapshot, callbackRegistry);

    const restoredEntity = newEntitySystem.world;
    expect(restoredEntity.think).toBe(testThink);
  });
});
