// The /play input mapping against the real game: LocalHost runs demo1 in Node, and the usercmd
// the page builds from held keys must make the player jump (and crouch), as it does in the original.
import { describe, expect, it } from 'vitest';
import { LocalHost } from '@quake2ts/server';
import { PakArchive } from '@quake2ts/formats';
import { toUserCommand } from '../src/play/session';
import { demoPak } from './setup';

function start(): LocalHost {
  const pak = PakArchive.fromArrayBuffer('pak.pak', demoPak.buffer.slice(demoPak.byteOffset, demoPak.byteOffset + demoPak.byteLength) as ArrayBuffer);
  const host = new LocalHost({ readFile: (p) => (pak.getEntry(p) ? pak.readFile(p) : undefined) });
  host.command('map demo1');
  host.run(1); // settle onto the floor
  return host;
}

const input = (...keys: string[]) => ({ keys: new Set(keys), attack: false, pitch: 0, yaw: 0 });

describe('playing demo1', () => {
  it('sets the jump and crouch buttons from space and C', () => {
    expect(toUserCommand(input('Space')).buttons & (1 << 3)).toBeTruthy();
    expect(toUserCommand(input('KeyC')).buttons & (1 << 4)).toBeTruthy();
    expect(toUserCommand(input()).buttons).toBe(0);
  });

  it('jumps when space is held, once until it is let go', () => {
    const host = start();
    const floor = host.player!.origin.z;
    let peak = floor;
    for (let i = 0; i < 20; i++) {
      host.frame(toUserCommand(input('Space')));
      peak = Math.max(peak, host.player!.origin.z);
    }
    expect(peak - floor).toBeGreaterThan(30);
    // Still holding space after landing: no second jump.
    for (let i = 0; i < 40; i++) host.frame(toUserCommand(input('Space')));
    const landed = host.player!.origin.z;
    let again = landed;
    for (let i = 0; i < 10; i++) {
      host.frame(toUserCommand(input('Space')));
      again = Math.max(again, host.player!.origin.z);
    }
    expect(again).toBe(landed);
  });

  it('crouches while C is held', () => {
    const host = start();
    const standing = host.player!.maxs.z;
    for (let i = 0; i < 5; i++) host.frame(toUserCommand(input('KeyC')));
    expect(host.player!.maxs.z).toBeLessThan(standing);
  });
});
