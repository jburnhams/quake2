import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResourceVisibilityAnalyzer } from '../../src/assets/visibilityAnalyzer.js';

describe('ResourceVisibilityAnalyzer', () => {
    let analyzer: ResourceVisibilityAnalyzer;

    beforeEach(() => {
        analyzer = new ResourceVisibilityAnalyzer();
    });

    it('should initialize correctly', () => {
        expect(analyzer).toBeDefined();
    });

    it('should return empty timeline for empty demo', async () => {
        const demo = new Uint8Array(0);
        // This might fail if DemoReader expects header, so we might need a minimal valid demo buffer
        // DemoReader expects at least something? Or handles empty?
        // DemoReader scan checks size. If 0, no messages.

        // However, demo buffer usually passed as ArrayBuffer.
        // If we pass empty array, DemoReader might handle it gracefully or throw.
        // Let's create a minimal valid demo (just EOF).
        const buffer = new ArrayBuffer(4);
        const view = new DataView(buffer);
        view.setInt32(0, -1, true); // EOF

        const timeline = await analyzer.analyzeDemo(new Uint8Array(buffer));
        expect(timeline.frames.size).toBe(0);
    });
});
