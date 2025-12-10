
import { describe, it, expect, vi } from 'vitest';
import { CvarRegistry, Cvar } from '../src/cvars.js';
import { CvarFlags } from '@quake2ts/shared';

describe('CvarRegistry Enhanced', () => {
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
