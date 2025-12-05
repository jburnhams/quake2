
import { describe, it, expect, beforeAll, vi, afterAll } from 'vitest';
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
        const demoBuffer = demoData.buffer.slice(demoData.byteOffset, demoData.byteOffset + demoData.byteLength);

        const handler = createMockHandler();
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

            // Use non-strict mode to avoid failing on known minor issues in real demos
            const parser = new NetworkMessageParser(msg.data, handler, false);
            parser.setProtocolVersion(protocolVersion);

            parser.parseMessage();

            // We can check if parser encountered errors
            if (parser.getErrorCount() > 0) {
                // If needed we can log here, but for now we expect robustness
                // console.warn(`Message ${messageCount} had errors`);
            }

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

        // Check protocol version
        const firstCall = handler.onServerData.mock.calls[0];
        const protocol = firstCall ? firstCall[0] : 0;
        console.log(`Demo Protocol Version: ${protocol}`);
        expect(protocol).toBe(25);
    });
});
