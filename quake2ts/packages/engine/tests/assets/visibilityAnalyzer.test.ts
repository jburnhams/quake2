import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResourceVisibilityAnalyzer } from '../../src/assets/visibilityAnalyzer.js';
import { MessageWriter } from '../../src/demo/writer.js';
import { ConfigStringIndex } from '@quake2ts/shared';
import { createEmptyEntityState, createEmptyProtocolPlayerState } from '../../src/demo/parser.js';

// Helper to create synthetic demo data with Writer
const createSyntheticDemo = (): Uint8Array => {
    // We need to create blocks format: Length(4) + Data
    const blocks: Uint8Array[] = [];

    const addBlock = (writer: MessageWriter) => {
        const data = writer.getData();
        const block = new Uint8Array(4 + data.length);
        const view = new DataView(block.buffer);
        view.setUint32(0, data.length, true);
        block.set(data, 4);
        blocks.push(block);
    };

    // Block 1: ServerData + ConfigStrings
    const w1 = new MessageWriter();
    w1.writeServerData(34, 1, 0, "baseq2", 0, "map1");
    // CS_MODELS starts at index 0 relative to base? No, ConfigStringIndex.Models is base.
    // writeConfigString takes absolute index.
    w1.writeConfigString(ConfigStringIndex.Models + 0, "models/test/model1.md2"); // Index 1 (0+1)
    w1.writeConfigString(ConfigStringIndex.Models + 1, "models/test/model2.md2"); // Index 2
    w1.writeConfigString(ConfigStringIndex.Sounds + 0, "sound/test/sound1.wav"); // Index 1
    addBlock(w1);

    // Block 2: Frame 1 with Entity using Model 1 and Sound 1
    const w2 = new MessageWriter();
    const ent1 = createEmptyEntityState();
    ent1.number = 1;
    ent1.modelindex = 1; // "models/test/model1.md2"
    ent1.sound = 1;      // "sound/test/sound1.wav"

    w2.writeFrame({
        serverFrame: 1,
        deltaFrame: 0,
        surpressCount: 0,
        areaBytes: 0,
        areaBits: new Uint8Array(0),
        playerState: createEmptyProtocolPlayerState(),
        packetEntities: { delta: false, entities: [ent1] }
    }, 34);
    addBlock(w2);

    // Combine blocks
    let totalLen = 0;
    blocks.forEach(b => totalLen += b.length);
    const combined = new Uint8Array(totalLen);
    let offset = 0;
    blocks.forEach(b => {
        combined.set(b, offset);
        offset += b.length;
    });

    return combined;
};

describe('ResourceVisibilityAnalyzer', () => {
    let analyzer: ResourceVisibilityAnalyzer;

    beforeEach(() => {
        analyzer = new ResourceVisibilityAnalyzer();
    });

    it('should initialize correctly', () => {
        expect(analyzer).toBeDefined();
    });

    it('should return empty timeline for empty demo', async () => {
        const buffer = new ArrayBuffer(4);
        const view = new DataView(buffer);
        view.setInt32(0, -1, true); // EOF

        const timeline = await analyzer.analyzeDemo(new Uint8Array(buffer));
        expect(timeline.frames.size).toBe(0);
    });

    it('should identify resources in a synthetic demo', async () => {
        const demoData = createSyntheticDemo();
        const timeline = await analyzer.analyzeDemo(demoData);

        expect(timeline.frames.has(1)).toBe(true);
        const frame1Res = timeline.frames.get(1)!;

        expect(frame1Res.visible.has("models/test/model1.md2")).toBe(true);
        expect(frame1Res.audible.has("sound/test/sound1.wav")).toBe(true);
    });
});
