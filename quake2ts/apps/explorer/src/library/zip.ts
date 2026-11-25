// Reads one file out of a ZIP archive, in the browser or in Node, with no library: the central
// directory names every member and where its bytes start, and a deflated member is inflated by the
// platform's own DecompressionStream. Written for q2-314-demo-x86.exe, a self-extracting ZIP: an
// installer stub sits in front of the archive, so every offset the directory records is off by the
// stub's length. The shift is measured from where the directory really is (just before the end
// record) against where the end record says it is, as unzip does when it warns of "extra bytes".
// A candidate for a general strata library once a second caller wants it.

const END_OF_DIRECTORY = 0x06054b50;
const DIRECTORY_ENTRY = 0x02014b50;
const LOCAL_HEADER = 0x04034b50;

export class ZipError extends Error {
  override name = 'ZipError';
}

export type ZipMember = { name: string; method: number; compressedSize: number; size: number; dataOffset: number };

/** Every member of the archive, with where its stored bytes start in `buffer`. */
export function listZip(buffer: ArrayBuffer): ZipMember[] {
  const view = new DataView(buffer);
  const end = findEndOfDirectory(view);
  const count = view.getUint16(end + 10, true);
  const dirSize = view.getUint32(end + 12, true);
  const dirOffset = view.getUint32(end + 16, true);
  const shift = end - dirSize - dirOffset;
  if (shift < 0) throw new ZipError('The ZIP directory points past the end of the file.');
  const decoder = new TextDecoder();
  const members: ZipMember[] = [];
  let at = dirOffset + shift;
  for (let i = 0; i < count; i += 1) {
    if (view.getUint32(at, true) !== DIRECTORY_ENTRY) throw new ZipError(`ZIP directory entry ${i} is damaged.`);
    const method = view.getUint16(at + 10, true);
    const compressedSize = view.getUint32(at + 20, true);
    const size = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const local = view.getUint32(at + 42, true) + shift;
    const name = decoder.decode(new Uint8Array(buffer, at + 46, nameLength));
    if (view.getUint32(local, true) !== LOCAL_HEADER) throw new ZipError(`${name}: its local header is missing.`);
    const dataOffset = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    members.push({ name, method, compressedSize, size, dataOffset });
    at += 46 + nameLength + extraLength + commentLength;
  }
  return members;
}

/** The bytes of the member called `name` (stored or deflated). Throws a ZipError naming what is wrong. */
export async function readZipMember(buffer: ArrayBuffer, name: string): Promise<ArrayBuffer> {
  const member = listZip(buffer).find((m) => m.name === name);
  if (!member) throw new ZipError(`${name} is not in the archive.`);
  const stored = new Uint8Array(buffer, member.dataOffset, member.compressedSize);
  if (member.method === 0) return stored.slice().buffer;
  if (member.method !== 8) throw new ZipError(`${name} is compressed with method ${member.method}, which only deflate and store are read.`);
  const source = new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(stored);
      controller.close();
    },
  });
  const inflated = source.pipeThrough(new DecompressionStream('deflate-raw'));
  const out = await new Response(inflated).arrayBuffer();
  if (out.byteLength !== member.size) throw new ZipError(`${name} inflated to ${out.byteLength} bytes, not ${member.size}.`);
  return out;
}

function findEndOfDirectory(view: DataView): number {
  // The end record is 22 bytes plus a comment of up to 65,535 bytes, so it is in the last 64 KiB.
  const stop = Math.max(0, view.byteLength - 22 - 0xffff);
  for (let at = view.byteLength - 22; at >= stop; at -= 1) {
    if (view.getUint32(at, true) === END_OF_DIRECTORY) return at;
  }
  throw new ZipError('Not a ZIP archive: it has no end-of-directory record.');
}
