import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NetChan } from '../../../src/net/netchan.js';

describe('NetChan Process', () => {
  let client: NetChan;
  let server: NetChan;

  beforeEach(() => {
    client = new NetChan();
    server = new NetChan();

    // Sync qports
    client.setup(1111);
    server.setup(1111);
  });

  it('should process a basic packet', () => {
    const packet = client.transmit();
    const result = server.process(packet);

    expect(result).not.toBeNull();
    expect(server.incomingSequence).toBe(1);
  });

  it('should reject packet with wrong qport', () => {
    client.setup(9999);
    const packet = client.transmit();

    const result = server.process(packet);
    expect(result).toBeNull();
    // Sequence should not update
    expect(server.incomingSequence).toBe(0);
  });

  it('should handle reliable data transmission', () => {
    // Client sends reliable data
    client.writeReliableString("Hello");
    const packet = client.transmit();

    // Server processes it
    const result = server.process(packet);

    expect(result).not.toBeNull();
    // We expect "Hello" + null terminator = 6 bytes
    // result should contain this data
    expect(result!.length).toBe(6);

    // Server should have updated its reliable expectation
    expect(server.incomingReliableSequence).toBe(1);

    // Now server needs to ACK this
    // Server sends a packet back
    const ackPacket = server.transmit();

    // Client processes ACK
    client.process(ackPacket);

    // Client reliable buffer should be cleared
    expect(client.reliableLength).toBe(0);
    expect(client.canSendReliable()).toBe(true);
  });

  it('should ignore duplicate reliable data', () => {
    client.writeReliableByte(123);
    const packet = client.transmit();

    // Server processes first time
    const res1 = server.process(packet);
    expect(res1).not.toBeNull();
    expect(res1!.length).toBe(1);
    expect(server.incomingReliableSequence).toBe(1);

    // Server receives SAME packet again (duplicate/retransmit)
    const res2 = server.process(packet);

    // Should return empty payload (or just unreliable if any)
    // Reliable data should be skipped, so null is returned if duplicate processing causes drop?
    // Wait, process() returns null if packet is invalid or duplicate sequence.
    // If it's a valid retransmit (sequence > incomingSequence), it will be processed.

    // NetChan logic:
    // if (((seqNumberClean - this.incomingSequence) | 0) <= 0) return null;

    // Ah, duplicate sequence numbers are dropped immediately by the sequence check!
    // So res2 MUST be null because sequence is same as res1.

    expect(res2).toBeNull();

    // Sequence should not increment
    expect(server.incomingReliableSequence).toBe(1);
  });

  it('should handle packet loss (out of order)', () => {
    // Packet 1
    const p1 = client.transmit();
    // Packet 2
    const p2 = client.transmit();

    // Receive p2 first (p1 lost/delayed)
    server.process(p2);

    expect(server.incomingSequence).toBe(2);

    // Now receive p1 (old)
    const res = server.process(p1);

    // Should be discarded
    expect(res).toBeNull();
    expect(server.incomingSequence).toBe(2);
  });
});
