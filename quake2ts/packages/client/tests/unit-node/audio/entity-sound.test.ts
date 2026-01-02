import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EntitySoundSystem } from '@quake2ts/client/audio/entity-sound.js';
import { AudioSystem } from '@quake2ts/engine';
import { ClientConfigStrings } from '@quake2ts/client/configStrings.js';

describe('EntitySoundSystem', () => {
  let audioMock: any;
  let configStrings: ClientConfigStrings;
  let system: EntitySoundSystem;

  beforeEach(() => {
    // Mock AudioApi structure.
    // It has a 'system' property which is the actual AudioSystem.
    audioMock = {
      stop_entity_sounds: vi.fn(),
      loop_sound: vi.fn(),
      system: {
          play: vi.fn(),
          updateEntityPosition: vi.fn(),
          stopEntitySounds: vi.fn(),
      }
    };
    configStrings = new ClientConfigStrings();
    system = new EntitySoundSystem(audioMock, configStrings);
  });

  it('should play a looping sound for a new entity with sound', () => {
    const ent = { number: 1, sound: 10, origin: { x: 0, y: 0, z: 0 } };

    // Mock successful play
    const activeSound = {};
    audioMock.loop_sound.mockReturnValue(activeSound);

    system.update([ent], 100);

    expect(audioMock.loop_sound).toHaveBeenCalledWith(
      1, // entity
      0, // channel
      10, // sound index
      1.0, // volume
      3 // attenuation
    );
  });

  it('should update position for tracked sound', () => {
    const ent = { number: 1, sound: 10, origin: { x: 0, y: 0, z: 0 } };
    audioMock.loop_sound.mockReturnValue({});

    system.update([ent], 100);
    audioMock.loop_sound.mockClear();

    // Move
    ent.origin = { x: 10, y: 10, z: 10 };
    system.update([ent], 200);

    expect(audioMock.loop_sound).not.toHaveBeenCalled();
    expect(audioMock.system.updateEntityPosition).toHaveBeenCalledWith(1, { x: 10, y: 10, z: 10 });
  });

  it('should stop sound if sound index changes', () => {
    const ent = { number: 1, sound: 10, origin: { x: 0, y: 0, z: 0 } };
    audioMock.loop_sound.mockReturnValue({});

    system.update([ent], 100);

    // Change sound
    ent.sound = 20;
    system.update([ent], 200);

    expect(audioMock.stop_entity_sounds).toHaveBeenCalledWith(1);
    expect(audioMock.loop_sound).toHaveBeenCalledWith(
      1,
      0,
      20,
      1.0,
      3
    );
  });

  it('should stop sound if entity sound becomes 0', () => {
    const ent = { number: 1, sound: 10, origin: { x: 0, y: 0, z: 0 } };
    audioMock.loop_sound.mockReturnValue({});

    system.update([ent], 100);

    // Disable sound (0 is invalid/no sound)
    const entNoSound = { ...ent, sound: 0 };
    system.update([entNoSound as any], 200);

    expect(audioMock.stop_entity_sounds).toHaveBeenCalledWith(1);
  });

  it('should stop sound if entity disappears', () => {
    const ent = { number: 1, sound: 10, origin: { x: 0, y: 0, z: 0 } };
    audioMock.loop_sound.mockReturnValue({});

    system.update([ent], 100);

    // Empty list
    system.update([], 200);

    expect(audioMock.stop_entity_sounds).toHaveBeenCalledWith(1);
  });
});
