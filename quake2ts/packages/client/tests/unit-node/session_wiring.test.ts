import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameSession, SessionOptions, createSession } from '@quake2ts/client/session.js';
import { ClientExports, createClient } from '@quake2ts/client/index.js';
import { EngineHost } from '@quake2ts/engine';

// Mocks
vi.mock('@quake2ts/game', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    createGame: vi.fn(() => ({
      spawnWorld: vi.fn(),
      time: 123.45,
      deathmatch: false,
      skill: 2,
      coop: false,
      entities: {
        level: {
          mapname: 'base1'
        }
      } as any,
      loadSave: vi.fn()
    })),
  };
});

let mockClientInstance: any;

vi.mock('@quake2ts/client/index.js', async (importOriginal) => {
    const actual = await importOriginal() as any;
    return {
        ...actual,
        createClient: vi.fn((imports) => {
             mockClientInstance = {
                init: vi.fn(),
                render: vi.fn(),
                shutdown: vi.fn(),
                ParseCenterPrint: vi.fn(),
                ParseConfigString: vi.fn(),
                ParseNotify: vi.fn(),
                lastRendered: {},
                onCenterPrint: undefined,
                onNotify: undefined,
                onPickupMessage: undefined,
                onObituaryMessage: undefined,
                onMenuStateChange: undefined,
                showPauseMenu: vi.fn(),
                hidePauseMenu: vi.fn(),
                isMenuActive: vi.fn(() => false),
                getMenuState: vi.fn(() => ({ activeMenu: null, selectedIndex: 0 }))
            };
            return mockClientInstance;
        }),
    };
});

// Mock EngineHost manually to ensure instance methods exist
vi.mock('@quake2ts/engine', async (importOriginal) => {
    const actual = await importOriginal() as any;
    return {
        ...actual,
        EngineHost: class {
            start = vi.fn();
            stop = vi.fn();
            paused = true;
            commands = { execute: vi.fn(), registerAutocompleteProvider: vi.fn() };
            constructor() {}
        }
    };
});

describe('GameSession Integration Tests', () => {
  let session: GameSession;
  let mockEngine: any;

  beforeEach(() => {
    mockEngine = {
      trace: vi.fn(() => ({ fraction: 1, endpos: { x: 0, y: 0, z: 0 } })),
      cmd: { executeText: vi.fn() },
      renderer: {},
      start: vi.fn(),
      stop: vi.fn()
    };

    const options: SessionOptions = {
      mapName: 'base1',
      skill: 2,
      engine: mockEngine
    };

    session = createSession(options);
    session.startNewGame('base1', 2);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Message Events', () => {
      it('should hook up onCenterPrint event', () => {
        const handler = vi.fn();
        session.onCenterPrint = handler;

        expect(mockClientInstance.onCenterPrint).toBe(handler);
        mockClientInstance.onCenterPrint('Hello', 3);
        expect(handler).toHaveBeenCalledWith('Hello', 3);
      });

      it('should hook up onNotify event', () => {
        const handler = vi.fn();
        session.onNotify = handler;

        expect(mockClientInstance.onNotify).toBe(handler);
        mockClientInstance.onNotify('Notification');
        expect(handler).toHaveBeenCalledWith('Notification');
      });

      it('should hook up onPickupMessage event', () => {
        const handler = vi.fn();
        session.onPickupMessage = handler;

        expect(mockClientInstance.onPickupMessage).toBe(handler);
        mockClientInstance.onPickupMessage('Shotgun');
        expect(handler).toHaveBeenCalledWith('Shotgun');
      });

      it('should hook up onObituaryMessage event', () => {
        const handler = vi.fn();
        session.onObituaryMessage = handler;

        expect(mockClientInstance.onObituaryMessage).toBe(handler);
        mockClientInstance.onObituaryMessage('Player died');
        expect(handler).toHaveBeenCalledWith('Player died');
      });
  });

  describe('Menu API', () => {
      it('should expose showPauseMenu', () => {
        session.showPauseMenu();
        expect(mockClientInstance.showPauseMenu).toHaveBeenCalled();
      });

      it('should expose hidePauseMenu', () => {
        session.hidePauseMenu();
        expect(mockClientInstance.hidePauseMenu).toHaveBeenCalled();
      });

      it('should expose isMenuActive', () => {
        mockClientInstance.isMenuActive.mockReturnValue(true);
        expect(session.isMenuActive()).toBe(true);
        expect(mockClientInstance.isMenuActive).toHaveBeenCalled();
      });

      it('should expose getMenuState', () => {
        const state = { activeMenu: {}, selectedIndex: 1 };
        mockClientInstance.getMenuState.mockReturnValue(state);
        expect(session.getMenuState()).toBe(state);
        expect(mockClientInstance.getMenuState).toHaveBeenCalled();
      });

      it('should hook up onMenuStateChange', () => {
          const handler = vi.fn();
          session.onMenuStateChange = handler;
          expect(mockClientInstance.onMenuStateChange).toBe(handler);

          mockClientInstance.onMenuStateChange(true);
          expect(handler).toHaveBeenCalledWith(true);
      });
  });
});
