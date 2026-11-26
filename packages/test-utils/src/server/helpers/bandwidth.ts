import { Client, ClientFrame } from '@quake2ts/server';

export interface RateLimiter {
  bytesPerSecond: number;
  allow(bytes: number): boolean;
  update(deltaSeconds: number): void;
  reset(): void;
  getUsage(): number;
}

export interface Message {
  data: Uint8Array;
  size: number;
  timestamp: number;
}

export interface BandwidthScenario {
  bandwidth: number;
  clients: Client[];
  duration: number;
  totalBytesSent: number;
  totalBytesReceived: number;
  droppedPackets: number;
}

/**
 * Creates a mock rate limiter for bandwidth testing
 * @param bytesPerSecond - Maximum bytes per second allowed
 */
export function createMockRateLimiter(bytesPerSecond: number): RateLimiter {
  let bucket = bytesPerSecond;
  const maxBucket = bytesPerSecond; // Max burst size equal to 1 second of bandwidth
  let usage = 0;

  return {
    bytesPerSecond,
    allow(bytes: number): boolean {
      if (bucket >= bytes) {
        bucket -= bytes;
        usage += bytes;
        return true;
      }
      return false;
    },
    update(deltaSeconds: number): void {
      bucket += bytesPerSecond * deltaSeconds;
      if (bucket > maxBucket) {
        bucket = maxBucket;
      }
    },
    reset(): void {
      bucket = maxBucket;
      usage = 0;
    },
    getUsage(): number {
      return usage;
    }
  };
}

/**
 * Simulates bandwidth limiting on a stream of messages
 * @param messages - Array of messages to process
 * @param bandwidth - Bandwidth limit in bytes per second
 * @returns Filtered array of messages that passed the bandwidth check
 */
export function simulateBandwidthLimit(messages: Message[], bandwidth: number): Message[] {
  const limiter = createMockRateLimiter(bandwidth);
  const result: Message[] = [];
  let lastTime = messages.length > 0 ? messages[0].timestamp : 0;

  for (const msg of messages) {
    const delta = (msg.timestamp - lastTime) / 1000;
    if (delta > 0) {
      limiter.update(delta);
    }
    lastTime = msg.timestamp;

    if (limiter.allow(msg.size)) {
      result.push(msg);
    }
  }

  return result;
}

/**
 * Calculates the size of a client snapshot in bytes
 * @param snapshot - The client frame snapshot
 */
export function measureSnapshotSize(snapshot: ClientFrame): number {
  let size = 0;

  // Area bits
  size += snapshot.areaBytes;

  // Player state (approximate based on struct size or serialization)
  // This is an estimation, as actual network serialization compresses this
  size += 200; // Baseline size for PlayerState

  // Entities
  // Each EntityState is approx 20-30 bytes compressed
  size += snapshot.entities.length * 20;

  return size;
}

/**
 * Creates a scenario for testing bandwidth limits with multiple clients
 * @param bandwidth - Bandwidth limit per client or total
 * @param numClients - Number of clients to simulate
 */
export function createBandwidthTestScenario(bandwidth: number, numClients: number): BandwidthScenario {
  const clients: Client[] = [];
  // Populate with mock clients if needed (currently creating dummy objects to satisfy type)
  // In a real scenario we might use createClient factory but that requires net driver
  // For now we assume caller will populate fully or we return empty array if 0

  return {
    bandwidth,
    clients,
    duration: 0,
    totalBytesSent: 0,
    totalBytesReceived: 0,
    droppedPackets: 0
  };
}
