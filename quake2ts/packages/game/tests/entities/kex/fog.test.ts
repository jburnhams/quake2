import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerTriggerFog } from '../../../src/entities/triggers/fog.js';
import { Entity, MoveType, Solid, ServerFlags } from '../../../src/entities/entity.js';
import { createTestContext } from '@quake2ts/test-utils';
import { SpawnRegistry } from '../../../src/entities/spawn.js';

describe('trigger_fog', () => {
  let context: ReturnType<typeof createTestContext>;
  let registry: SpawnRegistry;

  beforeEach(() => {
    context = createTestContext();
    registry = new SpawnRegistry();
    registerTriggerFog(registry);
    context.entities.setSpawnRegistry(registry);
    vi.clearAllMocks();
  });

  it('registers trigger_fog spawn function', () => {
    expect(registry.get('trigger_fog')).toBeDefined();
  });

  it('initializes with correct flags and properties', () => {
    const spawnFunc = registry.get('trigger_fog');
    const entity = context.entities.spawn();
    entity.classname = 'trigger_fog';

    // Test parsing keyvalues
    const keyValues = {
        fog_density: '0.5',
        fog_color: '1 0 0',
        fog_sky_factor: '0.1',
        fog_density_off: '0.2',
        fog_color_off: '0 1 0',
        fog_sky_factor_off: '0.2'
    };

    spawnFunc?.(entity, {
      keyValues,
      entities: context.entities,
      warn: vi.fn(),
      free: vi.fn()
    });

    expect(entity.solid).toBe(Solid.Trigger);
    expect(entity.movetype).toBe(MoveType.None);
    expect(entity.svflags & ServerFlags.NoClient).toBeTruthy();
    expect(entity.delay).toBe(0.5); // Default delay

    // Verify custom properties attached (using any cast or updating type)
    const entAny = entity as any;
    expect(entAny.fog_density).toBe(0.5);
    expect(entAny.fog_color).toEqual([1, 0, 0]);
    expect(entAny.fog_sky_factor).toBe(0.1);
    expect(entAny.fog_density_off).toBe(0.2);
    expect(entAny.fog_color_off).toEqual([0, 1, 0]);
    expect(entAny.fog_sky_factor_off).toBe(0.2);
  });

  it('applies fog to client on touch', () => {
    const spawnFunc = registry.get('trigger_fog');
    const entity = context.entities.spawn();
    entity.classname = 'trigger_fog';

    // Setup AFFECT_FOG spawnflag (bit 1)
    entity.spawnflags = 1;
    entity.movedir = { x: 1, y: 0, z: 0 }; // Moving along X

    const keyValues = {
        fog_density: '0.8',
        fog_color: '0.5 0.5 0.5',
        fog_sky_factor: '0.5'
    };

    spawnFunc?.(entity, {
      keyValues,
      entities: context.entities,
      warn: vi.fn(),
      free: vi.fn()
    });

    const clientEnt = context.entities.spawn();
    clientEnt.client = {
        pers: {
            wanted_fog: {},
            fog_transition_time: 0
        }
    } as any;
    clientEnt.velocity = { x: 100, y: 0, z: 0 }; // Moving same direction

    entity.touch?.(entity, clientEnt);

    const wantedFog = clientEnt.client?.pers.wanted_fog;
    expect(wantedFog).toBeDefined();
    expect(wantedFog?.density).toBe(0.8);
    expect(wantedFog?.r).toBe(0.5);
    expect(clientEnt.client?.pers.fog_transition_time).toBe(0.5); // Default delay
  });
});
