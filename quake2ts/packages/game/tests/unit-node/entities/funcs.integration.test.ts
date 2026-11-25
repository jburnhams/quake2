import { describe, it, expect, vi } from 'vitest';
import { createDefaultSpawnRegistry, spawnEntitiesFromText } from '../../../src/entities/spawn.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { registerFuncSpawns } from '../../../src/entities/funcs.js';
import { STATE_BOTTOM, STATE_UP } from '../../../src/entities/movers.js';

describe('Funcs Integration', () => {
  const registry = createDefaultSpawnRegistry(null);
  registerFuncSpawns(registry);


  it('should open a door when a button is used', () => {
    // Mock engine to handle sound
    const mockEngine = {
      sound: vi.fn(),
    } as any;

    const entities = new EntitySystem(mockEngine, null, null, 2048);
    // Note: We set angle to 90 to ensure the door moves in the Y direction.
    // We also set mins/maxs because func_door calculates travel distance based on size.
    const map = `
    {
      "classname" "func_button"
      "target" "door1"
      "mins" "-4 -4 0"
      "maxs" "4 4 8"
    }
    {
      "classname" "func_door"
      "targetname" "door1"
      "angle" "90"
      "mins" "-20 -20 0"
      "maxs" "20 20 80"
    }
    `;

    const spawned = spawnEntitiesFromText(map, { registry, entities });
    const button = spawned.find(e => e.classname === 'func_button');
    const door = spawned.find(e => e.classname === 'func_door');

    expect(button).not.toBeNull();
    expect(door).not.toBeNull();

    const originalPos = { ...door.origin };

    expect(door.moveinfo.state).toBe(STATE_BOTTOM);

    button.use(button, null, null);
    expect(mockEngine.sound).toHaveBeenCalledTimes(1); // the button's sound

    // The button fires its targets once it is all the way in (button_wait), so run frames.
    for (let t = 0.025; t <= 1; t += 0.025) {
      entities.beginFrame(t);
      entities.runFrame();
    }

    expect(door.moveinfo.state).not.toBe(STATE_BOTTOM);
    // + the door's start sound (and its end sound, if it has already arrived)
    expect(mockEngine.sound.mock.calls.length).toBeGreaterThanOrEqual(2);

    expect(door.origin.y).toBeGreaterThan(originalPos.y);
  });
});
