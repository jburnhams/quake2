import { describe, it, expect } from 'vitest';
import { parseBspData, BspLump } from '../../../src/assets/bsp';

describe('BSP Area Parsing', () => {
  it('should parse areas correctly', () => {
    // Construct a minimal BSP buffer with just enough data for headers and areas
    // Header is 156 bytes (4 + 4 + 19*8)
    // We need lumps for Areas (17) and AreaPortals (18)

    // Areas: numAreaPortals (4), firstAreaPortal (4) -> 8 bytes per area.
    // Let's make 2 areas.
    const areaData = new Int32Array([
        2, 0, // Area 0: 2 portals, starting at 0
        1, 2  // Area 1: 1 portal, starting at 2
    ]);

    const areasOffset = 160; // Just after header (aligned)
    const areasLength = areaData.byteLength;

    // AreaPortals: portalnum (4), otherarea (4) -> 8 bytes per portal.
    // Let's make 3 portals.
    const portalData = new Int32Array([
        10, 1, // Portal 0: num 10, connects to area 1
        11, 2, // Portal 1: num 11, connects to area 2
        12, 0  // Portal 2: num 12, connects to area 0
    ]);

    const portalsOffset = areasOffset + areasLength;
    const portalsLength = portalData.byteLength;

    const totalSize = portalsOffset + portalsLength;
    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);

    // Magic and Version
    view.setUint8(0, 'I'.charCodeAt(0));
    view.setUint8(1, 'B'.charCodeAt(0));
    view.setUint8(2, 'S'.charCodeAt(0));
    view.setUint8(3, 'P'.charCodeAt(0));
    view.setInt32(4, 38, true); // Version 38

    // Set lump offsets and lengths
    // Lumps are at 8 + i*8
    const setLump = (lump: BspLump, offset: number, length: number) => {
        const lumpIdx = lump as number;
        view.setInt32(8 + lumpIdx * 8, offset, true);
        view.setInt32(12 + lumpIdx * 8, length, true);
    };

    // Initialize all lumps to 0 length to avoid parsing errors on required lumps
    for (let i = 0; i < 19; i++) {
        setLump(i, 0, 0);
    }

    // Set specific lumps we are testing
    setLump(BspLump.Areas, areasOffset, areasLength);
    setLump(BspLump.AreaPortals, portalsOffset, portalsLength);

    // Write data
    const uint8View = new Uint8Array(buffer);
    uint8View.set(new Uint8Array(areaData.buffer), areasOffset);
    uint8View.set(new Uint8Array(portalData.buffer), portalsOffset);

    // Parse
    const bsp = parseBspData(buffer);

    expect(bsp.areas).toBeDefined();
    expect(bsp.areas.length).toBe(2);

    expect(bsp.areas[0].numAreaPortals).toBe(2);
    expect(bsp.areas[0].firstAreaPortal).toBe(0);

    expect(bsp.areas[1].numAreaPortals).toBe(1);
    expect(bsp.areas[1].firstAreaPortal).toBe(2);

    expect(bsp.areaPortals).toBeDefined();
    expect(bsp.areaPortals.length).toBe(3);

    expect(bsp.areaPortals[0].portalNumber).toBe(10);
    expect(bsp.areaPortals[0].otherArea).toBe(1);

    expect(bsp.areaPortals[2].portalNumber).toBe(12);
    expect(bsp.areaPortals[2].otherArea).toBe(0);
  });
});
