import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResourceVisibilityAnalyzer, VisibilityTimeline } from '@quake2ts/engine/assets/visibilityAnalyzer.js';
import { DemoWriter } from '@quake2ts/engine/demo/demoWriter.js';
import { MessageWriter } from '@quake2ts/engine/demo/writer.js';
import { FrameData, createEmptyProtocolPlayerState } from '@quake2ts/engine/demo/parser.js';
import { ConfigStringIndex } from '@quake2ts/shared';

describe('ResourceVisibilityAnalyzer', () => {
    let analyzer: ResourceVisibilityAnalyzer;

    beforeEach(() => {
        analyzer = new ResourceVisibilityAnalyzer();
    });

    // Helper to create a minimal demo with config strings and frames
    const createTestDemo = (): Uint8Array => {
        const writer = new DemoWriter();
        const proto = 34;
        const msgWriter = new MessageWriter();

        // 1. ServerData
        msgWriter.writeServerData(proto, 1, 0, 'baseq2', 0, 'q2dm1');

        // 2. ConfigStrings (Models and Sounds)
        msgWriter.writeConfigString(ConfigStringIndex.Models + 0, 'players/male/tris.md2');
        msgWriter.writeConfigString(ConfigStringIndex.Sounds + 0, 'weapons/railgf1a.wav');

        writer.writeBlock(msgWriter.getData());

        // 3. Frame 1: Entity using Model 1
        const frameWriter = new MessageWriter();
        const frame1: FrameData = {
            serverFrame: 1,
            deltaFrame: -1,
            surpressCount: 0,
            areaBytes: 0,
            areaBits: new Uint8Array(0),
            playerState: createEmptyProtocolPlayerState(),
            packetEntities: {
                delta: false,
                entities: [
                    {
                        number: 1,
                        modelindex: 1,
                        modelindex2: 0,
                        modelindex3: 0,
                        modelindex4: 0,
                        frame: 0,
                        skinnum: 0,
                        effects: 0,
                        renderfx: 0,
                        origin: {x: 100, y: 100, z: 0},
                        angles: {x: 0, y: 0, z: 0},
                        old_origin: {x: 100, y: 100, z: 0},
                        sound: 0,
                        event: 0,
                        solid: 0,
                        bits: 0,
                        bitsHigh: 0
                    }
                ]
            }
        };
        frameWriter.writeFrame(frame1, proto);
        writer.writeBlock(frameWriter.getData());

        // 4. Frame 2: Sound event
        const frameWriter2 = new MessageWriter();
        frameWriter2.writeSound(
            0, 1, 1, 1, 0, 1, {x: 100, y: 100, z: 0}, proto
        );

        const frame2: FrameData = {
            serverFrame: 2,
            deltaFrame: 1,
            surpressCount: 0,
            areaBytes: 0,
            areaBits: new Uint8Array(0),
            playerState: createEmptyProtocolPlayerState(),
            packetEntities: { delta: false, entities: [] }
        };
        frameWriter2.writeFrame(frame2, proto);
        writer.writeBlock(frameWriter2.getData());

        writer.writeEOF();
        return writer.getData();
    };

    it('should track visible models in frames', async () => {
        const demoData = createTestDemo();
        const timeline = await analyzer.analyzeDemo(demoData);

        expect(timeline.frames.size).toBe(2);

        const frame1 = timeline.frames.get(1);
        expect(frame1).toBeDefined();
        expect(frame1?.visible.has('players/male/tris.md2')).toBe(true);
        expect(frame1?.audible.size).toBe(0);
    });

    it('should track audible sounds in frames', async () => {
        const demoData = createTestDemo();
        const timeline = await analyzer.analyzeDemo(demoData);

        const frame2 = timeline.frames.get(2);
        expect(frame2).toBeDefined();
        expect(frame2?.audible.has('weapons/railgf1a.wav')).toBe(true);
    });

    it('should analyze a specific range of frames', async () => {
        const demoData = createTestDemo();
        const timeline = await analyzer.analyzeRange(demoData, 2, 2);

        expect(timeline.frames.size).toBe(1);
        expect(timeline.frames.has(1)).toBe(false);
        expect(timeline.frames.has(2)).toBe(true);

        const frame2 = timeline.frames.get(2);
        expect(frame2?.audible.has('weapons/railgf1a.wav')).toBe(true);
    });

    it('should handle missing config strings gracefully', async () => {
        const writer = new DemoWriter();
        const msgWriter = new MessageWriter();
        msgWriter.writeServerData(34, 1, 0, '', 0, '');
        writer.writeBlock(msgWriter.getData());

        const frameWriter = new MessageWriter();
        const frame: FrameData = {
            serverFrame: 1,
            deltaFrame: -1,
            surpressCount: 0,
            areaBytes: 0,
            areaBits: new Uint8Array(0),
            playerState: createEmptyProtocolPlayerState(),
            packetEntities: {
                delta: false,
                entities: [{
                    number: 1, modelindex: 999, modelindex2: 0, modelindex3: 0, modelindex4: 0, frame: 0, skinnum: 0, effects: 0, renderfx: 0,
                    origin: {x:0, y:0, z:0}, angles: {x:0, y:0, z:0}, old_origin: {x:0, y:0, z:0}, sound: 0, event: 0, solid: 0, bits: 0, bitsHigh: 0
                }]
            }
        };
        frameWriter.writeFrame(frame, 34);
        writer.writeBlock(frameWriter.getData());
        writer.writeEOF();

        const timeline = await analyzer.analyzeDemo(writer.getData());
        const f1 = timeline.frames.get(1);
        expect(f1?.visible.size).toBe(0);
    });
});
