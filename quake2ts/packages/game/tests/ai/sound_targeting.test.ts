
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Entity, MoveType, Solid, EntityFlags } from '../../src/entities/entity';
import { findTarget } from '../../src/ai/targeting';
import { AIFlags } from '../../src/ai/constants';
import { MASK_MONSTERSOLID, CONTENTS_SOLID } from '@quake2ts/shared';

// Create a mock EntitySystem with necessary methods
const mockContext = {
  trace: vi.fn(),
  pointcontents: vi.fn(),
  linkentity: vi.fn(),
  rng: {
    frandom: vi.fn(),
    crandom: vi.fn(),
  },
  findRadius: vi.fn(),
  checkBottom: vi.fn(),
  inPHS: vi.fn(),
  areasConnected: vi.fn(),
} as any;

describe('Sound-based Targeting', () => {
  let monster: Entity;
  let player: Entity;
  let noiseEntity: Entity;

  beforeEach(() => {
    vi.clearAllMocks();

    player = {
      classname: 'player',
      origin: { x: 100, y: 0, z: 0 },
      mins: { x: -16, y: -16, z: -24 },
      maxs: { x: 16, y: 16, z: 32 },
      flags: 0,
      client: {
        sound_entity: null,
        sound_entity_time: 0,
      }
    } as any;

    monster = {
      classname: 'monster_soldier',
      origin: { x: 0, y: 0, z: 0 },
      angles: { x: 0, y: 0, z: 0 },
      mins: { x: -16, y: -16, z: -24 },
      maxs: { x: 16, y: 16, z: 32 },
      monsterinfo: {
        aiflags: 0,
        sight: vi.fn(),
        last_sighting: { x: 0, y: 0, z: 0 },
      },
      enemy: null,
      goalentity: null,
      areanum: 1,
    } as any;

    noiseEntity = {
      classname: 'player_noise',
      origin: { x: 100, y: 0, z: 0 },
      owner: player,
      teleport_time: 0,
      inUse: true,
      velocity: { x: 0, y: 0, z: 0 },
    } as any;

    mockContext.timeSeconds = 100;
    mockContext.targetAwareness = {
        activePlayers: [player],
        monsterAlertedByPlayers: vi.fn().mockReturnValue(null),
        soundClient: vi.fn(),
    };

    // Default visibility check: blocked
    mockContext.trace.mockReturnValue({
      fraction: 0.0,
      ent: null,
    });

    // Mock range
    // rangeTo mocked implicitly by distance calculation in implementation if simple
    // but findTarget uses complex checks. We rely on the context mocks.
  });

  it('should target sound source when player is not visible', () => {
    // Setup player making noise
    player.client.sound_entity = noiseEntity;
    player.client.sound_entity_time = 100;

    // Mock sound client helper
    mockContext.targetAwareness.soundClient.mockReturnValue(noiseEntity);

    // Set soundEntity on targetAwareness state, as targeting.ts reads this directly
    // Frame numbers are matched in chooseCandidate (>= frameNumber - 1)
    // mockContext.timeSeconds is 100.
    // We assume frameNumber is somewhat consistent or we set it.
    // system.ts sets frameNumber based on beginFrame.
    // In test, we can just set them on the mock object.
    mockContext.targetAwareness.frameNumber = 1000;
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
    player.client.sound_entity = noiseEntity;
    player.client.sound_entity_time = 100;

    mockContext.targetAwareness.soundClient.mockReturnValue(noiseEntity);
    mockContext.inPHS.mockReturnValue(true);

    const result = findTarget(monster, mockContext.targetAwareness, mockContext, mockContext.trace);

    expect(result).toBe(false);
    expect(monster.enemy).toBeNull();
  });

  it('should ignore sound if areas are not connected', () => {
    player.client.sound_entity = noiseEntity;
    player.client.sound_entity_time = 100;
    noiseEntity.areanum = 2; // Different area

    mockContext.targetAwareness.soundClient.mockReturnValue(noiseEntity);
    mockContext.inPHS.mockReturnValue(true);
    mockContext.areasConnected.mockReturnValue(false); // Not connected

    // Pass custom hooks for areasConnected
    const hooks = {
        areasConnected: mockContext.areasConnected
    };
    // Need to make sure areasConnected is actually used.
    // mockContext.areasConnected is mocked to false.
    // updateSoundChase calls hearability.areasConnected if it exists.

    const result = findTarget(monster, mockContext.targetAwareness, mockContext, mockContext.trace, hooks);

    expect(result).toBe(false);
  });
});
