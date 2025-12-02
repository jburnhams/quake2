import { describe, it, expect } from 'vitest';
import { NetChan } from '../../src/net/netchan';

describe('NetChan Timeout', () => {
  it('should detect timeout', () => {
    const netchan = new NetChan();
    const now = Date.now();

    // Simulate last received a long time ago
    netchan.lastReceived = now - 31000;

    // Default check
    expect(netchan.isTimedOut(now, 30000)).toBe(true);

    // Within limit
    netchan.lastReceived = now - 29000;
    expect(netchan.isTimedOut(now, 30000)).toBe(false);
  });

  it('should request keepalive', () => {
    const netchan = new NetChan();
    const now = Date.now();

    // Just sent
    netchan.lastSent = now;
    expect(netchan.needsKeepalive(now)).toBe(false);

    // Sent a while ago
    netchan.lastSent = now - 1100;
    expect(netchan.needsKeepalive(now)).toBe(true);
  });

  it('should update timestamps on activity', () => {
    const netchan = new NetChan();
    const past = Date.now() - 5000;

    netchan.lastReceived = past;
    netchan.lastSent = past;

    // Transmit updates lastSent
    netchan.transmit();
    expect(netchan.lastSent).toBeGreaterThan(past);

    // Process updates lastReceived
    const validPacket = new Uint8Array(10); // Minimum header size
    netchan.process(validPacket);
    expect(netchan.lastReceived).toBeGreaterThan(past);
  });
});
