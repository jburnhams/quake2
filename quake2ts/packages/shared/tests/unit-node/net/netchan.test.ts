import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NetChan } from '../../../src/net/netchan.js';

describe('NetChan', () => {
  let netchan: NetChan;

  beforeEach(() => {
    netchan = new NetChan();
  });

  describe('Initialization', () => {
    it('should initialize with sequence numbers at 0', () => {
      expect(netchan.incomingSequence).toBe(0);
      expect(netchan.outgoingSequence).toBe(0);
      expect(netchan.incomingAcknowledged).toBe(0);
      expect(netchan.incomingReliableSequence).toBe(0);
      expect(netchan.outgoingReliableSequence).toBe(0);
    });

    it('should assign a random qport', () => {
      expect(netchan.qport).toBeGreaterThanOrEqual(0);
      expect(netchan.qport).toBeLessThan(65536);
    });

    it('should initialize reliable message buffer', () => {
      expect(netchan.reliableLength).toBe(0);
      expect(netchan.canSendReliable()).toBe(true);
    });

    it('should allow setup with specific qport', () => {
      netchan.setup(12345);
      expect(netchan.qport).toBe(12345);
    });
  });

  describe('Reset', () => {
    it('should reset all state', () => {
      netchan.outgoingSequence = 100;
      netchan.incomingSequence = 50;
      netchan.writeReliableString('test');

      netchan.reset();

      expect(netchan.outgoingSequence).toBe(0);
      expect(netchan.incomingSequence).toBe(0);
      expect(netchan.reliableLength).toBe(0);
      expect(netchan.canSendReliable()).toBe(true);
    });
  });

  describe('Reliable Buffer', () => {
    it('should write bytes', () => {
      netchan.writeReliableByte(0xAB);
      expect(netchan.reliableLength).toBe(1);
      const data = netchan.getReliableData();
      expect(data[0]).toBe(0xAB);
    });

    it('should write shorts', () => {
      netchan.writeReliableShort(0x1234);
      expect(netchan.reliableLength).toBe(2);
      const data = netchan.getReliableData();
      const view = new DataView(data.buffer);
      expect(view.getUint16(0, true)).toBe(0x1234);
    });

    it('should write longs', () => {
      netchan.writeReliableLong(0x12345678);
      expect(netchan.reliableLength).toBe(4);
      const data = netchan.getReliableData();
      const view = new DataView(data.buffer);
      expect(view.getUint32(0, true)).toBe(0x12345678);
    });

    it('should write strings', () => {
      netchan.writeReliableString('hello');
      // 'hello' is 5 bytes + 1 null terminator = 6 bytes
      expect(netchan.reliableLength).toBe(6);
    });

    it('should throw on overflow', () => {
      // Fill buffer close to limit
      // With fragmentation support, the buffer is MAX_RELIABLE_BUFFER (256KB)
      const maxLen = NetChan.MAX_RELIABLE_BUFFER;

      // We can't easily write 256KB bytes one by one in a test without loop
      // But we can simulate it by hacking reliableLength for this test
      netchan.reliableLength = maxLen;

      expect(() => netchan.writeReliableByte(1)).toThrow(/overflow/);
    });
  });
});
