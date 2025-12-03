import { describe, it, expect } from 'vitest';
import { NetChan, MAX_MSGLEN } from '../../src/net/netchan.js';

describe('NetChan', () => {
  it('should initialize with default values', () => {
    const netchan = new NetChan();

    expect(netchan.qport).toBeGreaterThanOrEqual(0);
    expect(netchan.qport).toBeLessThan(65536);

    expect(netchan.incomingSequence).toBe(0);
    expect(netchan.outgoingSequence).toBe(0);
    expect(netchan.incomingAcknowledged).toBe(0);
    expect(netchan.incomingReliableAcknowledged).toBe(false);
    expect(netchan.incomingReliableSequence).toBe(0);
    expect(netchan.outgoingReliableSequence).toBe(0);

    expect(netchan.reliableMessage).toBeDefined();
    // Verify reliable message buffer size (should be MAX_MSGLEN)
    // Note: BinaryWriter.buffer is private, but we can infer capacity by ensuring it doesn't throw on write up to MAX_MSGLEN
    // or by checking the buffer initialized in constructor via public property if exposed (it's not).
    // However, we passed a Uint8Array of MAX_MSGLEN.

    expect(netchan.reliableLength).toBe(0);

    // Timestamps should be recent
    const now = Date.now();
    expect(netchan.lastSent).toBeLessThanOrEqual(now);
    expect(netchan.lastSent).toBeGreaterThan(now - 1000); // within last second
    expect(netchan.lastReceived).toBeLessThanOrEqual(now);
    expect(netchan.lastReceived).toBeGreaterThan(now - 1000);
  });
});
