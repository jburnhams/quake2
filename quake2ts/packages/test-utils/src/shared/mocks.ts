import { vi } from 'vitest';
import { LegacyMock, legacyFn } from '../vitest-compat.js';

/**
 * Interface for the BinaryWriter mock.
 */
export interface BinaryWriterMock {
    writeByte: LegacyMock<[number], void>;
    writeShort: LegacyMock<[number], void>;
    writeLong: LegacyMock<[number], void>;
    writeString: LegacyMock<[string], void>;
    writeBytes: LegacyMock<[Uint8Array], void>;
    getBuffer: LegacyMock<[], Uint8Array>;
    reset: LegacyMock<[], void>;
    writeInt8: LegacyMock<[number], void>;
    writeUint8: LegacyMock<[number], void>;
    writeInt16: LegacyMock<[number], void>;
    writeUint16: LegacyMock<[number], void>;
    writeInt32: LegacyMock<[number], void>;
    writeUint32: LegacyMock<[number], void>;
    writeFloat: LegacyMock<[number], void>;
    getData: LegacyMock<[], Uint8Array>;
    writePos: LegacyMock<[any], void>;
    writeDir: LegacyMock<[any], void>;
}

/**
 * Creates a mock BinaryWriter for testing binary data writing.
 *
 * @returns A BinaryWriterMock object with all methods mocked using vi.fn().
 */
export const createBinaryWriterMock = (): BinaryWriterMock => ({
  writeByte: vi.fn(),
  writeShort: vi.fn(),
  writeLong: vi.fn(),
  writeString: vi.fn(),
  writeBytes: vi.fn(),
  getBuffer: legacyFn<[], Uint8Array>(() => new Uint8Array(0)),
  reset: vi.fn(),
  // Legacy methods (if any)
  writeInt8: vi.fn(),
  writeUint8: vi.fn(),
  writeInt16: vi.fn(),
  writeUint16: vi.fn(),
  writeInt32: vi.fn(),
  writeUint32: vi.fn(),
  writeFloat: vi.fn(),
  getData: legacyFn<[], Uint8Array>(() => new Uint8Array(0)),
  writePos: vi.fn(),
  writeDir: vi.fn(),
});

export interface NetChanMock {
  qport: number;
  incomingSequence: number;
  outgoingSequence: number;
  incomingAcknowledged: number;
  incomingReliableAcknowledged: boolean;
  incomingReliableSequence: number;
  outgoingReliableSequence: number;
  reliableMessage: BinaryWriterMock;
  reliableLength: number;
  fragmentSendOffset: number;
  fragmentBuffer: any;
  fragmentLength: number;
  fragmentReceived: number;
  lastReceived: number;
  lastSent: number;
  remoteAddress: { type: string, port: number };
  setup: LegacyMock;
  reset: LegacyMock;
  transmit: LegacyMock;
  process: LegacyMock;
  canSendReliable: LegacyMock<[], boolean>;
  writeReliableByte: LegacyMock;
  writeReliableShort: LegacyMock;
  writeReliableLong: LegacyMock;
  writeReliableString: LegacyMock;
  getReliableData: LegacyMock<[], Uint8Array>;
  needsKeepalive: LegacyMock<[], boolean>;
  isTimedOut: LegacyMock<[], boolean>;
}

/**
 * Creates a mock NetChan (Network Channel) for testing network communication.
 * Includes mocks for sequencing, reliable messaging, and fragmentation.
 *
 * @returns A mocked NetChan object.
 */
export const createNetChanMock = (): NetChanMock => ({
  qport: 1234,

  // Sequencing
  incomingSequence: 0,
  outgoingSequence: 0,
  incomingAcknowledged: 0,

  // Reliable messaging
  incomingReliableAcknowledged: false,
  incomingReliableSequence: 0,
  outgoingReliableSequence: 0,
  reliableMessage: createBinaryWriterMock(),
  reliableLength: 0,

  // Fragmentation
  fragmentSendOffset: 0,
  fragmentBuffer: null,
  fragmentLength: 0,
  fragmentReceived: 0,

  // Timing
  lastReceived: 0,
  lastSent: 0,

  remoteAddress: { type: 'IP', port: 1234 },

  // Methods
  setup: vi.fn(),
  reset: vi.fn(),
  transmit: vi.fn(),
  process: vi.fn(),
  canSendReliable: vi.fn(() => true),
  writeReliableByte: vi.fn(),
  writeReliableShort: vi.fn(),
  writeReliableLong: vi.fn(),
  writeReliableString: vi.fn(),
  getReliableData: legacyFn<[], Uint8Array>(() => new Uint8Array(0)),
  needsKeepalive: vi.fn(() => false),
  isTimedOut: vi.fn(() => false),
});

/**
 * Interface for the BinaryStream mock.
 */
