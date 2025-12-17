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

    const createPrintCommand = (id: number, text: string): Uint8Array => {
        const textBytes = new TextEncoder().encode(text);
        const cmd = new Uint8Array(1 + 1 + textBytes.length + 1);
        cmd[0] = 10; // svc_print
        cmd[1] = id;
        cmd.set(textBytes, 2);
        cmd[2 + textBytes.length] = 0; // Null terminator
        return cmd;
    };

    const createNopCommand = (): Uint8Array => {
        return new Uint8Array([6]); // svc_nop
    };

    it('should parse multiple blocks and collect messages', () => {
        const cmd1 = createPrintCommand(1, "Hello");
        const cmd2 = createPrintCommand(2, "World");

        const block1 = createDemoBlock(cmd1);
        const block2 = createDemoBlock(cmd2);

        const demoData = new Uint8Array(block1.length + block2.length);
        demoData.set(block1, 0);
        demoData.set(block2, block1.length);

        const messages = collectMessages(demoData);

        expect(messages.length).toBe(2);

        const msg1 = messages[0] as PrintMessage;
        expect(msg1.type).toBe(ServerCommand.print);
        expect(msg1.level).toBe(1);
        expect(msg1.message).toBe("Hello");

        const msg2 = messages[1] as PrintMessage;
        expect(msg2.type).toBe(ServerCommand.print);
        expect(msg2.level).toBe(2);
        expect(msg2.message).toBe("World");
    });

    it('should handle multiple commands in a single block', () => {
        const cmd1 = createPrintCommand(1, "One");
        const cmd2 = createPrintCommand(2, "Two");

        const combined = new Uint8Array(cmd1.length + cmd2.length);
        combined.set(cmd1, 0);
        combined.set(cmd2, cmd1.length);

        const block = createDemoBlock(combined);

        const messages = collectMessages(block);

        expect(messages.length).toBe(2);
        expect((messages[0] as PrintMessage).message).toBe("One");
        expect((messages[1] as PrintMessage).message).toBe("Two");
    });

    it('should handle empty blocks/padding gracefully', () => {
        const cmd = createNopCommand();
        const block = createDemoBlock(cmd);

        const messages = collectMessages(block);
        expect(messages.length).toBe(0); // NOP produces no message in collector
    });
});
