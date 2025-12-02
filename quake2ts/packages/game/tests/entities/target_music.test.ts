import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerTargetSpawns } from '../../src/entities/targets.js';
import { Entity } from '../../src/entities/entity.js';
import { EntitySystem } from '../../src/entities/system.js';
import { ConfigStringIndex } from '@quake2ts/shared';
import { createDefaultSpawnRegistry, SpawnFunction } from '../../src/entities/spawn.js';

describe('target_music', () => {
  let context: EntitySystem;
  let entity: Entity;
  let spawnFunc: SpawnFunction;
  let configStringMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    configStringMock = vi.fn();
    // Mock EntitySystem
    context = {
      spawn: vi.fn().mockReturnValue({}),
      linkentity: vi.fn(),
      configString: configStringMock,
      entities: {
        spawn: vi.fn().mockReturnValue({}),
        timeSeconds: 10,
        configString: configStringMock,
      },
      keyValues: {},
    } as unknown as EntitySystem;

    entity = {
      classname: 'target_music',
      sounds: 0,
      use: undefined,
    } as unknown as Entity;

    const registry = createDefaultSpawnRegistry();
    registerTargetSpawns(registry);
    spawnFunc = registry.get('target_music')!;
  });

  it('sets CS_CDTRACK when used', () => {
    // Need to pass keyValues so the spawn function parses it
    context.keyValues = { sounds: '12' };

    // Call the spawn function
    spawnFunc(entity, context as any);

    // Trigger use
    entity.use?.(entity, null, null);

    expect(configStringMock).toHaveBeenCalledWith(ConfigStringIndex.CdTrack, "12");
  });
});
