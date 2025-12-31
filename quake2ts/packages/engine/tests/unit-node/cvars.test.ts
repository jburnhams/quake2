import { describe, expect, it, vi } from 'vitest';
import { CvarFlags } from '@quake2ts/shared';
import { Cvar, CvarRegistry } from '@quake2ts/engine/cvars.js';

describe('Cvar', () => {
  it('tracks numeric/integer/boolean views', () => {
    const cvar = new Cvar({ name: 'sv_gravity', defaultValue: '800' });

    expect(cvar.number).toBe(800);
    expect(cvar.integer).toBe(800);
    expect(cvar.boolean).toBe(true);

    cvar.set('0');
    expect(cvar.boolean).toBe(false);
  });

  it('applies changes immediately unless latched', () => {
    const onChange = vi.fn();
    const cvar = new Cvar({
      name: 'r_mode',
      defaultValue: '8',
      flags: CvarFlags.Latch,
      onChange,
    });

    cvar.set('11');
    expect(cvar.string).toBe('8');
    expect(cvar.applyLatched()).toBe(true);
    expect(cvar.string).toBe('11');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(cvar.modifiedCount).toBe(1);

    // No extra change if latched value matches current.
    cvar.set('11');
    expect(cvar.applyLatched()).toBe(false);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe('CvarRegistry', () => {
  it('registers and reuses cvars by name', () => {
    const registry = new CvarRegistry();
    const a = registry.register({ name: 'sv_maxclients', defaultValue: '4' });
    const b = registry.register({ name: 'sv_maxclients', defaultValue: '8' });

    expect(a).toBe(b);
    expect(a.defaultValue).toBe('4');
  });

  it('allows updates and callbacks through the registry', () => {
    const onChange = vi.fn();
    const registry = new CvarRegistry();
    registry.register({ name: 's_volume', defaultValue: '0.4', onChange });

    registry.setValue('s_volume', '0.6');
    const cvar = registry.get('s_volume');
    expect(cvar?.string).toBe('0.6');
    expect(onChange).toHaveBeenCalledWith(expect.any(Cvar), '0.4');
  });

  it('resets and applies latched values in bulk', () => {
    const registry = new CvarRegistry();
    registry.register({ name: 'g_cheats', defaultValue: '0', flags: CvarFlags.Cheat });
    registry.register({ name: 'gl_mode', defaultValue: '3', flags: CvarFlags.Latch });

    registry.setValue('g_cheats', '1');
    registry.setValue('gl_mode', '11');

    expect(registry.applyLatched()).toBe(true);
    expect(registry.get('gl_mode')?.string).toBe('11');

    registry.resetAll();
    expect(registry.get('g_cheats')?.string).toBe('0');
    expect(registry.get('gl_mode')?.string).toBe('3');
  });

  it('should emit onCvarChange event', () => {
    const registry = new CvarRegistry();
    const changeSpy = vi.fn();
    registry.onCvarChange = changeSpy;

    registry.register({ name: 'test_cvar', defaultValue: '0' });
    registry.setValue('test_cvar', '1');

    expect(changeSpy).toHaveBeenCalledWith('test_cvar', '1');
  });

  it('should list cvars correctly', () => {
    const registry = new CvarRegistry();
    registry.register({ name: 'cvar1', defaultValue: '1' });
    registry.register({ name: 'cvar2', defaultValue: '2' });

    const list = registry.list();
    expect(list.length).toBe(2);
    expect(list[0].name).toBe('cvar1');
    expect(list[1].name).toBe('cvar2');

    const infoList = registry.listCvars();
    expect(infoList.length).toBe(2);
    expect(infoList[0].name).toBe('cvar1');
    expect(infoList[1].name).toBe('cvar2');
  });

  it('should support alias methods setCvar and getCvar', () => {
    const registry = new CvarRegistry();
    registry.register({ name: 'test', defaultValue: 'default' });

    registry.setCvar('test', 'newvalue');
    const cvar = registry.getCvar('test');

    expect(cvar).toBeDefined();
    expect(cvar?.string).toBe('newvalue');
  });
});
