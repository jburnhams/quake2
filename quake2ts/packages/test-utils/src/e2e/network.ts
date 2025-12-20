export interface NetworkCondition {
  latency: number; // ms
  jitter: number; // ms
  packetLoss: number; // 0-1
  bandwidth?: number; // bytes per second
}

export interface NetworkSimulator {
  condition: NetworkCondition;
  delayPacket(packet: any): Promise<void>;
  shouldDropPacket(): boolean;
  apply(page: any): Promise<void>; // Alias for applyCondition for tests
  applyCondition(page: any): Promise<void>; // For Playwright
  clear(page: any): Promise<void>;
}

export const NetworkConditions = {
  GOOD: { latency: 20, jitter: 5, packetLoss: 0 },
  SLOW: { latency: 150, jitter: 20, packetLoss: 0.01 },
  UNSTABLE: { latency: 50, jitter: 100, packetLoss: 0.05 },
  OFFLINE: { latency: 0, jitter: 0, packetLoss: 1.0 }
};

export function createNetworkSimulator(condition: NetworkCondition): NetworkSimulator {
  const applyCondition = async (page: any) => {
      if (!page || !page.context || !page.context().newCDPSession) return;

      const client = await page.context().newCDPSession(page);

      if (condition.packetLoss === 1.0) {
          await client.send('Network.enable');
          await client.send('Network.emulateNetworkConditions', {
            offline: true,
            latency: 0,
            downloadThroughput: 0,
            uploadThroughput: 0
          });
          return;
      }

      await client.send('Network.enable');
      await client.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: condition.latency,
        downloadThroughput: condition.bandwidth ?? -1,
        uploadThroughput: condition.bandwidth ?? -1
      });
  };

  const clear = async (page: any) => {
      if (!page || !page.context || !page.context().newCDPSession) return;
      const client = await page.context().newCDPSession(page);
      await client.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 0,
        downloadThroughput: -1,
        uploadThroughput: -1
      });
  };

  return {
    condition,

    async delayPacket(packet: any) {
      if (this.condition.latency > 0) {
        const jitter = (Math.random() - 0.5) * 2 * this.condition.jitter;
        const delay = Math.max(0, this.condition.latency + jitter);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    },

    shouldDropPacket() {
      return Math.random() < this.condition.packetLoss;
    },

    applyCondition,
    apply: applyCondition, // Alias
    clear
  };
}

export function simulateNetworkCondition(condition: 'good' | 'slow' | 'unstable' | 'offline'): NetworkSimulator {
  const map = {
    'good': NetworkConditions.GOOD,
    'slow': NetworkConditions.SLOW,
    'unstable': NetworkConditions.UNSTABLE,
    'offline': NetworkConditions.OFFLINE
  };
  return createNetworkSimulator(map[condition]);
}

export function createCustomNetworkCondition(latency: number, jitter: number, packetLoss: number): NetworkSimulator {
  return createNetworkSimulator({ latency, jitter, packetLoss });
}

export function throttleBandwidth(bytesPerSecond: number): NetworkSimulator {
    return createNetworkSimulator({ ...NetworkConditions.GOOD, bandwidth: bytesPerSecond });
}
