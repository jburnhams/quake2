import { BinaryWriter } from '../io/binaryWriter.js';

export interface NetAddress {
  type: string;
  port: number;
}

/**
 * NetChan handles reliable message delivery over an unreliable channel (UDP/WebSocket).
 * Fragmentation support is planned but not fully implemented.
 *
 * Ported from qcommon/net_chan.c
 */
export class NetChan {
  // Constants from net_chan.c
  static readonly MAX_MSGLEN = 1400;
  static readonly FRAGMENT_SIZE = 1024;
  static readonly PACKET_HEADER = 10; // sequence(4) + ack(4) + qport(2)
  static readonly HEADER_OVERHEAD = NetChan.PACKET_HEADER + 2; // +2 for reliable length prefix

  // Public state
  qport = 0; // qport value to distinguish multiple clients from same IP

  // Sequencing
  incomingSequence = 0;
  outgoingSequence = 0;
  incomingAcknowledged = 0;

  // Reliable messaging
  incomingReliableAcknowledged = false; // single bit
  incomingReliableSequence = 0; // last reliable message sequence received
  outgoingReliableSequence = 0; // reliable message sequence number to send
  reliableMessage: BinaryWriter;
  reliableLength = 0;

  // Timing
  lastReceived = 0;
  lastSent = 0;

  remoteAddress: NetAddress | null = null;

  constructor() {
    // Initialize buffers
    this.reliableMessage = new BinaryWriter(NetChan.MAX_MSGLEN);

    // Set initial timestamps
    const now = Date.now();
    this.lastReceived = now;
    this.lastSent = now;

    // Random qport by default (can be overridden)
    this.qport = Math.floor(Math.random() * 65536);
  }

  /**
   * Setup the netchan with specific settings
   */
  setup(qport: number, address: NetAddress | null = null): void {
    this.qport = qport;
    this.remoteAddress = address;
    this.reset();
  }

  /**
   * Reset the netchan state
   */
  reset(): void {
    this.incomingSequence = 0;
    this.outgoingSequence = 0;
    this.incomingAcknowledged = 0;
    this.incomingReliableAcknowledged = false;
    this.incomingReliableSequence = 0;
    this.outgoingReliableSequence = 0;
    this.reliableLength = 0;
    this.reliableMessage.reset();
    this.lastReceived = Date.now();
    this.lastSent = Date.now();
  }

  /**
   * Transmits a packet containing reliable and unreliable data
   */
  transmit(unreliableData?: Uint8Array): Uint8Array {
    this.outgoingSequence++;
    this.lastSent = Date.now();

    // Calculate total size
    // Header + Reliable + Unreliable
    const headerSize = NetChan.PACKET_HEADER;
    const reliableSize = this.reliableLength > 0 ? this.reliableLength + 2 : 0; // +2 for length prefix
    let unreliableSize = unreliableData ? unreliableData.length : 0;

    // Check for overflow
    if (headerSize + reliableSize + unreliableSize > NetChan.MAX_MSGLEN) {
      unreliableSize = NetChan.MAX_MSGLEN - headerSize - reliableSize;
      // We truncate unreliable data if it doesn't fit with reliable data
      if (unreliableSize < 0) unreliableSize = 0;
    }

    const buffer = new ArrayBuffer(headerSize + reliableSize + unreliableSize);
    const view = new DataView(buffer);
    const result = new Uint8Array(buffer);

    // Write Header
    // Sequence
    let sequence = this.outgoingSequence;

    // Set reliable bit if we are sending reliable data
    if (this.reliableLength > 0) {
      sequence |= 0x80000000;
      // Also set the reliable sequence bit (0/1 toggle) at bit 30
      if ((this.outgoingReliableSequence & 1) !== 0) {
        sequence |= 0x40000000;
      }
    }

    view.setUint32(0, sequence, true);

    // Acknowledge
    // Set reliable ack bit at bit 31
    let ack = this.incomingSequence;
    if ((this.incomingReliableSequence & 1) !== 0) {
      ack |= 0x80000000;
    }
    view.setUint32(4, ack, true);

    view.setUint16(8, this.qport, true);

    // Copy Reliable Data
    let offset = headerSize;
    if (this.reliableLength > 0) {
      // Write length of reliable data (2 bytes) to allow skipping duplicates
      view.setUint16(offset, this.reliableLength, true);
      offset += 2;

      // BinaryWriter buffer might be larger than reliableLength, so we slice
      const reliableBuffer = this.reliableMessage.getBuffer();
      const reliableBytes = reliableBuffer.subarray(0, this.reliableLength);
      result.set(reliableBytes, offset);
      offset += this.reliableLength;
    }

    // Copy Unreliable Data
    if (unreliableData && unreliableSize > 0) {
      const chunk = unreliableData.slice(0, unreliableSize);
      result.set(chunk, offset);
    }

    return result;
  }

