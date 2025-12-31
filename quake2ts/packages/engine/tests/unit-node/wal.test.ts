import { describe, expect, it } from 'vitest';
import { parseWal, WalParseError } from '@quake2ts/engine/assets/wal.js';
import { buildWal } from '@quake2ts/test-utils'; // walBuilder.js';

describe('WAL loader', () => {
  it('parses mip chain and metadata', () => {
    const walBuffer = buildWal({ name: 'TEST', width: 4, height: 4 });
    const wal = parseWal(walBuffer);
    expect(wal.width).toBe(4);
    expect(wal.mipmaps).toHaveLength(4);
    expect(wal.mipmaps[1]?.data[0]).toBe(1);
  });

  it('validates offsets and dimensions', () => {
    const walBuffer = buildWal({ name: 'BAD', width: 4, height: 4 });
    const view = new DataView(walBuffer);
    view.setInt32(40, 9999, true);
    expect(() => parseWal(walBuffer)).toThrow(WalParseError);
  });
});
