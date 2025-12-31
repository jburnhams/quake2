
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Entity } from '../../src/entities/entity.js';
import { findTarget } from '../../src/ai/targeting.js';
import { AIFlags } from '../../src/ai/constants.js';
import { createMonsterEntityFactory, createPlayerEntityFactory } from '@quake2ts/test-utils/game/factories';
import { createTestContext, spawnEntity } from '@quake2ts/test-utils/game/helpers';

describe('Sound-based Targeting', () => {
  let monster: Entity;
  let player: Entity;
  let noiseEntity: Entity;
  let context: ReturnType<typeof createTestContext>;
  let mockContext: any;

  beforeEach(async () => {
    context = await createTestContext();
    mockContext = context.entities;

    player = spawnEntity(mockContext, createPlayerEntityFactory({
      origin: { x: 100, y: 0, z: 0 },
      client: {
        sound_entity: null,
        sound_entity_time: 0,
      } as any
    }));

    monster = spawnEntity(mockContext, createMonsterEntityFactory('monster_soldier', {
      origin: { x: 0, y: 0, z: 0 },
      monsterinfo: {
        aiflags: 0,
        sight: vi.fn(),
        last_sighting: { x: 0, y: 0, z: 0 },
      } as any,
      areanum: 1,
    }));

    noiseEntity = spawnEntity(mockContext, {
      classname: 'player_noise',
      origin: { x: 100, y: 0, z: 0 },
      owner: player,
      teleport_time: 0,
      inUse: true,
      velocity: { x: 0, y: 0, z: 0 },
      areanum: 1, // Same area
    });

    mockContext.timeSeconds = 100;
    mockContext.targetAwareness = {
        activePlayers: [player],
        monsterAlertedByPlayers: vi.fn().mockReturnValue(null),
        soundClient: vi.fn(),
        frameNumber: 1000,
        sightEntity: null,
        soundEntity: null,
    };

    // Default visibility check: blocked
    mockContext.trace.mockReturnValue({
      fraction: 0.0,
      ent: null,
    });

    // Need to set areasConnected implementation or mock on context imports?
    // findTarget uses context.imports.areasConnected if available or just internal checks.
    // The implementation of findTarget calls hearability -> areasConnected
    // areasConnected is usually an engine function or a helper.
    // In quake2ts, it's imported from @quake2ts/server or similar.
    // The test mock context has `areasConnected`.

    mockContext.areasConnected = vi.fn();
    mockContext.inPHS = vi.fn();
  });

  it('should target sound source when player is not visible', () => {
    // Setup player making noise
    player.client!.sound_entity = noiseEntity;
    player.client!.sound_entity_time = 100;

    // Mock sound client helper
    mockContext.targetAwareness.soundClient.mockReturnValue(noiseEntity);

    // Set soundEntity on targetAwareness state
    mockContext.targetAwareness.soundEntity = noiseEntity;
    mockContext.targetAwareness.soundEntityFrame = 1000;

    // Mock PHS check to true (can hear)
    mockContext.inPHS.mockReturnValue(true);
    mockContext.areasConnected.mockReturnValue(true);

    const result = findTarget(monster, mockContext.targetAwareness, mockContext, mockContext.trace);

    // If result is true, it means we found a target
    expect(result).toBe(true);
    // The implementation of updateSoundChase sets self.enemy = client.
    // In our case, the client is noiseEntity (the player noise).
    expect(monster.enemy).toBe(noiseEntity);
    // Use bitwise AND to check if the flag is set
    expect((monster.monsterinfo.aiflags & AIFlags.SoundTarget) !== 0).toBe(true);
  });

  it('should ignore sound if too far away', () => {
    // Setup player making noise far away
    noiseEntity.origin = { x: 2000, y: 0, z: 0 };
    player.client!.sound_entity = noiseEntity;
    player.client!.sound_entity_time = 100;

    mockContext.targetAwareness.soundClient.mockReturnValue(noiseEntity);
    mockContext.inPHS.mockReturnValue(true);

    const result = findTarget(monster, mockContext.targetAwareness, mockContext, mockContext.trace);

    expect(result).toBe(false);
    expect(monster.enemy).toBeNull();
  });

  it('should ignore sound if areas are not connected', () => {
    player.client!.sound_entity = noiseEntity;
    player.client!.sound_entity_time = 100;
    noiseEntity.areanum = 2; // Different area

    mockContext.targetAwareness.soundClient.mockReturnValue(noiseEntity);
    mockContext.inPHS.mockReturnValue(true);
    mockContext.areasConnected.mockReturnValue(false); // Not connected

    // Pass custom hooks for areasConnected if findTarget supports it or rely on context
    // The original test passed a hooks object.
    const hooks = {
        areasConnected: mockContext.areasConnected
    };

    const result = findTarget(monster, mockContext.targetAwareness, mockContext, mockContext.trace, hooks);

    expect(result).toBe(false);
  });
});