  /**
   * Processes a received packet
   * Returns the payload data (reliable + unreliable) to be processed, or null if discarded
   */
  process(packet: Uint8Array): Uint8Array | null {
    if (packet.length < NetChan.PACKET_HEADER) {
      return null;
    }

    this.lastReceived = Date.now();

    const view = new DataView(packet.buffer, packet.byteOffset, packet.byteLength);
    const sequence = view.getUint32(0, true);
    const ack = view.getUint32(4, true);
    const qport = view.getUint16(8, true);

    if (this.qport !== qport) {
      return null;
    }

    // Check for duplicate or out of order
    // Sequence wraps at 32-bit.
    const seqNumberClean = sequence & ~(0x80000000 | 0x40000000); // Mask out flags

    // Handle wrapping using signed difference
    if (((seqNumberClean - this.incomingSequence) | 0) <= 0) {
      return null;
    }

    // Update incoming sequence
    this.incomingSequence = seqNumberClean;

    // Handle reliable acknowledgment
    const ackNumber = ack & ~0x80000000;
    const ackReliable = (ack & 0x80000000) !== 0;

    if (ackNumber > this.incomingAcknowledged) {
      this.incomingAcknowledged = ackNumber;
    }

    // Check if our reliable message was acknowledged
    if (this.reliableLength > 0) {
       // We sent 'bit'.
       // Receiver consumes it and increments its expectation to 'bit ^ 1'.
       // Receiver sends ACK with 'bit ^ 1'.
       // So we check if ACK matches 'bit ^ 1'.

       const bit = this.outgoingReliableSequence & 1;
       const expectedAck = bit ^ 1;
       const ackBit = ackReliable ? 1 : 0;

       if (ackBit === expectedAck) {
         this.reliableLength = 0;
         this.reliableMessage.reset();
         this.outgoingReliableSequence ^= 1;
       }
    }

    // Handle incoming reliable data
    const hasReliableData = (sequence & 0x80000000) !== 0;
    const reliableSeqBit = (sequence & 0x40000000) !== 0 ? 1 : 0;

    let payloadOffset = NetChan.PACKET_HEADER;

    if (hasReliableData) {
       if (payloadOffset + 2 > packet.byteLength) return null; // Malformed

       const reliableLen = view.getUint16(payloadOffset, true);
       payloadOffset += 2;

       // We expect the reliable bit to toggle with each new reliable message.
       // If incomingReliableSequence is 0 (initial), we expect the first reliable message (0).
       // So expected bit is incomingReliableSequence & 1.
       const expectedBit = this.incomingReliableSequence & 1;

       if (reliableSeqBit === expectedBit) {
          // New reliable data!
          this.incomingReliableSequence++;
          // We return both reliable and unreliable data concatenated
          // The caller will parse them as a stream of commands
       } else {
          // Duplicate reliable data. Skip it.
          payloadOffset += reliableLen;
       }
    }

    // Return the rest of the packet
    return packet.slice(payloadOffset);
  }

  /**
   * Checks if reliable message buffer is empty and ready for new data
   */
  canSendReliable(): boolean {
    return this.reliableLength === 0;
  }

  /**
   * Writes a byte to the reliable message buffer
   */
  writeReliableByte(value: number): void {
    if (this.reliableLength + 1 > NetChan.MAX_MSGLEN - NetChan.HEADER_OVERHEAD) {
      throw new Error('NetChan reliable buffer overflow');
    }
    this.reliableMessage.writeByte(value);
    this.reliableLength++;
  }

  /**
   * Writes a short to the reliable message buffer
   */
  writeReliableShort(value: number): void {
    if (this.reliableLength + 2 > NetChan.MAX_MSGLEN - NetChan.HEADER_OVERHEAD) {
      throw new Error('NetChan reliable buffer overflow');
    }
    this.reliableMessage.writeShort(value);
    this.reliableLength += 2;
  }

  /**
   * Writes a long to the reliable message buffer
   */
  writeReliableLong(value: number): void {
    if (this.reliableLength + 4 > NetChan.MAX_MSGLEN - NetChan.HEADER_OVERHEAD) {
      throw new Error('NetChan reliable buffer overflow');
    }
    this.reliableMessage.writeLong(value);
    this.reliableLength += 4;
  }

  /**
   * Writes a string to the reliable message buffer
   */
  writeReliableString(value: string): void {
    const len = value.length + 1; // +1 for null terminator
    if (this.reliableLength + len > NetChan.MAX_MSGLEN - NetChan.HEADER_OVERHEAD) {
      throw new Error('NetChan reliable buffer overflow');
    }
    this.reliableMessage.writeString(value);
    this.reliableLength += len;
  }

  /**
   * Returns the current reliable data buffer
   */
  getReliableData(): Uint8Array {
    if (this.reliableLength === 0) {
      return new Uint8Array(0);
    }
    const buffer = this.reliableMessage.getBuffer();
    return buffer.subarray(0, this.reliableLength);
  }

  /**
   * Checks if we need to send a keepalive packet
   */
  needsKeepalive(currentTime: number): boolean {
    return (currentTime - this.lastSent) > 1000;
  }

  /**
   * Checks if the connection has timed out
   */
  isTimedOut(currentTime: number, timeoutMs: number = 30000): boolean {
    return (currentTime - this.lastReceived) > timeoutMs;
  }
}
