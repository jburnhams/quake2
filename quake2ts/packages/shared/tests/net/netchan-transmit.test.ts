import { describe, it, expect } from 'vitest';
import { NetChan } from '../../src/net/netchan';

describe('NetChan Transmit', () => {
  it('should create a packet with correct header', () => {
    const netchan = new NetChan();
    netchan.setup(12345);

    // Simulate some reliable data if needed, or just unreliable
    const unreliableData = new Uint8Array([1, 2, 3, 4]);
    const packet = netchan.transmit(unreliableData);

    // Header is 10 bytes: seq(4) + ack(4) + qport(2)
    // 10 + 4 = 14 bytes total
    expect(packet.length).toBe(14);

    const view = new DataView(packet.buffer);
    const sequence = view.getUint32(0, true);
    const ack = view.getUint32(4, true);
    const qport = view.getUint16(8, true);

    expect(sequence).toBe(1); // First sequence should be 1 (0 + 1)
    expect(ack).toBe(0);
    expect(qport).toBe(12345);

    // Check payload
    expect(packet[10]).toBe(1);
    expect(packet[11]).toBe(2);
    expect(packet[12]).toBe(3);
    expect(packet[13]).toBe(4);
  });

  it('should increment outgoing sequence number', () => {
    const netchan = new NetChan();
    netchan.transmit(new Uint8Array([1]));
    expect(netchan.outgoingSequence).toBe(1);

    netchan.transmit(new Uint8Array([2]));
    expect(netchan.outgoingSequence).toBe(2);
  });

  it('should include reliable data when present', () => {
    const netchan = new NetChan();

    // Manually inject reliable data for this test using writeByte
    netchan.reliableMessage.writeByte(99);
    netchan.reliableLength = 1;

    const packet = netchan.transmit(new Uint8Array([1]));

    const view = new DataView(packet.buffer);
    const sequence = view.getUint32(0, true);

    // Reliable bit (0x80000000) should be set
    expect((sequence & 0x80000000) >>> 0).toBe(0x80000000);

    // Packet structure: Header(10) + Length(2) + Reliable(1) + Unreliable(1)
    // 10 + 2 + 1 + 1 = 14
    expect(packet.length).toBe(14);

    // Check length field
    const len = view.getUint16(10, true);
    expect(len).toBe(1);

    expect(packet[12]).toBe(99); // Reliable data
    expect(packet[13]).toBe(1);  // Unreliable data
  });

  it('should set reliable ack bit correctly', () => {
    const netchan = new NetChan();

    // Case 1: incomingReliableSequence is odd (so bit 0 is 1)
    netchan.incomingReliableSequence = 1;
    let packet = netchan.transmit(new Uint8Array([0]));
    let view = new DataView(packet.buffer);
    let ack = view.getUint32(4, true);
    // Reliable ack bit (0x80000000) should be set
    expect((ack & 0x80000000) >>> 0).toBe(0x80000000);

    // Case 2: incomingReliableSequence is even
    netchan.incomingReliableSequence = 2;
    packet = netchan.transmit(new Uint8Array([0]));
    view = new DataView(packet.buffer);
    ack = view.getUint32(4, true);
    // Reliable ack bit should NOT be set
    expect((ack & 0x80000000) >>> 0).toBe(0);
  });
});
