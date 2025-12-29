import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameSession, SessionOptions, createSession } from '@quake2ts/client';

const { mockClientInstance } = vi.hoisted(() => {
    return {
        mockClientInstance: {
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
        }
    };
});

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

vi.mock('@quake2ts/client', async (importOriginal) => {
    const actual = await importOriginal() as any;
    return {
        ...actual,
        createClient: vi.fn((imports) => {
            // Reset mock instance state if needed, or return the shared one
            // We'll reuse the properties but maybe reset mocks?
            // For now, return the hoisted object.
            return mockClientInstance;
        }),
    };
});

vi.mock('@quake2ts/engine', () => {
    return {
        EngineHost: vi.fn().mockImplementation(function() {
            return {
                start: vi.fn(),
                stop: vi.fn(),
                paused: true,
                commands: { execute: vi.fn() }
            };
        }),
        DemoRecorder: vi.fn(), DemoRecorder: vi.fn(), DemoPlaybackController: class {
            loadDemo = vi.fn();
            setHandler = vi.fn();
            update = vi.fn();
            stop = vi.fn();
            setSpeed = vi.fn();
            setFrameDuration = vi.fn();
            getCurrentTime = vi.fn();
            getDuration = vi.fn();
            getState = vi.fn();
            getSpeed = vi.fn();
            getPlaybackSpeed = vi.fn();
            getInterpolationFactor = vi.fn();
            play = vi.fn();
            pause = vi.fn();
            stepForward = vi.fn();
            stepBackward = vi.fn();
            seek = vi.fn();
            getCurrentFrame = vi.fn();
            getTotalFrames = vi.fn();
        },
        ClientRenderer: vi.fn(),
        createEmptyEntityState: vi.fn().mockReturnValue({ origin: {x:0,y:0,z:0} })
    };
});


describe('GameSession Integration Tests', () => {
  let session: GameSession;
  let mockEngine: any;

  beforeEach(() => {
    // Reset properties on mockClientInstance
    mockClientInstance.onCenterPrint = undefined;
    mockClientInstance.onNotify = undefined;
    mockClientInstance.onPickupMessage = undefined;
    mockClientInstance.onObituaryMessage = undefined;
    mockClientInstance.onMenuStateChange = undefined;
    vi.clearAllMocks();

    mockEngine = {
      trace: vi.fn(() => ({ fraction: 1, endpos: { x: 0, y: 0, z: 0 } })),
      cmd: { executeText: vi.fn() },
      renderer: {}
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
        // @ts-ignore
        mockClientInstance.onCenterPrint('Hello', 3);
        expect(handler).toHaveBeenCalledWith('Hello', 3);
      });

      it('should hook up onNotify event', () => {
        const handler = vi.fn();
        session.onNotify = handler;

        expect(mockClientInstance.onNotify).toBe(handler);
        // @ts-ignore
        mockClientInstance.onNotify('Notification');
        expect(handler).toHaveBeenCalledWith('Notification');
      });

      it('should hook up onPickupMessage event', () => {
        const handler = vi.fn();
        session.onPickupMessage = handler;

        expect(mockClientInstance.onPickupMessage).toBe(handler);
        // @ts-ignore
        mockClientInstance.onPickupMessage('Shotgun');
        expect(handler).toHaveBeenCalledWith('Shotgun');
      });

      it('should hook up onObituaryMessage event', () => {
        const handler = vi.fn();
        session.onObituaryMessage = handler;

        expect(mockClientInstance.onObituaryMessage).toBe(handler);
        // @ts-ignore
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
        // @ts-ignore
        mockClientInstance.isMenuActive.mockReturnValue(true);
        expect(session.isMenuActive()).toBe(true);
        expect(mockClientInstance.isMenuActive).toHaveBeenCalled();
      });

      it('should expose getMenuState', () => {
        const state = { activeMenu: {}, selectedIndex: 1 };
        // @ts-ignore
        mockClientInstance.getMenuState.mockReturnValue(state);
        expect(session.getMenuState()).toBe(state);
        expect(mockClientInstance.getMenuState).toHaveBeenCalled();
      });

      it('should hook up onMenuStateChange', () => {
          const handler = vi.fn();
          session.onMenuStateChange = handler;
          expect(mockClientInstance.onMenuStateChange).toBe(handler);

          // @ts-ignore
          mockClientInstance.onMenuStateChange(true);
          expect(handler).toHaveBeenCalledWith(true);
      });
  });
});
