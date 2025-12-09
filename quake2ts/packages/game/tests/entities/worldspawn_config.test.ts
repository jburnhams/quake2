import { describe, it, expect, vi } from 'vitest';
import { SP_worldspawn } from '../../src/entities/worldspawn';
import { Entity } from '../../src/entities/entity';
import { createSpawnContext } from '../test-helpers';
import { ConfigStringIndex } from '@quake2ts/shared';

describe('worldspawn', () => {
  it('should set sky configstrings', () => {
    const context = createSpawnContext();
    context.keyValues = {
      sky: 'unit1_sky',
      skyrotate: '10 20 30',
      skyaxis: '0 0 1'
    };

    const self = new Entity(0);
    SP_worldspawn(self, context);

    expect(context.entities.imports.configstring).toHaveBeenCalledWith(ConfigStringIndex.Sky, 'unit1_sky');
    expect(context.entities.imports.configstring).toHaveBeenCalledWith(ConfigStringIndex.SkyRotate, '10 20 30');
    expect(context.entities.imports.configstring).toHaveBeenCalledWith(ConfigStringIndex.SkyAxis, '0 0 1');
  });

  it('should set cdtrack configstring from sounds key', () => {
    const context = createSpawnContext();
    context.keyValues = {
      sounds: '4'
    };

    const self = new Entity(0);
    SP_worldspawn(self, context);

    expect(context.entities.imports.configstring).toHaveBeenCalledWith(ConfigStringIndex.CdTrack, '4');
  });
});
