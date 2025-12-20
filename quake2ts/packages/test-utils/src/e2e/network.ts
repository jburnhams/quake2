
export interface NetworkSimulator {
    apply(page: any): Promise<void>;
    clear(page: any): Promise<void>;
}

export type NetworkCondition = 'good' | 'slow' | 'unstable' | 'offline';

export interface NetworkConfig {
    offline: boolean;
    downloadThroughput: number; // bytes/sec
    uploadThroughput: number; // bytes/sec
    latency: number; // ms
}

const CONDITIONS: Record<NetworkCondition, NetworkConfig> = {
    'good': {
        offline: false,
        downloadThroughput: 10 * 1024 * 1024, // 10 Mbps
        uploadThroughput: 5 * 1024 * 1024,   // 5 Mbps
        latency: 20
    },
    'slow': {
        offline: false,
        downloadThroughput: 500 * 1024, // 500 Kbps
        uploadThroughput: 500 * 1024,
        latency: 400
    },
    'unstable': {
        offline: false,
        downloadThroughput: 1 * 1024 * 1024,
        uploadThroughput: 1 * 1024 * 1024,
        latency: 100
    },
    'offline': {
        offline: true,
        downloadThroughput: 0,
        uploadThroughput: 0,
        latency: 0
    }
};

/**
 * Simulates network conditions using Chrome DevTools Protocol (CDP) via Playwright.
 */
export function simulateNetworkCondition(condition: NetworkCondition): NetworkSimulator {
    const config = CONDITIONS[condition];
    return createCustomNetworkCondition(config.latency, 0, 0, config);
}

/**
 * Creates a custom network condition simulator.
 *
 * @param latency Latency in milliseconds
 * @param jitter Approximate jitter (variation in latency) - Note: CDP doesn't support jitter natively.
 * @param packetLoss Packet loss percentage (0-100) - Ignored for basic CDP emulation.
 */
export function createCustomNetworkCondition(
    latency: number,
    jitter: number = 0,
    packetLoss: number = 0,
    baseConfig?: NetworkConfig
): NetworkSimulator {
    return {
        async apply(page: any) {
            const client = await page.context().newCDPSession(page);
            await client.send('Network.enable');
            await client.send('Network.emulateNetworkConditions', {
                offline: baseConfig?.offline || false,
                latency: latency + (Math.random() * jitter),
                downloadThroughput: baseConfig?.downloadThroughput || -1,
                uploadThroughput: baseConfig?.uploadThroughput || -1,
            });
        },
        async clear(page: any) {
            const client = await page.context().newCDPSession(page);
            await client.send('Network.emulateNetworkConditions', {
                offline: false,
                latency: 0,
                downloadThroughput: -1,
                uploadThroughput: -1,
            });
        }
    };
}

/**
 * Throttles bandwidth for the given page.
 */
export async function throttleBandwidth(page: any, bytesPerSecond: number) {
    const simulator = createCustomNetworkCondition(0, 0, 0, {
        offline: false,
        latency: 0,
        downloadThroughput: bytesPerSecond,
        uploadThroughput: bytesPerSecond
    });
    await simulator.apply(page);
}
