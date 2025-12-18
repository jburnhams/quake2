import { vi, type Mock } from 'vitest';

export interface BinaryWriterMock {
    writeByte: Mock<[number], void>;
    writeShort: Mock<[number], void>;
    writeLong: Mock<[number], void>;
    writeString: Mock<[string], void>;
    writeBytes: Mock<[Uint8Array], void>;
    getBuffer: Mock<[], Uint8Array>;
    reset: Mock<[], void>;
    writeInt8: Mock<[number], void>;
    writeUint8: Mock<[number], void>;
    writeInt16: Mock<[number], void>;
    writeUint16: Mock<[number], void>;
    writeInt32: Mock<[number], void>;
    writeUint32: Mock<[number], void>;
    writeFloat: Mock<[number], void>;
    getData: Mock<[], Uint8Array>;
}

export const createBinaryWriterMock = (): BinaryWriterMock => ({
  writeByte: vi.fn(),
  writeShort: vi.fn(),
  writeLong: vi.fn(),
  writeString: vi.fn(),
  writeBytes: vi.fn(),
  getBuffer: vi.fn<[], Uint8Array>(() => new Uint8Array(0)),
  reset: vi.fn(),
  // Legacy methods (if any)
  writeInt8: vi.fn(),
  writeUint8: vi.fn(),
  writeInt16: vi.fn(),
  writeUint16: vi.fn(),
  writeInt32: vi.fn(),
  writeUint32: vi.fn(),
  writeFloat: vi.fn(),
  getData: vi.fn<[], Uint8Array>(() => new Uint8Array(0)),
});

export const createNetChanMock = () => ({
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
  getReliableData: vi.fn<[], Uint8Array>(() => new Uint8Array(0)),
  needsKeepalive: vi.fn(() => false),
  isTimedOut: vi.fn(() => false),
});

export interface BinaryStreamMock {
    getPosition: Mock<[], number>;
    getReadPosition: Mock<[], number>;
    getLength: Mock<[], number>;
    getRemaining: Mock<[], number>;
    seek: Mock<[number], void>;
    setReadPosition: Mock<[number], void>;
    hasMore: Mock<[], boolean>;
    hasBytes: Mock<[number], boolean>;

    readChar: Mock<[], number>;
    readByte: Mock<[], number>;
    readShort: Mock<[], number>;
    readUShort: Mock<[], number>;
    readLong: Mock<[], number>;
    readULong: Mock<[], number>;
    readFloat: Mock<[], number>;

    readString: Mock<[], string>;
    readStringLine: Mock<[], string>;

    readCoord: Mock<[], number>;
    readAngle: Mock<[], number>;
    readAngle16: Mock<[], number>;

    readData: Mock<[number], Uint8Array>;

    readPos: Mock<[], any>; // Use proper type if available, e.g., Vec3
    readDir: Mock<[], any>;
}

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

  readData: vi.fn<[number], Uint8Array>((length: number) => new Uint8Array(length)),

  readPos: vi.fn(),
  readDir: vi.fn(),
});
