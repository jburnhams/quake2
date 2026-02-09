import { vi } from 'vitest';
import type { EngineHost, Cvar, GameSimulation, GameFrameResult, ClientRenderer, GameRenderSample, EngineExports, SubtitleClient } from '@quake2ts/engine';
import { createMockSubtitleClient } from './audio-api.js';

export function createMockEngineHost(overrides?: Partial<EngineHost>): EngineHost {
  const cvars = new Map<string, Cvar>();
  const commands = new Map<string, any>();

  return {
    cvars: {
      register: vi.fn((config) => {
        // Create a mock object that mimics Cvar structure but is mutable
        const cvar = {
          name: config.name,
          string: config.defaultValue || '',
          number: parseFloat(config.defaultValue || '0'),
          flags: config.flags || 0,
          modifiedCount: 0,
          description: config.description,
          onChange: config.onChange
        };
        cvars.set(config.name, cvar as unknown as Cvar);
        return cvar as unknown as Cvar;
      }),
      get: vi.fn((name) => cvars.get(name)),
      list: vi.fn(() => Array.from(cvars.values())),
      setValue: vi.fn((name, value, flags) => {
        const cvar = cvars.get(name) as any;
        if (cvar) {
          const previousValue = cvar.string;
          cvar.string = value;
          cvar.number = parseFloat(value);
          cvar.modifiedCount = (cvar.modifiedCount || 0) + 1;
          if (cvar.onChange) {
            cvar.onChange(cvar, previousValue);
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

export function createMockGameSimulation<FrameState = unknown>(overrides: Partial<GameSimulation<FrameState>> = {}): GameSimulation<FrameState> {
  return {
    init: vi.fn((startTimeMs) => ({ frame: 0, timeMs: startTimeMs } as GameFrameResult<FrameState>)),
    frame: vi.fn(({ frame, deltaMs }, command) => ({ frame, timeMs: deltaMs } as GameFrameResult<FrameState>)),
    shutdown: vi.fn(),
    ...overrides
  };
}

export function createMockClientRenderer<FrameState = unknown>(overrides: Partial<ClientRenderer<FrameState>> = {}): ClientRenderer<FrameState> {
  return {
    init: vi.fn(),
    render: vi.fn(),
    shutdown: vi.fn(),
    ...overrides
  };
}

export function createMockRuntimeClient<FrameState = unknown>(
  overrides: Partial<ClientRenderer<FrameState> & SubtitleClient> = {}
): ClientRenderer<FrameState> & SubtitleClient {
  return {
    ...createMockClientRenderer<FrameState>(overrides),
    ...createMockSubtitleClient(overrides),
    ...overrides
  } as ClientRenderer<FrameState> & SubtitleClient;
}

export function createMockEngineExports(overrides: Partial<EngineExports> = {}): EngineExports {
  return {
    init: vi.fn(),
    shutdown: vi.fn(),
    createMainLoop: vi.fn(),
    setAreaPortalState: vi.fn(),
    ...overrides
  } as unknown as EngineExports;
}
