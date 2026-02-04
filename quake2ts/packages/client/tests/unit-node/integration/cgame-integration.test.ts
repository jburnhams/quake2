import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient, ClientImports, ClientExports } from '@quake2ts/client/index.js';
import { ClientConfigStrings } from '@quake2ts/client/configStrings.js';
import { EngineImports, EngineHost, Renderer } from '@quake2ts/engine';
import { AssetManager } from '@quake2ts/engine';
import { createMockRenderer, createMockAssetManager } from '@quake2ts/test-utils';

// Mock CGame
vi.mock('@quake2ts/cgame', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    GetCGameAPI: vi.fn(() => ({
      Init: vi.fn(),
      Shutdown: vi.fn(),
      DrawHUD: vi.fn(),
      TouchPics: vi.fn(),
      LayoutFlags: vi.fn(),
      GetActiveWeaponWheelWeapon: vi.fn(),
      GetOwnedWeaponWheelWeapons: vi.fn(),
      GetWeaponWheelAmmoCount: vi.fn(),
      GetPowerupWheelCount: vi.fn(),
      GetHitMarkerDamage: vi.fn(),
      Pmove: vi.fn(),
      ParseConfigString: vi.fn(),
      ParseCenterPrint: vi.fn(),
      NotifyMessage: vi.fn(),
      ClearNotify: vi.fn(),
      ClearCenterprint: vi.fn(),
      GetMonsterFlashOffset: vi.fn(),
      GetExtension: vi.fn(),
    })),
  };
});

import { GetCGameAPI } from '@quake2ts/cgame';

describe('Client <-> CGame Integration', () => {
  let mockEngine: EngineImports & { renderer: Renderer };
  let mockHost: EngineHost;
  let client: ClientExports;

  beforeEach(() => {
    vi.clearAllMocks();

    global.localStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    };

    const mockRenderer = createMockRenderer({
      width: 800,
      height: 600,
      registerPic: vi.fn().mockResolvedValue({ width: 32, height: 32 }),
      registerTexture: vi.fn().mockReturnValue({ width: 32, height: 32 }),
    });

    const mockAssets = createMockAssetManager({
        loadSound: vi.fn().mockResolvedValue({}),
        loadTexture: vi.fn().mockResolvedValue({}),
        loadMd2Model: vi.fn().mockResolvedValue({}),
        loadMd3Model: vi.fn().mockResolvedValue({}),
        loadSprite: vi.fn().mockResolvedValue({}),
        listFiles: vi.fn().mockReturnValue([]),
    });

    mockEngine = {
      renderer: mockRenderer,
      assets: mockAssets,
      trace: vi.fn(),
      config: {},
      time: 0,
      realtime: 0,
      print: vi.fn(),
      error: vi.fn(),
    } as unknown as EngineImports & { renderer: Renderer };

    mockHost = {
      commands: { register: vi.fn(), execute: vi.fn() },
      cvars: { register: vi.fn(), get: vi.fn(), setValue: vi.fn(), list: vi.fn().mockReturnValue([]) },
    } as unknown as EngineHost;

    const imports: ClientImports = {
      engine: mockEngine,
      host: mockHost,
    };

    client = createClient(imports);
  });

  it('should initialize CGame on client init', () => {
    client.Init();
    const cgameExport = (GetCGameAPI as any).mock.results[0].value;
    expect(cgameExport.Init).toHaveBeenCalled();
  });

  it('should shutdown CGame on client shutdown', () => {
    client.Init();
    client.Shutdown();
    const cgameExport = (GetCGameAPI as any).mock.results[0].value;
    expect(cgameExport.Shutdown).toHaveBeenCalled();
  });

  it('should pass cgame_import_t to GetCGameAPI', () => {
    expect(GetCGameAPI).toHaveBeenCalled();
    const imports = (GetCGameAPI as any).mock.calls[0][0];

    // Verify some import methods exist
    expect(typeof imports.Com_Print).toBe('function');
    expect(typeof imports.CL_ClientTime).toBe('function');
    expect(imports.tick_rate).toBe(10);
  });
});
