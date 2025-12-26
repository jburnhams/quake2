import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DemoPlaybackController } from '../../src/demo/playback.js';
import { DemoReader } from '../../src/demo/demoReader.js';
import { NetworkMessageParser } from '../../src/demo/parser.js';

describe('DemoPlaybackController Offset Parameters', () => {
    let controller: DemoPlaybackController;

    beforeEach(() => {
        vi.restoreAllMocks();

        // Spy on DemoReader prototype methods
        vi.spyOn(DemoReader.prototype, 'getMessageCount').mockReturnValue(20);
        vi.spyOn(DemoReader.prototype, 'seekToMessage').mockReturnValue(true);
        vi.spyOn(DemoReader.prototype, 'reset').mockImplementation(() => {});

        // Setup a sequence for readNextBlock
        const readNextBlockSpy = vi.spyOn(DemoReader.prototype, 'readNextBlock');
        for (let i = 0; i < 20; i++) {
            readNextBlockSpy.mockReturnValueOnce({
                length: 10,
                data: {} as any
            });
        }
        readNextBlockSpy.mockReturnValue(null);

        // Mock NetworkMessageParser
        vi.spyOn(NetworkMessageParser.prototype, 'parseMessage').mockImplementation(() => {});
        vi.spyOn(NetworkMessageParser.prototype, 'setProtocolVersion').mockImplementation(() => {});

        controller = new DemoPlaybackController();
        controller.loadDemo(new ArrayBuffer(100));
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should playRange and stop at end frame', () => {
        const start = 5;
        const end = 10;

        controller.playRange({
            startOffset: start,
            type: 'frame'
        }, {
            endOffset: end,
            type: 'frame'
        });

        let iterations = 0;
        while (controller.getState() === 1 && iterations < 100) { // 1 = Playing
            controller.update(0.1);
            iterations++;
        }

        expect(controller.getState()).not.toBe(1); // Not Playing
        expect(controller.getCurrentFrame()).toBeGreaterThanOrEqual(end);
    });

    it('should stop playback when stopAtTime is reached', () => {
        const start = 0;
        const endTime = 1.0; // 10 frames at 0.1s

        controller.playRange({
            startOffset: start,
            type: 'frame'
        }, {
            endOffset: endTime,
            type: 'time'
        });

        let iterations = 0;
        while (controller.getState() === 1 && iterations < 100) {
            controller.update(0.1);
            iterations++;
        }

        expect(controller.getState()).not.toBe(1);
        expect(controller.getCurrentTime()).toBeGreaterThanOrEqual(endTime);
    });
});
