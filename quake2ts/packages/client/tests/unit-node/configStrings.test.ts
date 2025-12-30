import { describe, it, expect, beforeEach } from 'vitest';
import { ClientConfigStrings } from '@quake2ts/client/configStrings.js';
import { ConfigStringIndex, MAX_MODELS, MAX_SOUNDS, MAX_IMAGES } from '@quake2ts/shared';

describe('ClientConfigStrings', () => {
  let configStrings: ClientConfigStrings;

  beforeEach(() => {
    configStrings = new ClientConfigStrings();
  });

  it('should store and retrieve generic config strings', () => {
    configStrings.set(ConfigStringIndex.Name, 'Quake2');
    expect(configStrings.get(ConfigStringIndex.Name)).toBe('Quake2');
  });

  it('should store and retrieve model names', () => {
    const index = ConfigStringIndex.Models + 10;
    const modelName = 'models/weapons/v_rocket/tris.md2';
    configStrings.set(index, modelName);

    expect(configStrings.get(index)).toBe(modelName);
    expect(configStrings.getModelName(10)).toBe(modelName);
  });

  it('should store and retrieve sound names', () => {
    const index = ConfigStringIndex.Sounds + 5;
    const soundName = 'weapons/rocklf1a.wav';
    configStrings.set(index, soundName);

    expect(configStrings.get(index)).toBe(soundName);
    expect(configStrings.getSoundName(5)).toBe(soundName);
  });

  it('should store and retrieve image names', () => {
    const index = ConfigStringIndex.Images + 2;
    const imageName = 'pics/colormap.pcx';
    configStrings.set(index, imageName);

    expect(configStrings.get(index)).toBe(imageName);
    expect(configStrings.getImageName(2)).toBe(imageName);
  });

  it('should handle clearing', () => {
    configStrings.set(ConfigStringIndex.Name, 'Test');
    configStrings.set(ConfigStringIndex.Models + 1, 'model');

    configStrings.clear();

    expect(configStrings.get(ConfigStringIndex.Name)).toBeUndefined();
    expect(configStrings.getModelName(1)).toBeUndefined();
  });
});
