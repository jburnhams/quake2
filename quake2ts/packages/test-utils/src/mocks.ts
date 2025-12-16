import { vi } from 'vitest';

export const createNetChanMock = () => ({
  message: {
    data: new Uint8Array(1024),
    cursize: 0,
    maxsize: 1024,
    allowoverflow: false,
  },
  src: { port: 1234, address: '127.0.0.1' },
  remoteAddress: '127.0.0.1',
  qport: 1234,
  incoming_sequence: 0,
  incoming_acknowledged: 0,
  outgoing_sequence: 0,
  reliable_sequence: 0,
  last_reliable_sequence: 0,
  reliable_length: 0,
  reliable_buf: new Uint8Array(1024),
  transmit: vi.fn(),
  process: vi.fn(),
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

export const createBinaryWriterMock = () => ({
  writeInt8: vi.fn(),
  writeUint8: vi.fn(),
  writeInt16: vi.fn(),
  writeUint16: vi.fn(),
  writeInt32: vi.fn(),
  writeUint32: vi.fn(),
  writeFloat: vi.fn(),
  writeString: vi.fn(),
  writeBytes: vi.fn(),
  getData: vi.fn(() => new Uint8Array(0)),
});
