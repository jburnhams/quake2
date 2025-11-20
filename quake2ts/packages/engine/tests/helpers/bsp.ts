import { BspLump } from '../../src/assets/bsp';

export function buildBsp(lumps: { [lump: number]: ArrayBuffer }): ArrayBuffer {
    const headerSize = 8 + 19 * 8;
    const lumpData = new Array(19).fill(0).map(() => new Uint8Array(0));
    let totalSize = headerSize;

    for (const lump in lumps) {
        const index = parseInt(lump, 10);
        const data = new Uint8Array(lumps[index]);
        lumpData[index] = data;
        totalSize += data.length;
    }

    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);

    view.setUint32(0, 0x50534249, true); // IBSP
    view.setUint32(4, 38, true); // version

    let offset = headerSize;
    for (let i = 0; i < 19; i++) {
        view.setUint32(8 + i * 8, offset, true);
        view.setUint32(12 + i * 8, lumpData[i].length, true);
        const dest = new Uint8Array(buffer, offset, lumpData[i].length);
        dest.set(lumpData[i]);
        offset += lumpData[i].length;
    }

    return buffer;
}
