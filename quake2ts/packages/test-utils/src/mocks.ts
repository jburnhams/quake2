import { vi } from 'vitest';

export const createBinaryWriterMock = () => ({
  writeByte: vi.fn(), // BinaryWriter uses writeByte, not writeInt8/writeUint8
  writeShort: vi.fn(),
  writeLong: vi.fn(),
  writeString: vi.fn(),
  writeBytes: vi.fn(),
  getBuffer: vi.fn(() => new Uint8Array(0)),
  reset: vi.fn(),
  // Keep some legacy ones if needed by tests, but BinaryWriter definition in NetChan suggests writeByte etc.
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
  readInt8: vi.fn(() => 0),
  readUint8: vi.fn(() => 0),
  readInt16: vi.fn(() => 0),
  readUint16: vi.fn(() => 0),
  readInt32: vi.fn(() => 0),
  readUint32: vi.fn(() => 0),
  readFloat: vi.fn(() => 0),
  readString: vi.fn(() => ''),
  readBytes: vi.fn(() => new Uint8Array(0)),
  seek: vi.fn(),
  tell: vi.fn(() => 0),
});