export interface BinaryStreamMock {
    getPosition: LegacyMock<[], number>;
    getReadPosition: LegacyMock<[], number>;
    getLength: LegacyMock<[], number>;
    getRemaining: LegacyMock<[], number>;
    seek: LegacyMock<[number], void>;
    setReadPosition: LegacyMock<[number], void>;
    hasMore: LegacyMock<[], boolean>;
    hasBytes: LegacyMock<[number], boolean>;

    readChar: LegacyMock<[], number>;
    readByte: LegacyMock<[], number>;
    readShort: LegacyMock<[], number>;
    readUShort: LegacyMock<[], number>;
    readLong: LegacyMock<[], number>;
    readULong: LegacyMock<[], number>;
    readFloat: LegacyMock<[], number>;

    readString: LegacyMock<[], string>;
    readStringLine: LegacyMock<[], string>;

    readCoord: LegacyMock<[], number>;
    readAngle: LegacyMock<[], number>;
    readAngle16: LegacyMock<[], number>;

    readData: LegacyMock<[number], Uint8Array>;

    readPos: LegacyMock<[], any>; // Use proper type if available, e.g., Vec3
    readDir: LegacyMock<[], any>;
}

/**
 * Creates a mock BinaryStream for testing binary data reading.
 *
 * @returns A BinaryStreamMock object with all methods mocked.
 */
export const createBinaryStreamMock = (): BinaryStreamMock => ({
  getPosition: vi.fn(() => 0),
  getReadPosition: vi.fn(() => 0),
  getLength: vi.fn(() => 0),
  getRemaining: vi.fn(() => 0),
  seek: vi.fn(),
  setReadPosition: vi.fn(),
  hasMore: vi.fn(() => true),
  hasBytes: vi.fn((amount: number) => true),

  readChar: vi.fn(() => 0),
  readByte: vi.fn(() => 0),
  readShort: vi.fn(() => 0),
  readUShort: vi.fn(() => 0),
  readLong: vi.fn(() => 0),
  readULong: vi.fn(() => 0),
  readFloat: vi.fn(() => 0),

  readString: vi.fn(() => ''),
  readStringLine: vi.fn(() => ''),

  readCoord: vi.fn(() => 0),
  readAngle: vi.fn(() => 0),
  readAngle16: vi.fn(() => 0),

  readData: legacyFn<[number], Uint8Array>((length: number) => new Uint8Array(length)),

  readPos: vi.fn(),
  readDir: vi.fn(),
});

/**
 * Interface for MessageWriter mock, extending BinaryWriterMock with additional message-specific methods.
 */
export interface MessageWriterMock extends BinaryWriterMock {
    writeInt: LegacyMock<[number], void>;
    writeVector: LegacyMock<[any], void>;
}

/**
 * Creates a mock MessageWriter, aliasing writeInt to writeInt32 and writeVector to writePos.
 *
 * @param overrides - Optional overrides for the mock.
 * @returns A MessageWriterMock object.
 */
export const createMessageWriterMock = (overrides?: Partial<MessageWriterMock>): MessageWriterMock => {
    const mock = createBinaryWriterMock();
    const writer: MessageWriterMock = {
        ...mock,
        writeInt: mock.writeInt32, // Alias writeInt to writeInt32
        writeVector: mock.writePos, // Alias writeVector to writePos
        ...overrides
    };
    return writer;
};

/**
 * Interface for MessageReader mock, extending BinaryStreamMock with additional message-specific methods.
 */
export interface MessageReaderMock extends BinaryStreamMock {
    readInt: LegacyMock<[], number>;
    readVector: LegacyMock<[], any>;
}

/**
 * Creates a mock MessageReader, aliasing readInt to readLong and readVector to readPos.
 *
 * @param data - Optional initial data for the reader.
 * @returns A MessageReaderMock object.
 */
export const createMessageReaderMock = (data?: Uint8Array): MessageReaderMock => {
    const mock = createBinaryStreamMock();
    const reader: MessageReaderMock = {
        ...mock,
        readInt: mock.readLong, // Alias readInt to readLong (int32)
        readVector: mock.readPos, // Alias readVector to readPos
    };
    return reader;
};

/**
 * Interface for a generic network packet mock.
 */
export interface PacketMock {
    type: 'connection' | 'data' | 'ack' | 'disconnect';
    sequence: number;
    ack: number;
    qport: number;
    data: Uint8Array;
}

/**
 * Creates a mock network packet.
 *
 * @param overrides - Optional overrides for packet properties.
 * @returns A PacketMock object.
 */
export const createPacketMock = (overrides?: Partial<PacketMock>): PacketMock => ({
    type: 'data',
    sequence: 0,
    ack: 0,
    qport: 0,
    data: new Uint8Array(0),
    ...overrides
});
