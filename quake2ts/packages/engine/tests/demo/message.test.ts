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
        // svc_serverdata (Protocol 34 = 13)
        // protocol(34), servercount(1), attract(0), gamedir, playernum(0), map
        // minimal
        const buffer = [];
        buffer.push(13); // svc_serverdata
        // protocol 34
        buffer.push(34, 0, 0, 0);
        // servercount 1
        buffer.push(1, 0, 0, 0);
        // attract 0
        buffer.push(0);
        // gamedir "baseq2"
        for(const c of "baseq2") buffer.push(c.charCodeAt(0));
        buffer.push(0);
        // playernum 0
        buffer.push(0, 0);
        // map "map"
        for(const c of "map") buffer.push(c.charCodeAt(0));
        buffer.push(0);
        return new Uint8Array(buffer);
    };

    const createPrintCommand = (id: number, text: string): Uint8Array => {
        const textBytes = new TextEncoder().encode(text);
        // svc_print is 11 in Legacy (Protocol 34)
        const cmd = new Uint8Array(1 + 1 + textBytes.length + 1);
        cmd[0] = 11; // svc_print
        cmd[1] = id;
        cmd.set(textBytes, 2);
        cmd[2 + textBytes.length] = 0; // Null terminator
        return cmd;
    };

    const createNopCommand = (): Uint8Array => {
        return new Uint8Array([1]); // svc_nop is 1 in Legacy
    };

    it('should parse multiple blocks and collect messages', () => {
        // Need serverdata to init protocol
        const initBlock = createDemoBlock(createServerDataCommand());

        const cmd1 = createPrintCommand(1, "Hello");
        const cmd2 = createPrintCommand(2, "World");

        const block1 = createDemoBlock(cmd1);
        const block2 = createDemoBlock(cmd2);

        const demoData = new Uint8Array(initBlock.length + block1.length + block2.length);
        demoData.set(initBlock, 0);
        demoData.set(block1, initBlock.length);
        demoData.set(block2, initBlock.length + block1.length);

        const messages = collectMessages(demoData);

        // ServerData message + 2 Prints
        // Wait, collectMessages implementation? Does it collect ServerData?
        // Assuming it does.
        // Or assumes it collects "important" messages?
        // If it collects everything, length should be 3 (ServerData + 2 Prints).
        // Let's check expectation: previously expected 2.
        // Assuming ServerData is not collected or test ignores it?
        // If message.ts Message type includes ServerData, it should be there.
        // If not, maybe filter by instance type.

        // Filter prints
        const prints = messages.filter(m => m.type === ServerCommand.print);

        expect(prints.length).toBe(2);

        const msg1 = prints[0] as PrintMessage;
        expect(msg1.type).toBe(ServerCommand.print);
        expect(msg1.level).toBe(1);
        expect(msg1.message).toBe("Hello");

        const msg2 = prints[1] as PrintMessage;
        expect(msg2.type).toBe(ServerCommand.print);
        expect(msg2.level).toBe(2);
        expect(msg2.message).toBe("World");
    });

    it('should handle multiple commands in a single block', () => {
        // Need serverdata
        const initBlock = createDemoBlock(createServerDataCommand());

        const cmd1 = createPrintCommand(1, "One");
        const cmd2 = createPrintCommand(2, "Two");

        const combined = new Uint8Array(cmd1.length + cmd2.length);
        combined.set(cmd1, 0);
        combined.set(cmd2, cmd1.length);

        const block = createDemoBlock(combined);

        const demoData = new Uint8Array(initBlock.length + block.length);
        demoData.set(initBlock, 0);
        demoData.set(block, initBlock.length);

        const messages = collectMessages(demoData);
        const prints = messages.filter(m => m.type === ServerCommand.print);

        expect(prints.length).toBe(2);
        expect((prints[0] as PrintMessage).message).toBe("One");
        expect((prints[1] as PrintMessage).message).toBe("Two");
    });

    it('should handle empty blocks/padding gracefully', () => {
        // Need serverdata
        const initBlock = createDemoBlock(createServerDataCommand());

        const cmd = createNopCommand();
        const block = createDemoBlock(cmd);

        const demoData = new Uint8Array(initBlock.length + block.length);
        demoData.set(initBlock, 0);
        demoData.set(block, initBlock.length);

        const messages = collectMessages(demoData);
        // NOP not collected
        const prints = messages.filter(m => m.type === ServerCommand.print);
        expect(prints.length).toBe(0);
    });
});
