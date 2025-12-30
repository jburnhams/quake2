export interface PakEntrySpec {
  path: string;
  data: Uint8Array;
}

const HEADER_SIZE = 12;
const DIRECTORY_ENTRY_SIZE = 64;

export function buildPak(entries: PakEntrySpec[]): ArrayBuffer {
  let offset = HEADER_SIZE;
  const fileBuffers: Uint8Array[] = [];
  const directory = new Uint8Array(entries.length * DIRECTORY_ENTRY_SIZE);
  const dirView = new DataView(directory.buffer);

  entries.forEach((entry, index) => {
    const data = entry.data;
    fileBuffers.push(data);

    const nameBytes = new TextEncoder().encode(entry.path);
    directory.set(nameBytes.slice(0, 56), index * DIRECTORY_ENTRY_SIZE);
    dirView.setInt32(index * DIRECTORY_ENTRY_SIZE + 56, offset, true);
    dirView.setInt32(index * DIRECTORY_ENTRY_SIZE + 60, data.byteLength, true);

    offset += data.byteLength;
  });

  const directoryOffset = offset;
  const directoryLength = directory.byteLength;
  const totalSize = HEADER_SIZE + fileBuffers.reduce((sum, buf) => sum + buf.byteLength, 0) + directoryLength;
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  const writer = new Uint8Array(buffer);

  writer.set([0x50, 0x41, 0x43, 0x4b]);
  view.setInt32(4, directoryOffset, true);
  view.setInt32(8, directoryLength, true);

  let cursor = HEADER_SIZE;
  for (const data of fileBuffers) {
    writer.set(data, cursor);
    cursor += data.byteLength;
  }

  writer.set(directory, directoryOffset);
  return buffer;
}

export function textData(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}
