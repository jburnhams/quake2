import { describe, it, expect, vi } from 'vitest';
import { createDefaultSpawnRegistry, spawnEntitiesFromText } from '../../src/entities/spawn.js';
import { EntitySystem } from '../../src/entities/system.js';
import { DoorState, registerFuncSpawns } from '../../src/entities/funcs.js';

describe('Funcs Integration', () => {
  const registry = createDefaultSpawnRegistry(null);
  registerFuncSpawns(registry);


  it('should open a door when a button is used', () => {
    const entities = new EntitySystem(2048);
    const map = `
    {
      "classname" "func_button"
      "target" "door1"
    }
    {
      "classname" "func_door"
      "targetname" "door1"
    }
    `;

    const spawned = spawnEntitiesFromText(map, { registry, entities });
    const button = spawned.find(e => e.classname === 'func_button');
    const door = spawned.find(e => e.classname === 'func_door');

    expect(button).not.toBeNull();
    expect(door).not.toBeNull();

    const originalPos = { ...door.origin };

    expect(door.state).toBe(DoorState.Closed);

    button.use(button, null, null);

    expect(door.state).toBe(DoorState.Opening);

    // Simulate some time passing.
    entities.beginFrame(0.1);
    entities.runFrame();
    entities.beginFrame(0.2);
    entities.runFrame();

    expect(door.origin.y).toBeGreaterThan(originalPos.y);
  });
});
