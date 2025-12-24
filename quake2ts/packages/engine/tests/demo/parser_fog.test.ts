import { describe, it, expect, vi } from 'vitest';
import { NetworkMessageParser, NetworkMessageHandler } from '../../src/demo/parser.js';
import { BinaryStream } from '@quake2ts/shared';

describe('NetworkMessageParser - svc_fog', () => {
  it('should parse svc_fog command with basic bits', () => {
    // svc_fog format:
    // [byte] bits
    // [optional bytes based on bits]

    // Bits: 1 (DENSITY) | 2 (R) | 4 (G) | 8 (B) = 15.
    const bits = 1 | 2 | 4 | 8;
    const density = 0.5;
    const skyfactor = 128;
    const r = 255;
    const g = 128;
    const b = 64;

    const buffer = [
        27, // svc_fog
        bits,
        // DENSITY: float, byte
        0, 0, 0, 0, // float placeholder
        skyfactor,
        // R
        r,
        // G
        g,
        // B
        b
    ];

    const floatView = new DataView(new ArrayBuffer(4));
    floatView.setFloat32(0, density, true);
    buffer[2] = floatView.getUint8(0);
    buffer[3] = floatView.getUint8(1);
    buffer[4] = floatView.getUint8(2);
    buffer[5] = floatView.getUint8(3);

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
        onFog: vi.fn()
    };

    const parser = new NetworkMessageParser(stream, handler);
    parser.parseMessage();

    expect(handler.onFog).toHaveBeenCalledTimes(1);
    const fogData = (handler.onFog as any).mock.calls[0][0];

    expect(fogData.density).toBeCloseTo(0.5);
    expect(fogData.skyfactor).toBe(128);
    expect(fogData.red).toBe(255);
    expect(fogData.green).toBe(128);
    expect(fogData.blue).toBe(64);
  });
});
