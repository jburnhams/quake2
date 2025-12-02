import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerTargetSpawns } from '../../src/entities/targets.js';
import { Entity } from '../../src/entities/entity.js';
import { EntitySystem } from '../../src/entities/system.js';
import { createDefaultSpawnRegistry, SpawnFunction } from '../../src/entities/spawn.js';

describe('target_autosave', () => {
  let context: EntitySystem;
  let entity: Entity;
  let spawnFunc: SpawnFunction;
  let commandMock: ReturnType<typeof vi.fn>;
  let cvarMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    commandMock = vi.fn();
    cvarMock = vi.fn().mockReturnValue({ value: 60 });

    context = {
      spawn: vi.fn().mockReturnValue({}),
      linkentity: vi.fn(),
      serverCommand: commandMock,
      cvar: cvarMock,
      entities: {
        spawn: vi.fn().mockReturnValue({}),
        timeSeconds: 100,
        serverCommand: commandMock,
        cvar: cvarMock,
        level: {
            next_auto_save: 0,
            time: 100 // This will need to be accessed via context.entities.level.time usually, or context.entities.timeSeconds
        }
      },
      keyValues: {},
    } as unknown as EntitySystem;

    entity = {
      classname: 'target_autosave',
      use: undefined,
    } as unknown as Entity;

    const registry = createDefaultSpawnRegistry();
    registerTargetSpawns(registry);
    spawnFunc = registry.get('target_autosave')!;
  });

  it('triggers autosave command when time requirement met', () => {
    // Call spawn
    spawnFunc(entity, context as any);

    // Initial state: next_auto_save = 0, time = 100. Diff = 100.
    // min_time = 60 (mocked). 100 > 60. Should trigger.

    entity.use?.(entity, null, null);

    expect(commandMock).toHaveBeenCalledWith('autosave\n');
  });

  it('does not trigger autosave if too soon', () => {
    spawnFunc(entity, context as any);

    // Set next_auto_save to recent
    (context.entities as any).level.next_auto_save = 90;
    // time = 100. Diff = 10. min_time = 60. 10 < 60. Should NOT trigger.

    entity.use?.(entity, null, null);

    expect(commandMock).not.toHaveBeenCalled();
  });
});
