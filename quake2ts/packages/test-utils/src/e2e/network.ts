export type NetworkCondition = 'good' | 'slow' | 'unstable' | 'offline' | 'custom';

export interface NetworkSimulator {
  latency: number; // ms
  jitter: number; // ms
  packetLoss: number; // percentage 0-1
  bandwidth: number; // bytes per second
}

/**
 * Simulates network conditions.
 */
export function simulateNetworkCondition(condition: NetworkCondition): NetworkSimulator {
  switch (condition) {
    case 'good':
      return { latency: 20, jitter: 5, packetLoss: 0, bandwidth: 10 * 1024 * 1024 };
    case 'slow':
      return { latency: 150, jitter: 20, packetLoss: 0.01, bandwidth: 1 * 1024 * 1024 };
    case 'unstable':
      return { latency: 100, jitter: 100, packetLoss: 0.05, bandwidth: 512 * 1024 };
    case 'offline':
      return { latency: 0, jitter: 0, packetLoss: 1, bandwidth: 0 };
    case 'custom':
    default:
      return { latency: 0, jitter: 0, packetLoss: 0, bandwidth: Infinity };
  }
}

/**
 * Creates a custom network condition.
 */
export function createCustomNetworkCondition(latency: number, jitter: number, packetLoss: number): NetworkSimulator {
  return {
    latency,
    jitter,
    packetLoss,
    bandwidth: Infinity // Default to unlimited unless specified
  };
}

/**
 * Helper to throttle bandwidth (e.g. for Playwright).
 */
export function throttleBandwidth(bytesPerSecond: number): void {
  // This function would interface with Playwright's CDPSession in an E2E test.
  // It returns void here as a placeholder for the logic to be used within a test context.
}
