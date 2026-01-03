import { describe, expect, it } from 'vitest';
import { SoundChannel } from '../../src/audio/constants.js';
import { createInitialChannels, pickChannel } from '../../src/audio/channels.js';

describe('pickChannel', () => {
  it('overrides an existing non-auto channel for the same entity and entchannel', () => {
    const channels = createInitialChannels();
    channels[0] = { entnum: 5, entchannel: SoundChannel.Weapon, endTimeMs: 5000, isPlayer: false, active: true };

    const index = pickChannel(channels, 5, SoundChannel.Weapon, { nowMs: 0, playerEntity: 1 });

    expect(index).toBe(0);
  });

  it('ignores channel flag bits when comparing entchannels', () => {
    const channels = createInitialChannels();
    channels[0] = {
      entnum: 4,
      entchannel: SoundChannel.Weapon,
      endTimeMs: 5000,
      isPlayer: false,
      active: true,
    };

    const flaggedWeapon = SoundChannel.Weapon | SoundChannel.Reliable;
    const index = pickChannel(channels, 4, flaggedWeapon, { nowMs: 100, playerEntity: undefined });

    expect(index).toBe(0);
  });

  it('skips overriding player-owned sounds when stealing auto channels', () => {
    const channels = createInitialChannels(1);
    channels[0] = { entnum: 1, entchannel: SoundChannel.Weapon, endTimeMs: 200, isPlayer: true, active: true };
    channels[1] = { entnum: 2, entchannel: SoundChannel.Auto, endTimeMs: 1000, isPlayer: false, active: true };
    channels[2] = { entnum: 7, entchannel: SoundChannel.Auto, endTimeMs: 50, isPlayer: false, active: true };
    for (let i = 3; i < channels.length; i += 1) {
      channels[i] = { entnum: i + 2, entchannel: SoundChannel.Auto, endTimeMs: 100, isPlayer: false, active: true };
    }

    const index = pickChannel(channels, 3, SoundChannel.Auto, { nowMs: 50, playerEntity: 1 });

    expect(index).toBe(2);
  });

  it('steals the channel with the least life remaining for CHAN_AUTO', () => {
    const channels = createInitialChannels();
    channels[0] = { entnum: 2, entchannel: SoundChannel.Auto, endTimeMs: 5000, isPlayer: false, active: true };
    channels[1] = { entnum: 3, entchannel: SoundChannel.Auto, endTimeMs: 1000, isPlayer: false, active: true };
    for (let i = 2; i < channels.length; i += 1) {
      channels[i] = { entnum: i + 3, entchannel: SoundChannel.Auto, endTimeMs: 1500, isPlayer: false, active: true };
    }

    const index = pickChannel(channels, 4, SoundChannel.Auto, { nowMs: 0, playerEntity: undefined });

    expect(index).toBe(1);
  });

  it('throws when asked to pick a negative entchannel', () => {
    const channels = createInitialChannels();

    expect(() => pickChannel(channels, 1, -1, { nowMs: 0, playerEntity: undefined })).toThrow(
      /entchannel must be non-negative/i,
    );
  });
});
