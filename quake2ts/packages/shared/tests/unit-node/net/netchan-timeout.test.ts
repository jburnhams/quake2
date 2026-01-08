import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NetChan } from '../../../src/net/netchan.js';

describe('NetChan Timeout', () => {
  let netchan: NetChan;

  beforeEach(() => {
    netchan = new NetChan();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should detect when keepalive is needed', () => {
    // Initially fine (just sent in constructor)
    expect(netchan.needsKeepalive(Date.now())).toBe(false);

    // Advance time by 1.1s
    vi.advanceTimersByTime(1100);
    // Note: NetChan uses Date.now(), which is mocked by vi.useFakeTimers()

    expect(netchan.needsKeepalive(Date.now())).toBe(true);

    // After transmit, should be fine
    netchan.transmit();
    expect(netchan.needsKeepalive(Date.now())).toBe(false);
  });

  it('should detect timeouts', () => {
    expect(netchan.isTimedOut(Date.now())).toBe(false);

    // Default timeout is 30s
    vi.advanceTimersByTime(31000);

    expect(netchan.isTimedOut(Date.now())).toBe(true);

    // Custom timeout
    expect(netchan.isTimedOut(Date.now(), 60000)).toBe(false);
  });

  it('should reset timeout on receive', () => {
    // Packet with valid header
    const packet = new Uint8Array(10);
    const view = new DataView(packet.buffer);
    view.setUint32(0, 1, true); // sequence 1
    view.setUint16(8, netchan.qport, true); // matching qport

    // Wait almost 30s
    vi.advanceTimersByTime(29000);

    // Process packet
    netchan.process(packet);

    // Wait another 2s (total 31s since start, but only 2s since last packet)
    vi.advanceTimersByTime(2000);

    expect(netchan.isTimedOut(Date.now())).toBe(false);
  });
});
