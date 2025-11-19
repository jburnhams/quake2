import type { GameStateSnapshot } from './index.js';

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

function hashBytes(hash: number, bytes: ArrayLike<number>): number {
  let h = hash >>> 0;
  for (let i = 0; i < bytes.length; i += 1) {
    h ^= bytes[i]! & 0xff;
    h = Math.imul(h, FNV_PRIME) >>> 0;
  }
  return h >>> 0;
}

function hashNumber(hash: number, value: number): number {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setFloat64(0, value, true);
  const bytes = new Uint8Array(buffer);
  return hashBytes(hash, bytes);
}

function hashString(hash: number, value: string): number {
  const bytes = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i += 1) {
    bytes[i] = value.charCodeAt(i) & 0xff;
  }
  return hashBytes(hash, bytes);
}

export function hashGameState(state: GameStateSnapshot): number {
  let hash = FNV_OFFSET_BASIS;

  hash = hashNumber(hash, state.gravity.x);
  hash = hashNumber(hash, state.gravity.y);
  hash = hashNumber(hash, state.gravity.z);

  hash = hashNumber(hash, state.origin.x);
  hash = hashNumber(hash, state.origin.y);
  hash = hashNumber(hash, state.origin.z);

  hash = hashNumber(hash, state.velocity.x);
  hash = hashNumber(hash, state.velocity.y);
  hash = hashNumber(hash, state.velocity.z);

  hash = hashNumber(hash, state.level.frameNumber);
  hash = hashNumber(hash, state.level.timeSeconds);
  hash = hashNumber(hash, state.level.previousTimeSeconds);
  hash = hashNumber(hash, state.level.deltaSeconds);

  hash = hashNumber(hash, state.entities.activeCount);
  hash = hashString(hash, state.entities.worldClassname);

  return hash >>> 0;
}
