
import { describe, it, expect, vi } from 'vitest';
import {
    simulateNetworkCondition,
    throttleBandwidth
} from '../src/index';

// Unit tests for E2E helpers (mocking Playwright)
describe('E2E Utilities', () => {
    it('should generate network conditions logic', async () => {
        const simulator = simulateNetworkCondition('slow');
        expect(simulator).toHaveProperty('apply');
        expect(simulator).toHaveProperty('clear');

        // Create a mock page object with CDPSession support
        const mockCDP = {
            send: vi.fn().mockResolvedValue(undefined)
        };
        const mockPage = {
            context: () => ({
                newCDPSession: vi.fn().mockResolvedValue(mockCDP)
            })
        };

        await simulator.apply(mockPage);
        expect(mockCDP.send).toHaveBeenCalledWith('Network.enable');
        expect(mockCDP.send).toHaveBeenCalledWith('Network.emulateNetworkConditions', expect.objectContaining({
            latency: expect.any(Number) // 400ish
        }));

        await simulator.clear(mockPage);
        expect(mockCDP.send).toHaveBeenCalledWith('Network.emulateNetworkConditions', expect.objectContaining({
            latency: 0
        }));
    });

    it('should throttle bandwidth', async () => {
        const mockCDP = {
            send: vi.fn().mockResolvedValue(undefined)
        };
        const mockPage = {
            context: () => ({
                newCDPSession: vi.fn().mockResolvedValue(mockCDP)
            })
        };

        const throttle = throttleBandwidth(1000);
        await throttle.applyCondition(mockPage);
        expect(mockCDP.send).toHaveBeenCalledWith('Network.emulateNetworkConditions', expect.objectContaining({
            downloadThroughput: 1000
        }));
    });
});
