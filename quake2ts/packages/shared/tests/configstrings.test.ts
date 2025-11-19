import { describe, expect, it } from 'vitest';
import {
  ConfigStringIndex,
  CS_MAX_STRING_LENGTH,
  MAX_GENERAL,
  MAX_IMAGES,
  MAX_ITEMS,
  MAX_LIGHTSTYLES,
  MAX_MODELS,
  MAX_CLIENTS,
  MAX_SHADOW_LIGHTS,
  MAX_SOUNDS,
  MAX_WHEEL_ITEMS,
  configStringSize,
} from '../src/protocol/configstrings.js';

// Quick sanity check that arithmetic-based offsets match the rerelease layout.
const MAX_CONFIGSTRINGS = ConfigStringIndex.MaxConfigStrings;

describe('configstring constants', () => {
  it('matches rerelease offsets for model/sound/image ranges', () => {
    expect(ConfigStringIndex.Models).toBe(62);
    expect(ConfigStringIndex.Sounds).toBe(ConfigStringIndex.Models + MAX_MODELS);
    expect(ConfigStringIndex.Images).toBe(ConfigStringIndex.Sounds + MAX_SOUNDS);
  });

  it('matches rerelease offsets for lights, items, and player skins', () => {
    expect(ConfigStringIndex.Lights).toBe(ConfigStringIndex.Images + MAX_IMAGES);
    expect(ConfigStringIndex.ShadowLights).toBe(ConfigStringIndex.Lights + MAX_LIGHTSTYLES);
    expect(ConfigStringIndex.Items).toBe(ConfigStringIndex.ShadowLights + MAX_SHADOW_LIGHTS);
    expect(ConfigStringIndex.PlayerSkins).toBe(ConfigStringIndex.Items + MAX_ITEMS);
  });

  it('lays out the wheel/general ranges with the same limits as the C++ enum', () => {
    expect(ConfigStringIndex.General).toBe(ConfigStringIndex.PlayerSkins + MAX_CLIENTS);
    expect(ConfigStringIndex.WheelWeapons).toBe(ConfigStringIndex.General + MAX_GENERAL);
    expect(ConfigStringIndex.WheelAmmo).toBe(ConfigStringIndex.WheelWeapons + MAX_WHEEL_ITEMS);
    expect(ConfigStringIndex.WheelPowerups).toBe(ConfigStringIndex.WheelAmmo + MAX_WHEEL_ITEMS);
    expect(ConfigStringIndex.CdLoopCount).toBe(ConfigStringIndex.WheelPowerups + MAX_WHEEL_ITEMS);
    expect(MAX_CONFIGSTRINGS).toBeGreaterThan(ConfigStringIndex.CdLoopCount);
  });
});

describe('configStringSize', () => {
  it('caps most indices at the base 96-character limit', () => {
    expect(configStringSize(ConfigStringIndex.Models)).toBe(CS_MAX_STRING_LENGTH);
    expect(configStringSize(ConfigStringIndex.ShadowLights)).toBe(CS_MAX_STRING_LENGTH);
    expect(configStringSize(ConfigStringIndex.CdLoopCount)).toBe(CS_MAX_STRING_LENGTH);
  });

  it('expands statusbar slots to span the gap up to CS_AIRACCEL', () => {
    const span = ConfigStringIndex.AirAccel - ConfigStringIndex.StatusBar;
    expect(configStringSize(ConfigStringIndex.StatusBar)).toBe(CS_MAX_STRING_LENGTH * span);
    expect(configStringSize(ConfigStringIndex.StatusBar + 1)).toBe(CS_MAX_STRING_LENGTH * (span - 1));
  });

  it('expands general slots to cover the remaining configstring space', () => {
    expect(configStringSize(ConfigStringIndex.General)).toBe(
      CS_MAX_STRING_LENGTH * (MAX_CONFIGSTRINGS - ConfigStringIndex.General),
    );
    expect(configStringSize(ConfigStringIndex.General + 1)).toBe(
      CS_MAX_STRING_LENGTH * (MAX_CONFIGSTRINGS - (ConfigStringIndex.General + 1)),
    );
  });
});
