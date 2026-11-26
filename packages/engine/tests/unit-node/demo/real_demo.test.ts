// The real demos in the paks. The demo pak's demos/q2demo1.dm2 is Quake 2 3.14 (protocol 31), read
// as a player's client reads it: every frame a delta from the one it names, entities and player
// state rebuilt through ClientFrames. The committed pak.pak's demos/demo1.dm2 is 3.00 (protocol 25),
// a format the parser refuses (UNSUPPORTED_PROTOCOLS).
import { describe, it, expect } from 'vitest';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { PakArchive } from '../../../src/assets/pak';
import { DemoReader } from '../../../src/demo/demoReader';
import { DemoValidator } from '../../../src/demo/validator';
import { NetworkMessageParser, UnsupportedProtocolError, type FrameData, type NetworkMessageHandler } from '../../../src/demo/parser';
import { ClientFrames } from '../../../src/network/frames';
import { DEMO_PAK, demoPakAvailable } from '../../demo1/shots';

const fromPak = (pakPath: string, file: string): ArrayBuffer => {
  const buffer = readFileSync(pakPath);
  const pak = PakArchive.fromArrayBuffer(pakPath, buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer);
  const data = pak.readFile(file);
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
};

/** Every block through one parser state, as DemoPlaybackController feeds them. */
function readDemo(buffer: ArrayBuffer) {
  let protocol = 0;
  const frames: FrameData[] = [];
  const handler = new Proxy({}, {
    get: (_t, name) => name === 'onFrame' ? (f: FrameData) => frames.push(f)
      : name === 'onServerData' ? (p: number) => { protocol = p; }
      : () => {},
  }) as NetworkMessageHandler;
  const reader = new DemoReader(buffer);
  let errors = 0;
  for (let block = reader.readNextBlock(); block; block = reader.readNextBlock()) {
    const parser = new NetworkMessageParser(block.data, handler);
    parser.setProtocolVersion(protocol);
    parser.parseMessage();
    errors += parser.getErrorCount();
  }
  return { protocol, frames, errors };
}

describe('q2demo1.dm2 (Quake 2 3.14, protocol 31)', () => {
  it.skipIf(!demoPakAvailable())('reads every frame, each rebuilt from the frame it names', () => {
    const { protocol, frames, errors } = readDemo(fromPak(DEMO_PAK, 'demos/q2demo1.dm2'));
    expect(protocol).toBe(31);
    expect(errors).toBe(0);
    expect(frames.length).toBe(632);

    const history = new ClientFrames();
    let previous = -1;
    for (const frame of frames) {
      expect(frame.serverFrame).toBeGreaterThan(previous);
      previous = frame.serverFrame;
      const parsed = history.parse(frame, new Map());
      expect(parsed.valid).toBe(true); // the frame each one names is still held
      expect(parsed.entities.size).toBeGreaterThan(0);
      // The player state is whole: the view never drops back to the map origin.
      const o = parsed.playerState.origin;
      expect(Math.abs(o.x) + Math.abs(o.y) + Math.abs(o.z)).toBeGreaterThan(0);
    }
    expect(frames[0].deltaFrame).toBe(-1); // the first frame is whole
  });
});

describe('demo1.dm2 (Quake 2 3.00, protocol 25)', () => {
  const demo = () => fromPak(resolve(__dirname, '../../../../../pak.pak'), 'demos/demo1.dm2');

  it('is refused by the parser, not read as 3.20', () => {
    const reader = new DemoReader(demo());
    const parser = new NetworkMessageParser(reader.readNextBlock()!.data, {} as NetworkMessageHandler);
    expect(() => parser.parseMessage()).toThrow(UnsupportedProtocolError);
  });

  it('fails validation with the reason', () => {
    const result = DemoValidator.validate(demo(), 'demo1.dm2');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/3\.00 demos \(protocol 25\) are not supported/);
  });
});
