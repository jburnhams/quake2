import { describe, it, expect } from 'vitest';
import { NetChan } from '../../../src/net/netchan.js';

describe('NetChan Fragmentation', () => {
  it('should support large reliable messages by fragmenting them', () => {
    const sender = new NetChan();
    const receiver = new NetChan();

    sender.setup(1234);
    receiver.setup(1234);

    // Create a large message (3000 bytes)
    const messageSize = 3000;
    const largeMessage = new Uint8Array(messageSize);
    for (let i = 0; i < messageSize; i++) {
      largeMessage[i] = (i % 255);
    }

    // Write the message to the sender
    for (let i = 0; i < messageSize; i++) {
      sender.writeReliableByte(largeMessage[i]);
    }

    // Transmit all fragments
    let packetsSent = 0;
    let messageReceived = false;

    // Safety loop limit
    for (let i = 0; i < 20; i++) {
      const packet = sender.transmit();
      packetsSent++;

      const processed = receiver.process(packet);

      if (processed && processed.length > 0) {
        expect(processed.length).toBe(messageSize);
        expect(processed).toEqual(largeMessage);
        messageReceived = true;
      }

      // Send ACK
      const ackPacket = new Uint8Array(10);
      const view = new DataView(ackPacket.buffer);
      view.setUint32(0, receiver.outgoingSequence, true);
      view.setUint32(4, receiver.incomingSequence | (receiver.incomingReliableSequence & 1 ? 0x80000000 : 0), true);
      view.setUint16(8, receiver.qport, true);

      sender.process(ackPacket);

      if (messageReceived) break;
    }

    expect(messageReceived).toBe(true);
    expect(packetsSent).toBeGreaterThan(1);
  });

  it('should recover from packet loss by retransmitting fragments', () => {
    const sender = new NetChan();
    const receiver = new NetChan();

    sender.setup(1234);
    receiver.setup(1234);

    // Message needs 3 fragments (1024 * 2 + remainder)
    const messageSize = 2500;
    const largeMessage = new Uint8Array(messageSize);
    for (let i = 0; i < messageSize; i++) {
      largeMessage[i] = (i % 255);
    }

    for (let i = 0; i < messageSize; i++) {
      sender.writeReliableByte(largeMessage[i]);
    }

    // Send 3 fragments
    const packet1 = sender.transmit(); // Fragment 1 (0-1024)
    const packet2 = sender.transmit(); // Fragment 2 (1024-2048)
    const packet3 = sender.transmit(); // Fragment 3 (2048-2500)

    // Receiver processes packet 1
    receiver.process(packet1);

    // Receiver DOES NOT receive packet 2 (simulated loss)

    // Receiver processes packet 3
    // Should be ignored because it expects fragment start at 1024, but this one starts at 2048
    receiver.process(packet3);

    // Receiver state: received 1024 bytes. Expecting 1024 offset.
    expect(receiver.fragmentReceived).toBe(1024);

    // Sender loop check:
    // Sender thinks it sent everything. It needs to loop back.
    // We call transmit again. It should see offset >= length and reset to 0.
    const packet1Retransmit = sender.transmit(); // Fragment 1 again

    // Receiver gets packet 1 again.
    // Start=0, Received=1024. 0 !== 1024. Ignored.
    receiver.process(packet1Retransmit);
    expect(receiver.fragmentReceived).toBe(1024);

    const packet2Retransmit = sender.transmit(); // Fragment 2 again

    // Receiver gets packet 2.
    // Start=1024, Received=1024. Match!
    receiver.process(packet2Retransmit);
    expect(receiver.fragmentReceived).toBe(2048);

    const packet3Retransmit = sender.transmit(); // Fragment 3 again

    // Receiver gets packet 3.
    // Start=2048, Received=2048. Match! Complete!
    const processed = receiver.process(packet3Retransmit);

    expect(processed).not.toBeNull();
    expect(processed!.length).toBe(messageSize);
    expect(processed).toEqual(largeMessage);
  });
});
