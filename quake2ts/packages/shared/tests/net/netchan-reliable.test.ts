import { describe, it, expect } from 'vitest';
import { NetChan } from '../../src/net/netchan';

describe('NetChan Reliable Queueing', () => {
  it('should allow writing reliable data when buffer is empty', () => {
    const netchan = new NetChan();
    expect(netchan.canSendReliable()).toBe(true);

    netchan.writeReliableByte(123);
    expect(netchan.reliableLength).toBe(1);

    // After writing, reliableLength is > 0, so canSendReliable returns false.
    // This is correct behavior: we check canSendReliable BEFORE we start writing a new batch.
    expect(netchan.canSendReliable()).toBe(false);
  });

  it('should write reliable primitives', () => {
    const netchan = new NetChan();

    netchan.writeReliableByte(1);
    netchan.writeReliableShort(2);
    netchan.writeReliableLong(3);
    netchan.writeReliableString("test");

    expect(netchan.reliableLength).toBe(1 + 2 + 4 + 5);

    const buffer = netchan.getReliableData();
    expect(buffer.length).toBe(1 + 2 + 4 + 5);

    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    expect(view.getUint8(0)).toBe(1);
    expect(view.getInt16(1, true)).toBe(2);
    expect(view.getInt32(3, true)).toBe(3);
    // String "test" + null
    expect(view.getUint8(7)).toBe('t'.charCodeAt(0));
  });

  it('should block writing if reliable data is pending', () => {
    const netchan = new NetChan();

    netchan.writeReliableByte(1);

    // Now we have data.
    // If we follow the strict "Can only write if empty" rule (to prevent modifying in-flight):
    // But here we are just buffering.
    // We can continue writing until we transmit?
    // The `NetChan` doesn't know when we are done writing.

    // Let's implement `canSendReliable` as "Is buffer empty?".
    expect(netchan.canSendReliable()).toBe(false);
  });

  it('should throw if buffer overflow', () => {
      const netchan = new NetChan();

      // We can only fill up to MAX_MSGLEN - HEADER_OVERHEAD (10 + 2 = 12)
      // So max reliable payload is 1400 - 12 = 1388
      const maxPayload = NetChan.MAX_MSGLEN - NetChan.HEADER_OVERHEAD;

      // Fill close to the limit
      // Using a loop is slow, let's just hack the reliableLength to simulate full buffer
      netchan.reliableLength = maxPayload;

      // Try to write one more byte
      expect(() => {
        netchan.writeReliableByte(1);
      }).toThrow(/overflow/);
  });
});
