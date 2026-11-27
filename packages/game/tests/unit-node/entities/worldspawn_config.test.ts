import { describe, it, expect, vi } from 'vitest';
import { SP_worldspawn } from '../../../src/entities/worldspawn';
import { Entity } from '../../../src/entities/entity';
import { createTestContext } from '@quake2ts/test-utils';
import { ConfigStringIndex, DEFAULT_LIGHT_STYLES } from '@quake2ts/shared';

describe('worldspawn', () => {
  it('should set sky configstrings', () => {
    const context = createTestContext();
    context.keyValues = {
      sky: 'unit1_sky',
      skyrotate: '10',
      skyautorotate: '0',
      skyaxis: '0 0 1'
    };

    const self = new Entity(0);
    SP_worldspawn(self, context);

    expect(context.entities.imports.configstring).toHaveBeenCalledWith(ConfigStringIndex.Sky, 'unit1_sky');
    expect(context.entities.imports.configstring).toHaveBeenCalledWith(ConfigStringIndex.SkyRotate, '10 0');
    expect(context.entities.imports.configstring).toHaveBeenCalledWith(ConfigStringIndex.SkyAxis, '0 0 1');
  });

  it('should set cdtrack configstring from sounds key', () => {
    const context = createTestContext();
    context.keyValues = {};

    const self = new Entity(0);
    self.sounds = 4; // ED_ParseEdict puts the "sounds" key on the entity
    SP_worldspawn(self, context);

    expect(context.entities.imports.configstring).toHaveBeenCalledWith(ConfigStringIndex.CdTrack, '4');
  });

  it('sets the light animation tables, as SP_worldspawn does', () => {
    const context = createTestContext();
    context.keyValues = {};
    SP_worldspawn(new Entity(0), context);

    const set = context.entities.imports.configstring;
    expect(set).toHaveBeenCalledWith(ConfigStringIndex.Lights + 0, 'm');
    expect(set).toHaveBeenCalledWith(ConfigStringIndex.Lights + 4, 'mamamamamama');
    expect(set).toHaveBeenCalledWith(ConfigStringIndex.Lights + 63, 'a');
    const lights = set.mock.calls.filter(([i]: [number]) => i >= ConfigStringIndex.Lights && i < ConfigStringIndex.Lights + 256);
    expect(lights).toHaveLength(DEFAULT_LIGHT_STYLES.size);
  });
});
