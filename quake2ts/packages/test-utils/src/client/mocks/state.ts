import { EntityState, PmoveTraceResult, Vec3 } from '@quake2ts/shared';

// Mock ConfigStringIndex to match shared
enum ConfigStringIndex {
  Models = 32,
  Sounds = 288,
  Images = 544,
  Players = 544 + 256, // Base for players, usually logic handles offset
}

const MAX_MODELS = 256;
const MAX_SOUNDS = 256;
const MAX_IMAGES = 256;

// Minimal ClientConfigStrings implementation for testing
export class MockClientConfigStrings {
  private readonly strings: Map<number, string> = new Map();
  private readonly models: string[] = [];
  private readonly sounds: string[] = [];
  private readonly images: string[] = [];

  constructor() {}

  public set(index: number, value: string): void {
    this.strings.set(index, value);

    if (index >= ConfigStringIndex.Models && index < ConfigStringIndex.Models + MAX_MODELS) {
      this.models[index - ConfigStringIndex.Models] = value;
    } else if (index >= ConfigStringIndex.Sounds && index < ConfigStringIndex.Sounds + MAX_SOUNDS) {
      this.sounds[index - ConfigStringIndex.Sounds] = value;
    } else if (index >= ConfigStringIndex.Images && index < ConfigStringIndex.Images + MAX_IMAGES) {
      this.images[index - ConfigStringIndex.Images] = value;
    }
  }

  public get(index: number): string | undefined {
    return this.strings.get(index);
  }

  public getModelName(index: number): string | undefined {
    return this.models[index];
  }

  public getSoundName(index: number): string | undefined {
    return this.sounds[index];
  }

  public getImageName(index: number): string | undefined {
    return this.images[index];
  }

  public getPlayerName(playernum: number): string | undefined {
     // Stub logic
     const info = this.strings.get(ConfigStringIndex.Players + playernum);
     if (!info) return undefined;
     const parts = info.split('\\');
    for (let i = 1; i < parts.length; i += 2) {
      if (parts[i] === 'name') {
        return parts[i + 1];
      }
    }
    return undefined;
  }

  public clear(): void {
    this.strings.clear();
    this.models.length = 0;
    this.sounds.length = 0;
    this.images.length = 0;
  }
}

// Define ClientState interface locally as it's not exported from client
export interface ClientStateProvider {
  tickRate: number;
  frameTimeMs: number;
  serverFrame: number;
  serverProtocol: number;
  configStrings: MockClientConfigStrings;
  getClientName(num: number): string;
  getKeyBinding(key: string): string;
  inAutoDemo: boolean;
}

export interface ClientInfo {
  name: string;
  skin: string;
  model: string;
  icon: string;
}

export interface ClientState extends ClientStateProvider {
  playerNum: number;
  serverTime: number;
  parseEntities: number;
}

export interface Frame {
  serverFrame: number;
  deltaFrame: number;
  valid: boolean;
  entities: EntityState[];
}

export interface ConnectionState {
  state: 'disconnected' | 'connecting' | 'connected' | 'active';
}

// -- Factories --

export const createMockClientState = (overrides?: Partial<ClientState>): ClientState => {
  const configStrings = new MockClientConfigStrings();

  return {
    tickRate: 10,
    frameTimeMs: 100,
    serverFrame: 0,
    serverProtocol: 34,
    configStrings,
    playerNum: 0,
    serverTime: 0,
    parseEntities: 0,
    inAutoDemo: false,
    getClientName: (num: number) => `Player${num}`,
    getKeyBinding: (key: string) => '',
    ...overrides
  };
};

export const createMockFrame = (overrides?: Partial<Frame>): Frame => ({
  serverFrame: 0,
  deltaFrame: -1,
  valid: true,
  entities: [],
  ...overrides
});

export const createMockClientInfo = (overrides?: Partial<ClientInfo>): ClientInfo => ({
  name: 'Player',
  skin: 'male/grunt',
  model: 'male',
  icon: 'pics/icon.pcx',
  ...overrides
});

export const createMockConnectionState = (state: ConnectionState['state'] = 'connected'): ConnectionState => ({
  state
});
