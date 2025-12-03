
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { PakArchive } from '../../src/assets/pak';
import { BinaryStream, ServerCommand } from '@quake2ts/shared';
import { NetworkMessageParser, PROTOCOL_VERSION_RERELEASE } from '../../src/demo/parser';
import { DemoReader } from '../../src/demo/demoReader';

// Mock Handler to capture events
const createMockHandler = () => ({
    onServerData: vi.fn(),
    onConfigString: vi.fn(),
    onSpawnBaseline: vi.fn(),
    onFrame: vi.fn(),
    onPrint: vi.fn(),
    onCenterPrint: vi.fn(),
    onSound: vi.fn(),
    onTempEntity: vi.fn(),
    onLayout: vi.fn(),
    onInventory: vi.fn(),
    onMuzzleFlash: vi.fn(),
    onMuzzleFlash2: vi.fn(),
    onDisconnect: vi.fn(),
    onReconnect: vi.fn(),
    onDownload: vi.fn(),
    onSplitClient: vi.fn(),
    onLevelRestart: vi.fn(),
    onLocPrint: vi.fn(),
    onWaitingForPlayers: vi.fn(),
    onBotChat: vi.fn(),
    onPoi: vi.fn(),
    onHelpPath: vi.fn(),
    onMuzzleFlash3: vi.fn(),
    onAchievement: vi.fn(),
    onStuffText: vi.fn(),
});

describe('Real Demo Parsing (demo1.dm2)', () => {
    let demoData: Uint8Array;

    beforeAll(() => {
        // Load pak.pak
        const pakPath = resolve(__dirname, '../../../../pak.pak');
        const buffer = readFileSync(pakPath);
        const pak = PakArchive.fromArrayBuffer('pak.pak', buffer.buffer);

        // Extract demos/demo1.dm2
        demoData = pak.readFile('demos/demo1.dm2');
    });

    it('should parse real demo1.dm2 without errors', () => {
        // BinaryStream is not needed for DemoReader constructor, it takes ArrayBuffer
        // demoData is Uint8Array, so we pass its buffer

        // Important: demoData.buffer might refer to the whole pak buffer if it's a subarray
        // We should ensure we pass only the relevant slice
        const demoBuffer = demoData.buffer.slice(demoData.byteOffset, demoData.byteOffset + demoData.byteLength);

        const handler = createMockHandler();

        // Demo1.dm2 is a container format. We need DemoReader first.
        const demoReader = new DemoReader(demoBuffer);

        let messageCount = 0;
        let frameCount = 0;
        let serverDataFound = false;
        let protocolVersion = 0;

        // Read all messages
        while (demoReader.hasMore()) {
            const msg = demoReader.readNextBlock();
            if (!msg) break;

            messageCount++;

            // msg.data is already a BinaryStream
            const parser = new NetworkMessageParser(msg.data, handler);

            // Persist protocol version across messages
            parser.setProtocolVersion(protocolVersion);

            parser.parseMessage();

            // Update protocol version for next iteration
            protocolVersion = parser.getProtocolVersion();

            if (handler.onServerData.mock.calls.length > 0) {
                 serverDataFound = true;
            }
            if (handler.onFrame.mock.calls.length > frameCount) {
                 frameCount = handler.onFrame.mock.calls.length;
            }
        }

        expect(messageCount).toBeGreaterThan(0);
        expect(serverDataFound).toBe(true);
        expect(frameCount).toBeGreaterThan(0);

        console.log(`Parsed ${messageCount} messages, ${frameCount} frames.`);

        // Check protocol version from the first onServerData call
        const firstCall = handler.onServerData.mock.calls[0];
        const protocol = firstCall[0];
        console.log(`Demo Protocol Version: ${protocol}`);

        // demo1.dm2 in pak.pak is Protocol 25 (Quake 2 v3.00), not Protocol 34 (v3.20)
        expect(protocol).toBe(25);
    });
});
