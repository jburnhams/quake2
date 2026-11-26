import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createClient, ClientImports } from '@quake2ts/client/index.js';
import { EngineImports, Renderer, AssetManager, EngineHost } from '@quake2ts/engine';
import { ConfigStringIndex } from '@quake2ts/shared';
import { createMockLocalStorage } from '@quake2ts/test-utils';

describe('Client Integration Wiring', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMockLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should propagate config string updates to cgame and assets', async () => {
    // Mock AssetManager
    const assetManager = {
      loadMd2Model: vi.fn().mockResolvedValue({}),
      loadSprite: vi.fn().mockResolvedValue({}),
      loadMd3Model: vi.fn().mockResolvedValue({}),
      loadSound: vi.fn().mockResolvedValue({}),
      loadTexture: vi.fn().mockResolvedValue({}),
    } as unknown as AssetManager;

    // Mock Renderer
    const renderer = {
      registerTexture: vi.fn().mockReturnValue({ width: 0, height: 0 }),
      drawPic: vi.fn(),
      drawString: vi.fn(),
    } as unknown as Renderer;

    // Mock EngineImports
    const engineImports: EngineImports & { renderer: Renderer } = {
      assets: assetManager,
      renderer: renderer,
      audio: {} as any,
      trace: vi.fn(),
      pointcontents: vi.fn(),
    } as any;

    // Mock EngineHost
    const host: EngineHost = {
      cvars: {
        get: vi.fn(),
        list: vi.fn().mockReturnValue([]),
        register: vi.fn(),
        setValue: vi.fn(),
      },
      commands: {
        register: vi.fn(),
        execute: vi.fn(),
      },
    } as unknown as EngineHost;

    const imports: ClientImports = {
      engine: engineImports,
      host: host,
    };

    const client = createClient(imports);

    // Test Model Registration (CS_MODELS)
    const modelIndex = ConfigStringIndex.Models + 1;
    const modelName = 'models/test.md2';

    // Simulate network packet for config string
    client.demoHandler.onConfigString(modelIndex, modelName);

    // Verify client config strings updated
    expect(client.configStrings.getModelName(1)).toBe(modelName);

    // Verify internal handler state is also updated (regression check)
    expect(client.demoHandler.configstrings[modelIndex]).toBe(modelName);

    // Verify cgame called asset loader (via cgameBridge)
    expect(assetManager.loadMd2Model).toHaveBeenCalledWith(modelName);

    // Test Sound Registration (CS_SOUNDS)
    const soundIndex = ConfigStringIndex.Sounds + 2;
    const soundName = 'sound/test.wav';
    client.demoHandler.onConfigString(soundIndex, soundName);

    expect(client.configStrings.getSoundName(2)).toBe(soundName);
    expect(assetManager.loadSound).toHaveBeenCalledWith(soundName);

    // Test Image Registration (CS_IMAGES)
    const imageIndex = ConfigStringIndex.Images + 3;
    const imageName = 'pics/test.pcx';
    client.demoHandler.onConfigString(imageIndex, imageName);

    expect(client.configStrings.getImageName(3)).toBe(imageName);
    // Note: cgameBridge Draw_RegisterPic calls loadTexture
    // It's async, so we might need to wait, but the call itself initiates the promise.
    expect(assetManager.loadTexture).toHaveBeenCalledWith(imageName);
  });
});
