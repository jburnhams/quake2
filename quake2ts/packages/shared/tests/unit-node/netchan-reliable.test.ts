import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NetChan } from '../../src/net/netchan.js';

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

// Netchan_Transmit (qcommon/net_chan.c): a reliable message goes out once, and again only after
// the other side has acknowledged a later packet without taking it.
describe('NetChan reliable resend', () => {
  const reliableIn = (packet: Uint8Array) =>
    (new DataView(packet.buffer, packet.byteOffset).getUint32(0, true) & 0x80000000) !== 0;

  const pair = () => {
    const a = new NetChan();
    const b = new NetChan();
    a.setup(7);
    b.setup(7);
    return { a, b };
  };

  it('sends a reliable message once while it waits for the answer', () => {
    const { a } = pair();
    a.writeReliableByte(5);
    expect(reliableIn(a.transmit())).toBe(true);
    for (let i = 0; i < 5; i++) expect(reliableIn(a.transmit())).toBe(false);
  });

  it('sends it again once a later packet is acknowledged without it', () => {
    const { a, b } = pair();
    a.writeReliableByte(5);
    a.transmit(); // lost
    // Packets 2 and 3 arrive and are acknowledged; neither carries the message.
    for (let i = 0; i < 2; i++) {
      const p = a.transmit();
      expect(reliableIn(p)).toBe(false);
      b.process(p);
      a.process(b.transmit());
    }
    const resend = a.transmit();
    expect(reliableIn(resend)).toBe(true);
    expect(b.process(resend)).toEqual(new Uint8Array([5]));
  });

  it('keeps bytes written while a message is in flight for the next message', () => {
    const { a, b } = pair();
    a.writeReliableByte(1);
    const first = a.transmit();
    a.writeReliableByte(2);
    expect(b.process(first)).toEqual(new Uint8Array([1]));
    a.process(b.transmit()); // acknowledges the first message
    expect(a.reliableLength).toBe(1);
    const second = a.transmit();
    expect(reliableIn(second)).toBe(true);
    expect(b.process(second)).toEqual(new Uint8Array([2]));
  });

  it('counts the packets lost before each one that arrives (chan->dropped)', () => {
    const { a, b } = pair();
    b.process(a.transmit());
    expect(b.dropped).toBe(0);
    a.transmit();
    a.transmit();
    b.process(a.transmit());
    expect(b.dropped).toBe(2);
  });
});
