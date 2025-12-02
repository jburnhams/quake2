import { describe, it, expect } from 'vitest';
import { NetChan } from '../../src/net/netchan';

describe('NetChan Process', () => {
  it('should process a valid packet', () => {
    const server = new NetChan();
    server.setup(12345);

    const client = new NetChan();
    client.setup(12345);

    // Client sends packet
    const data = new Uint8Array([1, 2, 3]);
    const packet = client.transmit(data);

    // Server processes packet
    const result = server.process(packet);

    // Should return the data
    expect(result).not.toBeNull();
    expect(result).toEqual(data);

    // State updates
    expect(server.incomingSequence).toBe(1);
    expect(server.qport).toBe(12345);
  });

  it('should reject packet with mismatching qport', () => {
    const server = new NetChan();
    server.setup(12345);

    const client = new NetChan();
    client.setup(54321); // Different qport

    const packet = client.transmit(new Uint8Array([1]));
    const result = server.process(packet);

    expect(result).toBeNull();
    // Should not update sequence
    expect(server.incomingSequence).toBe(0);
  });

  it('should handle reliable data', () => {
    const server = new NetChan();
    server.setup(12345);

    const client = new NetChan();
    client.setup(12345);

    // Add reliable data
    client.reliableMessage.writeByte(42);
    client.reliableLength = 1;

    const packet = client.transmit(new Uint8Array([100]));

    // Server processes
    const result = server.process(packet);

    // Should return BOTH reliable and unreliable data for new reliable packets
    // Reliable data: [42]
    // Unreliable data: [100]
    expect(result).toEqual(new Uint8Array([42, 100]));

    // Reliable state should update
    expect(server.incomingReliableSequence).toBe(1); // bit flipped 0 -> 1

    // Second packet (duplicate reliable)
    const packet2 = client.transmit(new Uint8Array([101]));
    const result2 = server.process(packet2);

    // For duplicate reliable, it should ONLY return unreliable data
    expect(result2).toEqual(new Uint8Array([101]));
    // Should not increment reliable sequence again (it was already processed)
    expect(server.incomingReliableSequence).toBe(1);
  });

  it('should drop duplicate packets', () => {
    const server = new NetChan();
    server.setup(12345);

    const client = new NetChan();
    client.setup(12345);

    const packet = client.transmit(new Uint8Array([1]));

    // First receive
    const result1 = server.process(packet);
    expect(result1).not.toBeNull();

    // Second receive (duplicate)
    const result2 = server.process(packet);
    expect(result2).toBeNull();
  });

  it('should drop out-of-order packets', () => {
    const server = new NetChan();
    server.setup(12345);

    const client = new NetChan();
    client.setup(12345);

    // Send 1
    const packet1 = client.transmit(new Uint8Array([1]));
    // Send 2
    const packet2 = client.transmit(new Uint8Array([2]));

    // Receive 2 first
    server.process(packet2);
    expect(server.incomingSequence).toBe(2);

    // Receive 1 later (should be dropped because sequence < incomingSequence)
    const result1 = server.process(packet1);
    expect(result1).toBeNull();
  });

  it('should acknowledge reliable message', () => {
     const sender = new NetChan();
     sender.setup(111);

     const receiver = new NetChan();
     receiver.setup(111);

     // Sender puts reliable message
     sender.reliableMessage.writeByte(123);
     sender.reliableLength = 1;

     // Transmit 1: Contains reliable data
     const packet = sender.transmit(new Uint8Array([0]));

     // Receiver processes it
     receiver.process(packet);
     // Receiver state updated: incomingReliableSequence toggled (0 -> 1)
     expect(receiver.incomingReliableSequence).toBe(1);

     // Receiver replies (acks reliable)
     // NOTE: Receiver must have processed the reliable packet to update its state
     // before transmitting the ACK.
     const reply = receiver.transmit(new Uint8Array([0]));

     // Check if reply has ACK bit set
     const view = new DataView(reply.buffer);
     const ack = view.getUint32(4, true);
     expect((ack & 0x80000000) >>> 0).toBe(0x80000000); // Should ack reliable

     // Sender processes reply
     sender.process(reply);

     // Sender should now know reliable message was received
     // So it clears reliable buffer
     expect(sender.reliableLength).toBe(0);
  });
});
