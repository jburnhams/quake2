import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OptimalClipFinder } from '../../src/demo/optimalClipFinder.js';
import { VisibilityTimeline, FrameResources } from '../../src/assets/visibilityAnalyzer.js';
import { DemoEventType } from '../../src/demo/analysis.js';

describe('OptimalClipFinder', () => {
    let finder: OptimalClipFinder;

    beforeEach(() => {
        finder = new OptimalClipFinder();
    });

    const createTimeline = (data: {time: number, resources: string[]}[]): VisibilityTimeline => {
        const timeline: VisibilityTimeline = {
            frames: new Map(),
            time: new Map()
        };

        data.forEach((d, i) => {
            const res: FrameResources = {
                models: new Set(d.resources.filter(r => r.startsWith('m'))),
                sounds: new Set(d.resources.filter(r => r.startsWith('s'))),
                textures: new Set(d.resources.filter(r => r.startsWith('t'))),
                loaded: new Set(),
                visible: new Set(),
                audible: new Set()
            };
            timeline.frames.set(i, res);
            timeline.time.set(d.time, res);
        });

        return timeline;
    };

    it('should find a minimal window in a simple timeline', () => {
        const data = [
            { time: 0, resources: ['m1', 'm2', 'm3'] },
            { time: 5, resources: ['m1', 'm2'] },
            { time: 10, resources: ['m1'] },
            { time: 15, resources: ['m1'] },
            { time: 20, resources: ['m1', 'm2', 'm3', 'm4'] }
        ];

        const timeline = createTimeline(data);
        const window = finder.findMinimalWindow(timeline, 5);

        expect(window.start.type).toBe('time');
        expect((window.start as any).seconds).toBe(10);
        expect(window.resourceCount).toBe(1);
        expect(window.resources.has('m1')).toBe(true);
    });

    it('should handle tie breaking (first occurrence)', () => {
        const data = [
            { time: 0, resources: ['m1'] },
            { time: 10, resources: ['m1'] },
        ];
        const timeline = createTimeline(data);

        const window = finder.findMinimalWindow(timeline, 5);
        expect((window.start as any).seconds).toBe(0);
    });

    it('should calculate union of resources in window', () => {
        const data = [
            { time: 0, resources: ['m1'] },
            { time: 1, resources: ['m2'] },
            { time: 2, resources: ['m3', 'm4', 'm5'] }
        ];
        const timeline = createTimeline(data);

        const window = finder.findMinimalWindow(timeline, 1.5);

        expect((window.start as any).seconds).toBe(0);
        expect(window.resourceCount).toBe(2);
        expect(window.resources.has('m1')).toBe(true);
        expect(window.resources.has('m2')).toBe(true);
    });

    it('should throw on empty timeline', () => {
        const timeline: VisibilityTimeline = { frames: new Map(), time: new Map() };
        expect(() => finder.findMinimalWindow(timeline, 10)).toThrow();
    });

    it('should support scoring by size', () => {
        const data = [
            { time: 0, resources: ['m1', 'm2'] }, // 2 resources
            { time: 10, resources: ['m3'] }, // 1 resource
        ];
        const timeline = createTimeline(data);

        const sizes = new Map([
            ['m1', 10],
            ['m2', 10], // Total 20
            ['m3', 100] // Total 100
        ]);

        const countWindow = finder.findMinimalWindow(timeline, 1, { scoringMode: 'count' });
        expect((countWindow.start as any).seconds).toBe(10);

        const sizeWindow = finder.findMinimalWindow(timeline, 1, { scoringMode: 'size', resourceSizes: sizes });
        expect((sizeWindow.start as any).seconds).toBe(0);
    });

    it('should support scoring by action', () => {
        const data = [
            { time: 0, resources: ['m1'] },
            { time: 10, resources: ['m1'] },
        ];
        const timeline = createTimeline(data);

        const mockAnalyzer: any = {
            analyze: () => ({
                events: [
                    { type: DemoEventType.Death, time: 10, frame: 10 }
                ]
            })
        };

        const countWindow = finder.findMinimalWindow(timeline, 5, { scoringMode: 'count' });
        expect((countWindow.start as any).seconds).toBe(0);

        const actionWindow = finder.findMinimalWindow(timeline, 5, { scoringMode: 'action', analyzer: mockAnalyzer });
        expect((actionWindow.start as any).seconds).toBe(10);
        expect(actionWindow.score).toBe(-10);
    });

    it('should return multiple non-overlapping optimal windows', async () => {
        // 0s: Low
        // 10s: High
        // 20s: Low
        const data = [
            { time: 0, resources: ['m1'] },
            { time: 10, resources: ['m1', 'm2', 'm3'] },
            { time: 20, resources: ['m1'] }
        ];
        const timeline = createTimeline(data);

        const windows = await finder.findOptimalWindows(timeline, { durationRange: [5, 5], topN: 2 });

        expect(windows.length).toBe(2);
        expect((windows[0].start as any).seconds).toBe(0);
        expect((windows[1].start as any).seconds).toBe(20);
        expect(windows[0].resourceCount).toBe(1);
        expect(windows[1].resourceCount).toBe(1);
    });

    it('should respect maxResources constraint', async () => {
        const data = [
            { time: 0, resources: ['m1'] },
            { time: 10, resources: ['m1', 'm2', 'm3'] },
        ];
        const timeline = createTimeline(data);

        const windows = await finder.findOptimalWindows(timeline, { durationRange: [5, 5], maxResources: 2 });

        expect(windows.length).toBe(1);
        expect((windows[0].start as any).seconds).toBe(0);
        // Window at 10s has 3 resources, should be filtered out
    });

    it('should respect time range search', () => {
        const data = [
            { time: 0, resources: ['m1'] }, // Low
            { time: 10, resources: ['m1'] }, // Low
            { time: 20, resources: ['m1', 'm2'] } // High
        ];
        const timeline = createTimeline(data);

        // Search only 15-25s. Best in that range is at 20s (even if worse than 0s)
        const window = finder.findMinimalWindowInRange(
            timeline,
            5,
            { type: 'time', seconds: 15 },
            { type: 'time', seconds: 25 }
        );

        expect((window.start as any).seconds).toBe(20);
    });
});
