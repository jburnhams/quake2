import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NetChan } from '../../../src/net/netchan.js';

describe('NetChan Transmit', () => {
  let netchan: NetChan;

  beforeEach(() => {
    netchan = new NetChan();
    netchan.setup(12345); // Fixed qport
  });

  it('should transmit a basic packet with only header', () => {
    const packet = netchan.transmit();

    // Header size is 10 bytes
    expect(packet.length).toBe(10);

    const view = new DataView(packet.buffer);
    const sequence = view.getUint32(0, true);
    const ack = view.getUint32(4, true);
    const qport = view.getUint16(8, true);

    expect(sequence).toBe(1); // First packet
    expect(ack).toBe(0);
    expect(qport).toBe(12345);
  });

  it('should increment outgoing sequence number', () => {
    netchan.transmit();
    const packet2 = netchan.transmit();

    const view = new DataView(packet2.buffer);
    const sequence = view.getUint32(0, true);

    expect(sequence).toBe(2);
  });

  it('should include unreliable data', () => {
    const unreliable = new Uint8Array([1, 2, 3, 4]);
    const packet = netchan.transmit(unreliable);

    expect(packet.length).toBe(10 + 4);

    // Check data at end
    expect(packet[10]).toBe(1);
    expect(packet[13]).toBe(4);
  });

  it('should include reliable data', () => {
    netchan.writeReliableByte(42);
    const packet = netchan.transmit();

    // Header(10) + Length(2) + Data(1) = 13
    expect(packet.length).toBe(13);

    const view = new DataView(packet.buffer);
    const sequence = view.getUint32(0, true);

    // Check reliable flag (bit 31)
    expect((sequence & 0x80000000) >>> 0).not.toBe(0);

    // Check reliable length
    const len = view.getUint16(10, true);
    expect(len).toBe(1);

    // Check data
    expect(packet[12]).toBe(42);
  });

  it('should set reliable sequence bit correctly', () => {
    // outgoingReliableSequence starts at 0.
    // So bit 30 should be 0.

    netchan.writeReliableByte(42);
    let packet = netchan.transmit();
    let view = new DataView(packet.buffer);
    let sequence = view.getUint32(0, true);

    // Bit 31 set (reliable data present), Bit 30 clear (seq 0)
    expect((sequence & 0x80000000) >>> 0).not.toBe(0);
    expect((sequence & 0x40000000) >>> 0).toBe(0);

    // Simulate ACK so we can flip sequence
    // We hack the state directly for this unit test
    netchan.reliableLength = 0;
    netchan.reliableMessage.reset();
    netchan.outgoingReliableSequence = 1;

    // Send new reliable data
    netchan.writeReliableByte(99);
    packet = netchan.transmit();
    view = new DataView(packet.buffer);
    sequence = view.getUint32(0, true);

    // Bit 31 set, Bit 30 set (seq 1)
    expect((sequence & 0x80000000) >>> 0).not.toBe(0);
    expect((sequence & 0x40000000) >>> 0).not.toBe(0);
  });

  it('should truncate unreliable data on overflow', () => {
     // Max 1400. Header 10. Reliable Overhead 2.
     // Available: 1388.

     // Fill reliable with 1000 bytes
     for (let i = 0; i < 1000; i++) netchan.writeReliableByte(0);

     // Try to send 500 bytes unreliable
     const unreliable = new Uint8Array(500);
     const packet = netchan.transmit(unreliable);

     // Total should be capped at 1400
     expect(packet.length).toBe(1400);

     // Header(10) + RelLen(2) + Rel(1000) = 1012
     // Remaining for unreliable: 1400 - 1012 = 388
     // Unreliable was 500, so it was truncated.
  });
});
