import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NetChan } from '../../../src/net/netchan.js';

describe('NetChan Reliable Queue', () => {
  let netchan: NetChan;

  beforeEach(() => {
    netchan = new NetChan();
  });

  it('should report canSendReliable based on buffer state', () => {
    expect(netchan.canSendReliable()).toBe(true);

    netchan.writeReliableByte(1);
    expect(netchan.canSendReliable()).toBe(false); // Has pending data

    // Simulate ACK clearing it
    netchan.reliableLength = 0;
    expect(netchan.canSendReliable()).toBe(true);
  });

  it('should allow clearing reliable buffer manually (e.g. on reset)', () => {
    netchan.writeReliableByte(1);
    netchan.reset();
    expect(netchan.canSendReliable()).toBe(true);
    expect(netchan.reliableLength).toBe(0);
  });

  it('should retrieve correct reliable data buffer', () => {
     netchan.writeReliableByte(10);
     netchan.writeReliableByte(20);

     const data = netchan.getReliableData();
     expect(data.length).toBe(2);
     expect(data[0]).toBe(10);
     expect(data[1]).toBe(20);
  });

  it('should return empty buffer if no reliable data', () => {
     const data = netchan.getReliableData();
     expect(data.length).toBe(0);
  });
});
