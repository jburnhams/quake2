import { describe, it, expect } from 'vitest';
import {
  configStringSize,
  ConfigStringIndex,
  CS_MAX_STRING_LENGTH,
  CS_MAX_STRING_LENGTH_OLD,
  MAX_MODELS,
  MAX_SOUNDS,
  MAX_IMAGES,
  MAX_LIGHTSTYLES,
  MAX_ITEMS,
  CS_NAME,
  CS_CDTRACK,
  CS_SKY,
  CS_SKYAXIS,
  CS_SKYROTATE,
  CS_STATUSBAR,
  CS_AIRACCEL,
  CS_MAXCLIENTS,
  CS_MAPCHECKSUM,
  CS_MODELS,
  CS_SOUNDS,
  CS_IMAGES,
  CS_LIGHTS,
  CS_ITEMS,
  CS_PLAYERS,
  CS_GENERAL
} from '../../src/protocol/configstrings.js';

describe('ConfigStrings', () => {
  describe('Offsets', () => {
    it('should correctly offset enum values', () => {
      expect(ConfigStringIndex.Sounds).toBe(ConfigStringIndex.Models + MAX_MODELS);
      expect(ConfigStringIndex.Images).toBe(ConfigStringIndex.Sounds + MAX_SOUNDS);
      expect(ConfigStringIndex.Lights).toBe(ConfigStringIndex.Images + MAX_IMAGES);
      expect(ConfigStringIndex.ShadowLights).toBe(ConfigStringIndex.Lights + MAX_LIGHTSTYLES);
      expect(ConfigStringIndex.Items).toBe(ConfigStringIndex.ShadowLights + MAX_LIGHTSTYLES);
      expect(ConfigStringIndex.Players).toBe(ConfigStringIndex.Items + MAX_ITEMS);
    });
  });

  describe('configStringSize', () => {
    it('should return CS_MAX_STRING_LENGTH for standard indices', () => {
      expect(configStringSize(ConfigStringIndex.Name)).toBe(CS_MAX_STRING_LENGTH);
      expect(configStringSize(ConfigStringIndex.Models)).toBe(CS_MAX_STRING_LENGTH);
    });

    it('should return calculated length for StatusBar range', () => {
      // Logic: CS_MAX_STRING_LENGTH * (ConfigStringIndex.AirAccel - index)
      // StatusBar is 5, AirAccel is 59.
      const index = ConfigStringIndex.StatusBar;
      const expected = CS_MAX_STRING_LENGTH * (ConfigStringIndex.AirAccel - index);
      expect(configStringSize(index)).toBe(expected);

      const midIndex = 30;
      const expectedMid = CS_MAX_STRING_LENGTH * (ConfigStringIndex.AirAccel - midIndex);
      expect(configStringSize(midIndex)).toBe(expectedMid);
    });

    it('should return calculated length for General range', () => {
      // Logic: CS_MAX_STRING_LENGTH * (ConfigStringIndex.MaxConfigStrings - index)
      const index = ConfigStringIndex.General;
      const expected = CS_MAX_STRING_LENGTH * (ConfigStringIndex.MaxConfigStrings - index);
      expect(configStringSize(index)).toBe(expected);
    });
  });

  describe('Legacy Constants', () => {
    it('should export constants matching ConfigStringIndex', () => {
      expect(CS_NAME).toBe(ConfigStringIndex.Name);
      expect(CS_CDTRACK).toBe(ConfigStringIndex.CdTrack);
      expect(CS_SKY).toBe(ConfigStringIndex.Sky);
      expect(CS_SKYAXIS).toBe(ConfigStringIndex.SkyAxis);
      expect(CS_SKYROTATE).toBe(ConfigStringIndex.SkyRotate);
      expect(CS_STATUSBAR).toBe(ConfigStringIndex.StatusBar);
      expect(CS_AIRACCEL).toBe(ConfigStringIndex.AirAccel);
      expect(CS_MAXCLIENTS).toBe(ConfigStringIndex.MaxClients);
      expect(CS_MAPCHECKSUM).toBe(ConfigStringIndex.MapChecksum);
      expect(CS_MODELS).toBe(ConfigStringIndex.Models);
      expect(CS_SOUNDS).toBe(ConfigStringIndex.Sounds);
      expect(CS_IMAGES).toBe(ConfigStringIndex.Images);
      expect(CS_LIGHTS).toBe(ConfigStringIndex.Lights);
      expect(CS_ITEMS).toBe(ConfigStringIndex.Items);
      expect(CS_PLAYERS).toBe(ConfigStringIndex.Players);
      expect(CS_GENERAL).toBe(ConfigStringIndex.General);
    });

    it('should have specific known values (Rerelease Protocol)', () => {
      expect(CS_NAME).toBe(0);
      expect(CS_CDTRACK).toBe(1);
      expect(CS_SKY).toBe(2);
      expect(CS_SKYAXIS).toBe(3);
      expect(CS_SKYROTATE).toBe(4);
      expect(CS_STATUSBAR).toBe(5);

      // Rerelease specific values
      expect(CS_AIRACCEL).toBe(59);
      expect(CS_MAXCLIENTS).toBe(60);
      expect(CS_MAPCHECKSUM).toBe(61);
      expect(CS_MODELS).toBe(62);
    });
  });
});
