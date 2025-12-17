import { describe, it, expect, vi } from 'vitest';
import { Cvar, CvarRegistry } from '../src/cvars.js';
import { CvarFlags } from '@quake2ts/shared';

describe('Cvar System Enhancement', () => {
  it('should implement the requested API methods', () => {
    const cvar = new Cvar({
      name: 'test_cvar',
      defaultValue: '10',
      flags: CvarFlags.None
    });

    // Test new getter methods alias existing properties
    expect(cvar.getString()).toBe('10');
    expect(cvar.getFloat()).toBe(10);
    expect(cvar.getInt()).toBe(10);
    expect(cvar.getBoolean()).toBe(true);

    cvar.set('0.5');
    expect(cvar.getString()).toBe('0.5');
    expect(cvar.getFloat()).toBe(0.5);
    expect(cvar.getInt()).toBe(0);
    expect(cvar.getBoolean()).toBe(false);
  });

  it('should list cvars correctly from registry', () => {
    const registry = new CvarRegistry();
    registry.register({
      name: 'cvar1',
      defaultValue: 'default1',
      description: 'First cvar',
      flags: CvarFlags.Archive
    });
    registry.register({
      name: 'cvar2',
      defaultValue: 'default2'
    });

    const list = registry.listCvars();
    expect(list).toHaveLength(2);

    const cvar1 = list.find(c => c.name === 'cvar1');
    expect(cvar1).toBeDefined();
    expect(cvar1?.value).toBe('default1');
    expect(cvar1?.flags).toBe(CvarFlags.Archive);
    expect(cvar1?.description).toBe('First cvar');
  });
});
