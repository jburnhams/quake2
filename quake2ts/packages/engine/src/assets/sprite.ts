import { VirtualFileSystem } from './vfs.js';

const IDSPRITEHEADER = 0x49445332; // 'IDS2'
const SPRITE_VERSION = 2;
const MAX_SKINNAME = 64;
const HEADER_SIZE = 12;

export interface SpriteFrame {
  readonly width: number;
  readonly height: number;
  readonly originX: number;
  readonly originY: number;
  readonly name: string;
}

export interface SpriteModel {
  readonly ident: number;
  readonly version: number;
  readonly numFrames: number;
  readonly frames: readonly SpriteFrame[];
}

export class SpriteParseError extends Error {}

function readCString(view: DataView, offset: number, maxLength: number): string {
  const chars: number[] = [];
  for (let i = 0; i < maxLength; i += 1) {
    const code = view.getUint8(offset + i);
    if (code === 0) break;
    chars.push(code);
  }
  return String.fromCharCode(...chars);
}

export function parseSprite(buffer: ArrayBuffer): SpriteModel {
  if (buffer.byteLength < HEADER_SIZE) {
    throw new SpriteParseError('Sprite buffer too small to contain header');
  }

  const view = new DataView(buffer);
  const ident = view.getInt32(0, true);
  const version = view.getInt32(4, true);
  const numFrames = view.getInt32(8, true);

  if (ident !== IDSPRITEHEADER) {
    throw new SpriteParseError(`Invalid Sprite ident: ${ident}`);
  }
  if (version !== SPRITE_VERSION) {
    throw new SpriteParseError(`Unsupported Sprite version: ${version}`);
  }

  const frames: SpriteFrame[] = [];
  const frameSize = 16 + MAX_SKINNAME; // 4 * 4 bytes + 64 bytes = 80 bytes
  let offset = HEADER_SIZE;

  for (let i = 0; i < numFrames; i += 1) {
    if (offset + frameSize > buffer.byteLength) {
      throw new SpriteParseError('Sprite frame data exceeds buffer length');
    }

    const width = view.getInt32(offset, true);
    const height = view.getInt32(offset + 4, true);
    const originX = view.getInt32(offset + 8, true);
    const originY = view.getInt32(offset + 12, true);
    const name = readCString(view, offset + 16, MAX_SKINNAME);

    frames.push({
      width,
      height,
      originX,
      originY,
      name,
    });

    offset += frameSize;
  }

  return {
    ident,
    version,
    numFrames,
    frames,
  };
}

export class SpriteLoader {
  constructor(private readonly vfs: VirtualFileSystem) {}

  async load(path: string): Promise<SpriteModel> {
    const bytes = await this.vfs.readFile(path);
    // Copy the buffer to ensure it's an ArrayBuffer and not a view
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return parseSprite(copy.buffer);
  }
}
