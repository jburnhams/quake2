import { describe, it, expect } from 'vitest';
import { collectMessages, Message, PrintMessage } from '../../src/demo/message';
import { ServerCommand } from '@quake2ts/shared';

describe('MessageCollector', () => {

    // Helper to create a demo block with commands
    const createDemoBlock = (commands: Uint8Array): Uint8Array => {
        const length = commands.length;
        const block = new Uint8Array(4 + length);
        const view = new DataView(block.buffer);
        view.setInt32(0, length, true); // Little endian length
        block.set(commands, 4);
        return block;
    };

    const createServerDataCommand = (): Uint8Array => {
        // svc_serverdata (12 in Proto 34)
        // [12] [proto] [servercount] [attract] [gamedir] [playernum] [levelname]
        const encoder = new TextEncoder();
        const baseq2 = encoder.encode("baseq2");
        const level = encoder.encode("q2dm1");

        // Size: 1 (cmd) + 4 (proto) + 4 (count) + 1 (attract) + len(baseq2)+1 + 2 (player) + len(level)+1
        const size = 1 + 4 + 4 + 1 + (baseq2.length + 1) + 2 + (level.length + 1);
        const cmd = new Uint8Array(size);
        const view = new DataView(cmd.buffer);
        let off = 0;
        view.setUint8(off++, 12); // svc_serverdata
        view.setUint32(off, 34, true); off += 4; // protocol
        view.setUint32(off, 1, true); off += 4; // servercount
        view.setUint8(off++, 0); // attract
        cmd.set(baseq2, off); off += baseq2.length;
        view.setUint8(off++, 0); // null
        view.setUint16(off, 0, true); off += 2; // playernum
        cmd.set(level, off); off += level.length;
        view.setUint8(off++, 0); // null
        return cmd;
    };

    const createPrintCommand = (id: number, text: string): Uint8Array => {
        const textBytes = new TextEncoder().encode(text);
        const cmd = new Uint8Array(1 + 1 + textBytes.length + 1);
        cmd[0] = 11; // svc_print (11 in Proto 34, 10 in others, let's assume 11 for standard)
        // Wait, standard Q2 svc_print is 11.
        cmd[1] = id;
        cmd.set(textBytes, 2);
        cmd[2 + textBytes.length] = 0; // Null terminator
        return cmd;
    };

    const createNopCommand = (): Uint8Array => {
        return new Uint8Array([1]); // svc_nop (1 in Proto 34)
    };

    it('should parse multiple blocks and collect messages', () => {
        // Must start with ServerData to set protocol, otherwise Bootstrap ignores print
        const serverData = createServerDataCommand();
        const cmd1 = createPrintCommand(1, "Hello");
        const cmd2 = createPrintCommand(2, "World");

        // Put serverData in first block
        const block1Data = new Uint8Array(serverData.length + cmd1.length);
        block1Data.set(serverData, 0);
        block1Data.set(cmd1, serverData.length);

        const block1 = createDemoBlock(block1Data);
        const block2 = createDemoBlock(cmd2);

        const demoData = new Uint8Array(block1.length + block2.length);
        demoData.set(block1, 0);
        demoData.set(block2, block1.length);

        const messages = collectMessages(demoData);

        // Should include serverData, print, print
        // collectMessages might return ServerDataMessage type too?
        // Check message.ts types. Yes ServerDataMessage exists.
        // Expect 3 messages.

        expect(messages.length).toBeGreaterThanOrEqual(2);

        // Find print messages
        const prints = messages.filter(m => m.type === ServerCommand.print) as PrintMessage[];
        expect(prints.length).toBe(2);

        expect(prints[0].level).toBe(1);
        expect(prints[0].message).toBe("Hello");

        expect(prints[1].level).toBe(2);
        expect(prints[1].message).toBe("World");
    });

    it('should handle multiple commands in a single block', () => {
        const serverData = createServerDataCommand();
        const cmd1 = createPrintCommand(1, "One");
        const cmd2 = createPrintCommand(2, "Two");

        const combined = new Uint8Array(serverData.length + cmd1.length + cmd2.length);
        combined.set(serverData, 0);
        combined.set(cmd1, serverData.length);
        combined.set(cmd2, serverData.length + cmd1.length);

        const block = createDemoBlock(combined);

        const messages = collectMessages(block);

        const prints = messages.filter(m => m.type === ServerCommand.print) as PrintMessage[];
        expect(prints.length).toBe(2);
        expect(prints[0].message).toBe("One");
        expect(prints[1].message).toBe("Two");
    });

    it('should handle empty blocks/padding gracefully', () => {
        const cmd = createNopCommand();
        const block = createDemoBlock(cmd);

        const messages = collectMessages(block);
        expect(messages.length).toBe(0); // NOP produces no message in collector
    });
});
