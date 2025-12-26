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

  // Increase internal reliable buffer to support large messages (fragmentation)
  // Quake 2 uses MAX_MSGLEN for the reliable buffer, limiting single messages to ~1400 bytes.
  // We expand this to allow larger messages (e.g. snapshots, downloads) which are then fragmented.
  static readonly MAX_RELIABLE_BUFFER = 0x40000; // 256KB

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

  // Fragmentation State (Sending)
  fragmentSendOffset = 0;

  // Fragmentation State (Receiving)
  fragmentBuffer: Uint8Array | null = null;
  fragmentLength = 0;
  fragmentReceived = 0;

  // Timing
  lastReceived = 0;
  lastSent = 0;

  remoteAddress: NetAddress | null = null;

  constructor() {
    // Initialize buffers
    this.reliableMessage = new BinaryWriter(NetChan.MAX_RELIABLE_BUFFER);

    // Set initial timestamps
    const now = Date.now();
    this.lastReceived = now;
    this.lastSent = now;

    // Random qport by default (can be overridden)
    // Ensure we use global Math.random which is usually seeded or random enough for basic collision avoidance
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

    this.fragmentSendOffset = 0;
    this.fragmentBuffer = null;
    this.fragmentLength = 0;
    this.fragmentReceived = 0;

    this.lastReceived = Date.now();
    this.lastSent = Date.now();
  }

  /**
   * Transmits a packet containing reliable and unreliable data
   */
  transmit(unreliableData?: Uint8Array): Uint8Array {
    this.outgoingSequence++;
    this.lastSent = Date.now();

    // Determine how much reliable data to send in this packet
    let sendReliableLength = 0;
    let isFragment = false;
    let fragmentStart = 0;

    if (this.reliableLength > 0) {
      // Check if we need to fragment
      if (this.reliableLength > NetChan.FRAGMENT_SIZE) {
        // We are in fragment mode
        isFragment = true;

        // If we have finished sending all fragments but still haven't received ACK,
        // we must loop back to the beginning to retransmit.
        if (this.fragmentSendOffset >= this.reliableLength) {
          this.fragmentSendOffset = 0;
        }

        // Calculate chunk size
        const remaining = this.reliableLength - this.fragmentSendOffset;
        sendReliableLength = remaining;
        if (sendReliableLength > NetChan.FRAGMENT_SIZE) {
          sendReliableLength = NetChan.FRAGMENT_SIZE;
        }

        fragmentStart = this.fragmentSendOffset;

        // Advance offset for the next packet
        this.fragmentSendOffset += sendReliableLength;
      } else {
        // Fits in one packet
        sendReliableLength = this.reliableLength;
      }
    }

    // Calculate total size
    // Header + Reliable + Unreliable
    const headerSize = NetChan.PACKET_HEADER;
    const reliableHeaderSize = sendReliableLength > 0 ? 2 + (isFragment ? 8 : 0) : 0; // +2 length, +8 fragment info

    let unreliableSize = unreliableData ? unreliableData.length : 0;

    // Check for overflow
    if (headerSize + reliableHeaderSize + sendReliableLength + unreliableSize > NetChan.MAX_MSGLEN) {
      unreliableSize = NetChan.MAX_MSGLEN - headerSize - reliableHeaderSize - sendReliableLength;
      // We truncate unreliable data if it doesn't fit with reliable data
      if (unreliableSize < 0) unreliableSize = 0;
    }

    const buffer = new ArrayBuffer(headerSize + reliableHeaderSize + sendReliableLength + unreliableSize);
    const view = new DataView(buffer);
    const result = new Uint8Array(buffer);

    // Write Header
    // Sequence
    let sequence = this.outgoingSequence;

    // Set reliable bit if we are sending reliable data
    if (sendReliableLength > 0) {
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
    if (sendReliableLength > 0) {
      // Write length of reliable data (2 bytes)
      // Extension: If length has high bit (0x8000), it's a fragment.
      let lengthField = sendReliableLength;
      if (isFragment) {
        lengthField |= 0x8000;
      }

      view.setUint16(offset, lengthField, true);
      offset += 2;

      if (isFragment) {
        // Write fragment info: 4 bytes start offset, 4 bytes total length
        view.setUint32(offset, fragmentStart, true);
        offset += 4;
        view.setUint32(offset, this.reliableLength, true);
        offset += 4;
      }

      // Copy data
      const reliableBuffer = this.reliableMessage.getBuffer();
      const reliableBytes = reliableBuffer.subarray(fragmentStart, fragmentStart + sendReliableLength);
      result.set(reliableBytes, offset);
      offset += sendReliableLength;
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
    if (packet.length < 4) {
      return null;
    }

    this.lastReceived = Date.now();

    const view = new DataView(packet.buffer, packet.byteOffset, packet.byteLength);
    const sequence = view.getUint32(0, true);

    // Handle connectionless packet (sequence -1)
    if (sequence === 0xFFFFFFFF) {
        return packet.subarray(4);
    }

    if (packet.length < NetChan.PACKET_HEADER) {
        return null;
    }

    const ack = view.getUint32(4, true);
    const qport = view.getUint16(8, true);

    if (this.qport !== qport) {
      return null;
    }

    // Check for duplicate or out of order
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
    // If the receiver has toggled their reliable bit, it means they got the WHOLE message
    if (this.reliableLength > 0) {
       const receivedAckBit = ackReliable ? 1 : 0;
       const currentReliableBit = this.outgoingReliableSequence & 1;

       if (receivedAckBit !== currentReliableBit) {
         // Acked!
         this.reliableLength = 0;
         this.reliableMessage.reset();
         this.outgoingReliableSequence ^= 1;
         this.fragmentSendOffset = 0; // Reset fragment offset
       }
    }

    // Handle incoming reliable data
    const hasReliableData = (sequence & 0x80000000) !== 0;
    const reliableSeqBit = (sequence & 0x40000000) !== 0 ? 1 : 0;

    let payloadOffset = NetChan.PACKET_HEADER;
    let reliableData: Uint8Array | null = null;

    if (hasReliableData) {
       if (payloadOffset + 2 > packet.byteLength) return null; // Malformed

       let reliableLen = view.getUint16(payloadOffset, true);
       payloadOffset += 2;

       const isFragment = (reliableLen & 0x8000) !== 0;
       reliableLen &= 0x7FFF;

       // Check if this is the expected reliable sequence
       const expectedBit = this.incomingReliableSequence & 1;

       if (reliableSeqBit === expectedBit) {
          // It's the sequence we are waiting for

          if (isFragment) {
             // Read fragment info
             if (payloadOffset + 8 > packet.byteLength) return null;
             const fragStart = view.getUint32(payloadOffset, true);
             payloadOffset += 4;
             const fragTotal = view.getUint32(payloadOffset, true);
             payloadOffset += 4;

             // Validate fragTotal against MAX_RELIABLE_BUFFER
             if (fragTotal > NetChan.MAX_RELIABLE_BUFFER) {
               console.warn(`NetChan: received invalid fragment total ${fragTotal} > ${NetChan.MAX_RELIABLE_BUFFER}`);
               return null;
             }

             // Initialize fragment buffer if needed
             if (!this.fragmentBuffer || this.fragmentBuffer.length !== fragTotal) {
                this.fragmentBuffer = new Uint8Array(fragTotal);
                this.fragmentLength = fragTotal;
                this.fragmentReceived = 0;
             }

             // Check for valid fragment offset
             if (payloadOffset + reliableLen > packet.byteLength) return null;
             const data = packet.subarray(payloadOffset, payloadOffset + reliableLen);

             // Only accept if it matches our expected offset (enforce in-order delivery for simplicity)
             // or check if we haven't received this part yet.
             // Since we use a simple 'fragmentReceived' counter, we effectively expect in-order delivery
             // of streams if we just use append logic.
             // BUT UDP can reorder.
             // To be robust, we should enforce strict ordering: fragStart must equal fragmentReceived.
             // If we miss a chunk, we ignore subsequent chunks until the missing one arrives (via retransmit loop).

             if (fragStart === this.fragmentReceived && fragStart + reliableLen <= fragTotal) {
               this.fragmentBuffer.set(data, fragStart);
               this.fragmentReceived += reliableLen;

               // Check if complete
               if (this.fragmentReceived >= fragTotal) {
                 reliableData = this.fragmentBuffer;
                 this.incomingReliableSequence++;
                 this.fragmentBuffer = null;
                 this.fragmentLength = 0;
                 this.fragmentReceived = 0;
               }
             }

          } else {
             // Not a fragment (standard)
             this.incomingReliableSequence++;
             if (payloadOffset + reliableLen > packet.byteLength) return null;
             reliableData = packet.slice(payloadOffset, payloadOffset + reliableLen);
          }
       }

       // Advance past reliable data regardless
       payloadOffset += reliableLen;
    }

    // Get unreliable data
    const unreliableData = packet.slice(payloadOffset);

    // Combine if we have reliable data
    if (reliableData && reliableData.length > 0) {
        const totalLen = reliableData.length + unreliableData.length;
        const result = new Uint8Array(totalLen);
        result.set(reliableData, 0);
        result.set(unreliableData, reliableData.length);
        return result;
    }

    if (unreliableData) {
      return unreliableData;
    }

    return new Uint8Array(0);
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
    if (this.reliableLength + 1 > NetChan.MAX_RELIABLE_BUFFER) {
      throw new Error('NetChan reliable buffer overflow');
    }
    this.reliableMessage.writeByte(value);
    this.reliableLength++;
  }

  /**
   * Writes a short to the reliable message buffer
   */
  writeReliableShort(value: number): void {
    if (this.reliableLength + 2 > NetChan.MAX_RELIABLE_BUFFER) {
      throw new Error('NetChan reliable buffer overflow');
    }
    this.reliableMessage.writeShort(value);
    this.reliableLength += 2;
  }

  /**
   * Writes a long to the reliable message buffer
   */
  writeReliableLong(value: number): void {
    if (this.reliableLength + 4 > NetChan.MAX_RELIABLE_BUFFER) {
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
    if (this.reliableLength + len > NetChan.MAX_RELIABLE_BUFFER) {
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
