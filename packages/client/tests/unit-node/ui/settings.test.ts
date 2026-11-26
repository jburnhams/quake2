import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserSettings } from '@quake2ts/client/ui/settings.js';
import { CvarFlags } from '@quake2ts/shared';

describe('BrowserSettings', () => {
  let storage: any;
  let settings: BrowserSettings;

  beforeEach(() => {
    storage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
    };
    settings = new BrowserSettings(storage);
  });

  it('should save archive cvars', () => {
    // The new signature expects an array of Cvar-like objects
    const cvars = [
        { name: 'fov', value: '100', flags: CvarFlags.Archive },
        { name: 'sensitivity', value: '5', flags: CvarFlags.Archive },
        { name: 'temp_cvar', value: '1', flags: CvarFlags.None }
    ];

    settings.saveCvars(cvars);

    expect(storage.setItem).toHaveBeenCalledWith(
      'quake2ts_cvars',
      JSON.stringify({ fov: '100', sensitivity: '5' })
    );
  });

  it('should load cvars', () => {
    storage.getItem.mockReturnValue(JSON.stringify({ fov: '110', sensitivity: '2' }));

    const cvars = new Map<string, any>();
    const setFov = vi.fn();
    const setSens = vi.fn();

    cvars.set('fov', { value: '90', setValue: setFov });
    cvars.set('sensitivity', { value: '3', setValue: setSens });

    settings.loadCvars(cvars);

    expect(setFov).toHaveBeenCalledWith('110');
    expect(setSens).toHaveBeenCalledWith('2');
  });

  it('should ignore unknown cvars during load', () => {
      storage.getItem.mockReturnValue(JSON.stringify({ unknown_cvar: '123' }));
      const cvars = new Map<string, any>();
      // Should not throw or crash
      settings.loadCvars(cvars);
      expect(cvars.size).toBe(0);
  });
});
