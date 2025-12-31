import { describe, expect, it } from 'vitest';
import { ConfigStringIndex, MAX_CLIENTS } from '@quake2ts/shared';
import { ConfigStringRegistry } from '../../src/configstrings.js';

describe('ConfigStringRegistry', () => {
  it('assigns deterministic indices for each range and reuses existing entries', () => {
    const registry = new ConfigStringRegistry();

    const modelA = registry.modelIndex('models/weapons/v_blaster/tris.md2');
    const modelB = registry.modelIndex('models/weapons/v_shotg/tris.md2');
    const modelA2 = registry.modelIndex('models/weapons/v_blaster/tris.md2');

    expect(modelA).toBe(ConfigStringIndex.Models);
    expect(modelB).toBe(ConfigStringIndex.Models + 1);
    expect(modelA2).toBe(modelA);

    const sound = registry.soundIndex('world/ambience/windfly.wav');
    expect(sound).toBe(ConfigStringIndex.Sounds);

    const image = registry.imageIndex('pics/i_health.pcx');
    expect(image).toBe(ConfigStringIndex.Images);
  });

  it('enforces per-range capacity and length limits', () => {
    const registry = new ConfigStringRegistry();
    const tinyStatusbar = 'x'.repeat(96 * (ConfigStringIndex.AirAccel - ConfigStringIndex.StatusBar));
    expect(() => registry.set(ConfigStringIndex.StatusBar, tinyStatusbar)).not.toThrow();

    const tooLong = 'y'.repeat(97);
    expect(() => registry.modelIndex(tooLong)).toThrow(/exceeds maximum length/i);
  });

  it('throws when a range runs out of slots', () => {
    const registry = new ConfigStringRegistry();
    for (let i = 0; i < MAX_CLIENTS; i += 1) {
      registry.playerSkinIndex(`players/skin${i}.pcx`);
    }

    expect(() => registry.playerSkinIndex('players/overflow/skin.pcx')).toThrow(/out of configstring slots/i);
  });

  it('exports a dense string array for client synchronization', () => {
    const registry = new ConfigStringRegistry();
    const modelIndex = registry.modelIndex('models/objects/rocket/tris.md2');
    const generalIndex = registry.generalIndex('map=sudden_death');

    const strings = registry.getAll();
    expect(strings.at(modelIndex)).toBe('models/objects/rocket/tris.md2');
    expect(strings.at(generalIndex)).toBe('map=sudden_death');
    expect(strings).toHaveLength(ConfigStringIndex.MaxConfigStrings);
  });
});
