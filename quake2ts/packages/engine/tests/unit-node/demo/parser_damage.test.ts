import { describe, it, expect, vi } from 'vitest';
import { NetworkMessageParser, NetworkMessageHandler, PROTOCOL_VERSION_RERELEASE } from '../../../src/demo/parser.js';
import { BinaryStream } from '@quake2ts/shared';

describe('NetworkMessageParser - svc_damage', () => {
  it('should parse svc_damage command', () => {
    // svc_damage format:
    // [byte] count
    // For each count:
    //   [byte] encoded (damage, flags)
    //   [byte] dir (encoded vector)

    const damageCount = 2;
    // Damage 1: val 10, no flags.
    // Encoded: 10 & 0x1F = 10. Flags = 0.
    const encoded1 = 10;
    // Dir 1: 0 (default/up)
    const dir1 = 0;

    // Damage 2: val 5, all flags.
    // Encoded: 5 | 0x20 | 0x40 | 0x80 = 5 | 224 = 229.
    const encoded2 = 5 | 0x20 | 0x40 | 0x80;
    // Dir 2: 2 (different dir)
    const dir2 = 2;

    const buffer = [
        25, // svc_damage
        damageCount,
        encoded1, dir1,
        encoded2, dir2
    ];

    const stream = new BinaryStream(new Uint8Array(buffer).buffer);
    const handler: NetworkMessageHandler = {
        onServerData: vi.fn(),
        onConfigString: vi.fn(),
        onSpawnBaseline: vi.fn(),
        onFrame: vi.fn(),
        onCenterPrint: vi.fn(),
        onStuffText: vi.fn(),
        onPrint: vi.fn(),
        onSound: vi.fn(),
        onTempEntity: vi.fn(),
        onLayout: vi.fn(),
        onInventory: vi.fn(),
        onMuzzleFlash: vi.fn(),
        onMuzzleFlash2: vi.fn(),
        onDisconnect: vi.fn(),
        onReconnect: vi.fn(),
        onDownload: vi.fn(),
        onDamage: vi.fn()
    };

    const parser = new NetworkMessageParser(stream, handler);
    parser.setProtocolVersion(PROTOCOL_VERSION_RERELEASE);
    parser.parseMessage();

    expect(handler.onDamage).toHaveBeenCalledTimes(1);
    const indicators = (handler.onDamage as any).mock.calls[0][0];
    expect(indicators).toHaveLength(2);

    expect(indicators[0].damage).toBe(10);
    expect(indicators[0].health).toBe(false);
    expect(indicators[0].armor).toBe(false);
    expect(indicators[0].power).toBe(false);

    expect(indicators[1].damage).toBe(5);
    expect(indicators[1].health).toBe(true);
    expect(indicators[1].armor).toBe(true);
    expect(indicators[1].power).toBe(true);
  });
});
