
import {
  ServerCommand,
  ClientCommand,
  Vec3
} from '@quake2ts/shared';
import {
  EntityState,
  FrameData,
  ProtocolPlayerState,
  createEmptyEntityState,
  createEmptyProtocolPlayerState,
  DamageIndicator,
  FogData
} from '@quake2ts/engine';

/**
 * Mocks a server message by just providing the type and data buffer.
 * In a real scenario, this would be constructing a binary packet.
 */
export interface MockServerMessage {
  type: number;
  data: Uint8Array;
}

export function createMockServerMessage(type: number, data: Uint8Array = new Uint8Array()): MockServerMessage {
  return { type, data };
}

/**
 * Creates a mock Snapshot (FrameData) for testing.
 */
export function createMockSnapshot(
    serverFrame: number,
    entities: EntityState[] = [],
    playerState?: Partial<ProtocolPlayerState>,
    deltaFrame: number = 0
): FrameData {
    return {
        serverFrame,
        deltaFrame,
        surpressCount: 0,
        areaBytes: 0,
        areaBits: new Uint8Array(),
        playerState: {
            ...createEmptyProtocolPlayerState(),
            ...playerState
        },
        packetEntities: {
            delta: false,
            entities
        }
    };
}

/**
 * Creates a mock Delta Frame (FrameData with delta flag).
 */
export function createMockDeltaFrame(
    serverFrame: number,
    deltaFrame: number,
    entities: EntityState[] = [],
    playerState?: Partial<ProtocolPlayerState>
): FrameData {
    return {
        serverFrame,
        deltaFrame,
        surpressCount: 0,
        areaBytes: 0,
        areaBits: new Uint8Array(),
        playerState: {
            ...createEmptyProtocolPlayerState(),
            ...playerState
        },
        packetEntities: {
            delta: true,
            entities
        }
    };
}

/**
 * Simulates network delay for a sequence of messages.
 */
export function simulateNetworkDelay<T>(messages: T[], delayMs: number): Promise<T[]> {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(messages);
        }, delayMs);
    });
}

/**
 * Simulates packet loss by randomly filtering messages.
 * @param messages The messages to process
 * @param lossPercent Percentage of packet loss (0-100)
 */
export function simulatePacketLoss<T>(messages: T[], lossPercent: number): T[] {
    return messages.filter(() => Math.random() * 100 >= lossPercent);
}

/**
 * Factory for creating a mock EntityState.
 */
export function createMockEntityState(
    number: number,
    modelIndex: number = 0,
    origin: Partial<Vec3> = { x: 0, y: 0, z: 0 },
    overrides?: Partial<EntityState>
): EntityState {
    const state = createEmptyEntityState();
    const mutableState = state as any;
    mutableState.number = number;
    mutableState.modelIndex = modelIndex;
    mutableState.origin.x = origin.x ?? 0;
    mutableState.origin.y = origin.y ?? 0;
    mutableState.origin.z = origin.z ?? 0;

    if (overrides) {
        Object.assign(mutableState, overrides);
    }
    return state;
}

export function createMockDamageIndicator(
  damage: number,
  dir: Vec3 = { x: 0, y: 0, z: 0 },
  health = true,
  armor = false,
  power = false
): DamageIndicator {
  return {
    damage,
    dir,
    health,
    armor,
    power
  };
}

export function createMockFogData(overrides: Partial<FogData> = {}): FogData {
    return {
        density: 0.1,
        red: 100,
        green: 100,
        blue: 100,
        ...overrides
    };
}
