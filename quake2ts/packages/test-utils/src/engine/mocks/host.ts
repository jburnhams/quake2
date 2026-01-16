import { vi } from 'vitest';
import type { EngineHost, Cvar } from '@quake2ts/engine';

export function createMockEngineHost(overrides?: Partial<EngineHost>): EngineHost {
  const cvars = new Map<string, Cvar>();
  const commands = new Map<string, any>();

  return {
    cvars: {
      register: vi.fn((config) => {
        const cvar = {
          name: config.name,
          string: config.defaultValue || '',
          number: parseFloat(config.defaultValue || '0'),
          flags: config.flags || 0,
          modified: false,
          description: config.description,
          onChange: config.onChange
        } as unknown as Cvar;
        cvars.set(config.name, cvar);
        return cvar;
      }),
      get: vi.fn((name) => cvars.get(name)),
      list: vi.fn(() => Array.from(cvars.values())),
      setValue: vi.fn((name, value, flags) => {
        const cvar = cvars.get(name);
        if (cvar) {
          cvar.string = value;
          cvar.number = parseFloat(value);
          cvar.modified = true;
          if (cvar.onChange) {
            cvar.onChange(cvar);
          }
        }
      }),
    },
    commands: {
      register: vi.fn((name, callback) => {
        commands.set(name, callback);
      }),
      execute: vi.fn(),
    },
    ...overrides
  } as unknown as EngineHost;
}
