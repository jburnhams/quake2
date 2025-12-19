import { describe, it, expect } from 'vitest';
import {
  ConfigStringIndex,
  CS_NAME,
  CS_MAXCLIENTS,
  CS_MODELS,
  CS_SOUNDS,
  CS_IMAGES,
  MAX_MODELS,
  MAX_SOUNDS
} from '../src/protocol/configstrings.js';

describe('ConfigStrings', () => {
  it('should export correct constants', () => {
    expect(CS_NAME).toBe(0);
    expect(CS_MAXCLIENTS).toBe(60);
    expect(CS_MODELS).toBe(62);
  });

  it('should calculate derived indices correctly', () => {
    expect(CS_SOUNDS).toBe(CS_MODELS + MAX_MODELS);
    expect(CS_IMAGES).toBe(CS_SOUNDS + MAX_SOUNDS);
  });

  it('should have consistent enum and const values', () => {
    expect(ConfigStringIndex.Name).toBe(CS_NAME);
    expect(ConfigStringIndex.MaxClients).toBe(CS_MAXCLIENTS);
    expect(ConfigStringIndex.Models).toBe(CS_MODELS);
  });
});
