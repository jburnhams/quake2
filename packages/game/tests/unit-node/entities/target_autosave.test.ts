import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerTargetSpawns } from '../../../src/entities/targets.js';
import { createDefaultSpawnRegistry, SpawnFunction } from '../../../src/entities/spawn.js';
import { createEntityFactory, createTestContext, type TestContext } from '@quake2ts/test-utils';
import type { Entity } from '../../../src/entities/entity.js';

describe('target_autosave', () => {
  let context: TestContext;
  let entity: Entity;
  let spawnFunc: SpawnFunction;
  let commandMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    commandMock = vi.fn();

    context = createTestContext({
      imports: {
        serverCommand: commandMock,
      },
    });

    // Mock timeSeconds on the entities object
    (context.entities as any).timeSeconds = 100;

    // Mock level state
    context.entities.level.next_auto_save = 0;

    const entityData = createEntityFactory({
      classname: 'target_autosave',
    });

    entity = context.entities.spawn();
    Object.assign(entity, entityData);

    const registry = createDefaultSpawnRegistry();
    registerTargetSpawns(registry);
    spawnFunc = registry.get('target_autosave')!;
  });

  it('triggers autosave command when time requirement met', () => {
    // Call spawn
    spawnFunc(entity, context);

    // Initial state: next_auto_save = 0, time = 100. Diff = 100.
    // min_time = 60. 100 > 60. Should trigger.

    entity.use?.(entity, null, null);

    expect(commandMock).toHaveBeenCalledWith('autosave\n');
  });

  it('does not trigger autosave if too soon', () => {
    spawnFunc(entity, context);

    // Set next_auto_save to recent
    context.entities.level.next_auto_save = 90;
    // time = 100. Diff = 10. min_time = 60. 10 < 60. Should NOT trigger.

    entity.use?.(entity, null, null);

    expect(commandMock).not.toHaveBeenCalled();
  });
});
