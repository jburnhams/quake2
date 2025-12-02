import { describe, it, expect } from 'vitest';
import { NetChan } from '../../src/net/netchan';

describe('NetChan', () => {
  it('should initialize with default state', () => {
    const netchan = new NetChan();

    expect(netchan.incomingSequence).toBe(0);
    expect(netchan.outgoingSequence).toBe(0);
    expect(netchan.incomingAcknowledged).toBe(0);
    expect(netchan.incomingReliableAcknowledged).toBe(false);
    expect(netchan.incomingReliableSequence).toBe(0);
    expect(netchan.outgoingReliableSequence).toBe(0);
    expect(netchan.reliableLength).toBe(0);
    expect(netchan.qport).toBeGreaterThanOrEqual(0);
    expect(netchan.qport).toBeLessThan(65536);
    expect(netchan.remoteAddress).toBeNull();
  });

  it('should have correct constants', () => {
    expect(NetChan.MAX_MSGLEN).toBe(1400);
    expect(NetChan.FRAGMENT_SIZE).toBe(1024);
    expect(NetChan.PACKET_HEADER).toBe(10);
  });

  it('should allow setup with specific qport', () => {
    const netchan = new NetChan();
    netchan.setup(12345);

    expect(netchan.qport).toBe(12345);
  });

  it('should reset state correctly', () => {
    const netchan = new NetChan();

    // Modify state
    netchan.incomingSequence = 100;
    netchan.outgoingSequence = 50;
    netchan.incomingAcknowledged = 40;
    netchan.incomingReliableAcknowledged = true;

    netchan.reset();

    expect(netchan.incomingSequence).toBe(0);
    expect(netchan.outgoingSequence).toBe(0);
    expect(netchan.incomingAcknowledged).toBe(0);
    expect(netchan.incomingReliableAcknowledged).toBe(false);
  });
});
