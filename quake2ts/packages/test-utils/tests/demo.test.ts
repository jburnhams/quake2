
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    createStorageTestScenario,
    setupMockAudioContext,
    teardownMockAudioContext,
    captureAudioEvents,
    createMockAudioContext
} from '../src/index';

describe('Storage Helpers', () => {
    it('should handle localStorage scenario', () => {
        const scenario = createStorageTestScenario('local');
        scenario.populate({ 'key1': 'value1' });
        expect(scenario.verify('key1', 'value1')).toBe(true);
        expect(scenario.verify('key1', 'wrong')).toBe(false);
    });

    it('should handle sessionStorage scenario', () => {
        const scenario = createStorageTestScenario('session');
        scenario.populate({ 'sess1': 'val1' });
        expect(scenario.verify('sess1', 'val1')).toBe(true);
    });

    it('should handle indexedDB scenario', async () => {
        const scenario = createStorageTestScenario('indexed');
        await scenario.populate({ 'idb1': 'data1' });
        const result = await scenario.verify('idb1', 'data1');
        expect(result).toBe(true);
    });
});

describe('Audio Helpers', () => {
    beforeEach(() => {
        // Need to ensure global window exists for setupMockAudioContext to attach if we are in node environment
        if (typeof global.window === 'undefined') {
            (global as any).window = global;
        }
        setupMockAudioContext();
    });

    afterEach(() => {
        teardownMockAudioContext();
    });

    it('should use manually created mock context for event capturing', () => {
        const context = createMockAudioContext();
        context.createGain();

        const events = captureAudioEvents(context);
        expect(events).toHaveLength(1);
        expect(events[0].type).toBe('createGain');
    });
});
