import { vi } from 'vitest';

export const createBinaryWriterMock = () => ({
  writeByte: vi.fn(),
  writeShort: vi.fn(),
  writeLong: vi.fn(),
  writeString: vi.fn(),
  writeBytes: vi.fn(),
  getBuffer: vi.fn(() => new Uint8Array(0)),
  reset: vi.fn(),
  // Legacy methods (if any)
  writeInt8: vi.fn(),
  writeUint8: vi.fn(),
  writeInt16: vi.fn(),
  writeUint16: vi.fn(),
  writeInt32: vi.fn(),
  writeUint32: vi.fn(),
  writeFloat: vi.fn(),
  getData: vi.fn(() => new Uint8Array(0)),
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
  getReliableData: vi.fn(() => new Uint8Array(0)),
  needsKeepalive: vi.fn(() => false),
  isTimedOut: vi.fn(() => false),
});

export const createBinaryStreamMock = () => ({
  getPosition: vi.fn(() => 0),
  getReadPosition: vi.fn(() => 0),
  getLength: vi.fn(() => 0),
  getRemaining: vi.fn(() => 0),
  seek: vi.fn(),
  setReadPosition: vi.fn(),
  hasMore: vi.fn(() => true),
  hasBytes: vi.fn(() => true),

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

  readData: vi.fn(() => new Uint8Array(0)),

  readPos: vi.fn(),
  readDir: vi.fn(),
});
