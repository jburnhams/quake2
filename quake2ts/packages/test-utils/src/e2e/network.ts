export interface NetworkCondition {
    latency: number; // ms
    jitter: number; // ms
    packetLoss: number; // 0-1
    bandwidth?: number; // bytes per second
}

export interface NetworkSimulator {
    condition: NetworkCondition;
    apply(target: any): Promise<any>;
    reset(target?: any): Promise<void>;
    clear(target?: any): Promise<void>; // Alias for reset/compatibility
}

async function applyToCDP(target: any, condition: NetworkCondition) {
    let client = target;
    // If target is a Page (has context()), get CDP session
    if (target && typeof target.context === 'function') {
        try {
            client = await target.context().newCDPSession(target);
        } catch (e) {
            // ignore
        }
    }

    if (client && typeof client.send === 'function') {
        await client.send('Network.enable');
        await client.send('Network.emulateNetworkConditions', {
            offline: condition.packetLoss >= 1,
            downloadThroughput: condition.bandwidth || -1,
            uploadThroughput: condition.bandwidth || -1,
            latency: condition.latency + (condition.jitter / 2) // Approximate avg latency
        });
        return true;
    }
    return false;
}

export function simulateNetworkCondition(conditionType: 'good' | 'slow' | 'unstable' | 'offline'): NetworkSimulator {
    let condition: NetworkCondition;

    switch (conditionType) {
        case 'good':
            condition = { latency: 20, jitter: 5, packetLoss: 0, bandwidth: -1 };
            break;
        case 'slow':
            condition = { latency: 150, jitter: 30, packetLoss: 0.01, bandwidth: 500 * 1024 };
            break;
        case 'unstable':
            condition = { latency: 100, jitter: 100, packetLoss: 0.05, bandwidth: -1 };
            break;
        case 'offline':
            condition = { latency: 0, jitter: 0, packetLoss: 1, bandwidth: 0 };
            break;
    }

    const reset = async (target?: any) => {
        if (target) {
             await applyToCDP(target, { latency: 0, jitter: 0, packetLoss: 0, bandwidth: -1 });
        }
    };

    return {
        condition,
        apply: async (target: any) => {
            // Try to apply to CDP first
            if (await applyToCDP(target, condition)) {
                return target;
            }

            // Fallback for non-CDP targets (simple delay simulation)
            if (Math.random() < condition.packetLoss) {
                return null; // Lost
            }
            const delay = condition.latency + (Math.random() * condition.jitter);
            await new Promise(resolve => setTimeout(resolve, delay));
            return target;
        },
        reset,
        clear: reset
    };
}

export function createCustomNetworkCondition(latency: number, jitter: number, packetLoss: number): NetworkSimulator {
    const condition = { latency, jitter, packetLoss };
    const reset = async (target?: any) => {
          if (target) {
             await applyToCDP(target, { latency: 0, jitter: 0, packetLoss: 0, bandwidth: -1 });
        }
    };
    return {
        condition,
        apply: async (target: any) => {
             if (await applyToCDP(target, condition)) {
                return target;
            }
            if (Math.random() < condition.packetLoss) {
                return null;
            }
            const delay = condition.latency + (Math.random() * condition.jitter);
            await new Promise(resolve => setTimeout(resolve, delay));
            return target;
        },
        reset,
        clear: reset
    };
}

/**
 * Throttles network bandwidth for a page/client.
 * If passed a CDPSession/Playwright Page, it will apply settings.
 * For test utility purposes without Playwright dependency, it does nothing or mocks behavior.
 */
export async function throttleBandwidth(target: any, bytesPerSecond: number): Promise<void> {
    // If target looks like a Playwright page or CDP session
    if (target && typeof target.send === 'function') {
        // CDPSession or similar
         await target.send('Network.emulateNetworkConditions', {
            offline: false,
            downloadThroughput: bytesPerSecond,
            uploadThroughput: bytesPerSecond,
            latency: 0
        });
    } else if (target && typeof target.context === 'function') {
        // Playwright page (needs CDP session)
        try {
            const client = await target.context().newCDPSession(target);
            await client.send('Network.emulateNetworkConditions', {
                offline: false,
                downloadThroughput: bytesPerSecond,
                uploadThroughput: bytesPerSecond,
                latency: 0
            });
        } catch (e) {
            // Ignore if not a page
        }
    }
}
