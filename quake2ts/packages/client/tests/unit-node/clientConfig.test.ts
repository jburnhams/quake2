import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient, ClientExports, ClientImports } from '@quake2ts/client/index.js';
import { ConfigStringIndex } from '@quake2ts/shared';
import { Renderer, EngineImports } from '@quake2ts/engine';
import { createMockRenderer, createMockAssetManager, createMockTexture } from '@quake2ts/test-utils';

// Mock dependencies
const mockAssets = createMockAssetManager();

const mockRenderer = createMockRenderer();

const mockTrace = vi.fn().mockReturnValue({
  fraction: 1,
  endpos: { x: 0, y: 0, z: 0 },
  plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 },
  ent: -1
});

const mockEngine: EngineImports & { renderer: Renderer } = {
  assets: mockAssets,
  renderer: mockRenderer,
  trace: mockTrace,
} as any;

describe('Client ConfigString Parsing', () => {
  let client: ClientExports;

  beforeEach(() => {
    vi.clearAllMocks();
    client = createClient({ engine: mockEngine } as ClientImports);
  });

  it('should parse generic config strings', () => {
    client.ParseConfigString(ConfigStringIndex.Name, 'My Level');
    expect(client.configStrings.get(ConfigStringIndex.Name)).toBe('My Level');
  });

  it('should precache MD2 models', () => {
    const index = ConfigStringIndex.Models + 1;
    const modelPath = 'models/weapons/v_rocket/tris.md2';
    client.ParseConfigString(index, modelPath);

    expect(client.configStrings.getModelName(1)).toBe(modelPath);
    expect(mockAssets.loadMd2Model).toHaveBeenCalledWith(modelPath);
  });

  it('should precache MD3 models', () => {
    const index = ConfigStringIndex.Models + 2;
    const modelPath = 'models/mapobjects/test.md3';
    client.ParseConfigString(index, modelPath);

    expect(client.configStrings.getModelName(2)).toBe(modelPath);
    expect(mockAssets.loadMd3Model).toHaveBeenCalledWith(modelPath);
  });

  it('should precache sprites', () => {
    const index = ConfigStringIndex.Models + 3;
    const spritePath = 'sprites/explosion.sp2';
    client.ParseConfigString(index, spritePath);

    expect(client.configStrings.getModelName(3)).toBe(spritePath);
    expect(mockAssets.loadSprite).toHaveBeenCalledWith(spritePath);
  });

  it('should precache sounds', () => {
    const index = ConfigStringIndex.Sounds + 10;
    const soundPath = 'weapons/fire.wav';
    client.ParseConfigString(index, soundPath);

    expect(client.configStrings.getSoundName(10)).toBe(soundPath);
    expect(mockAssets.loadSound).toHaveBeenCalledWith(soundPath);
  });

  it('should precache images and register them', async () => {
    const index = ConfigStringIndex.Images + 5;
    const imagePath = 'pics/hud/test.pcx';
    const mockTexture = createMockTexture(10, 10);
    (mockAssets.loadTexture as any).mockResolvedValue(mockTexture);

    client.ParseConfigString(index, imagePath);

    expect(client.configStrings.getImageName(5)).toBe(imagePath);
    expect(mockAssets.loadTexture).toHaveBeenCalledWith(imagePath);

    // Wait for promise to resolve
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockRenderer.registerTexture).toHaveBeenCalledWith(imagePath, mockTexture);
  });
});
