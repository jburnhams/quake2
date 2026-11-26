import { vi } from 'vitest';
import { ServerCommand } from '@quake2ts/shared';

/**
 * Interface for a mocked server console that can execute commands.
 * Reference: quake2/server/sv_main.c (SV_ExecuteUserCommand)
 */
export interface MockServerConsole {
    exec(cmd: string): string;
    print(text: string): void;
    broadcast(text: string): void;
    commandBuffer: string[];
    outputBuffer: string[];
}

/**
 * Creates a mock server console.
 * @param overrides Optional overrides for the mock console.
 */
export function createMockServerConsole(overrides?: Partial<MockServerConsole>): MockServerConsole {
    const outputBuffer: string[] = [];
    const commandBuffer: string[] = [];

    return {
        exec: vi.fn((cmd: string) => {
            commandBuffer.push(cmd);
            return `Executed: ${cmd}`;
        }),
        print: vi.fn((text: string) => {
            outputBuffer.push(text);
        }),
        broadcast: vi.fn((text: string) => {
            outputBuffer.push(`Broadcast: ${text}`);
        }),
        commandBuffer,
        outputBuffer,
        ...overrides
    };
}

/**
 * Interface for a mocked RCON client.
 * Reference: quake2/server/sv_user.c (SV_ExecuteUserCommand for RCON handling)
 */
export interface MockRConClient {
    connect(address: string, port: number, password?: string): Promise<boolean>;
    sendCommand(cmd: string): Promise<string>;
    disconnect(): void;
    connected: boolean;
    lastCommand: string;
    lastResponse: string;
}

/**
 * Creates a mock RCON client.
 * @param password Optional password for the client to use.
 */
export function createMockRConClient(password: string = ''): MockRConClient {
    return {
        connected: false,
        lastCommand: '',
        lastResponse: '',
        connect: vi.fn(async (address, port, pwd) => {
            return pwd === password; // Simple mock: connect succeeds if password matches constructor password
        }),
        sendCommand: vi.fn(async (cmd) => {
            return `RCON Response for: ${cmd}`;
        }),
        disconnect: vi.fn(),
    };
}

/**
 * Simulates a command execution on the server.
 * @param server The mock server instance (assumed to have some command handling capability).
 * @param command The command string to execute.
 * @returns The output of the command.
 */
export function simulateServerCommand(server: any, command: string): string {
    // This assumes the server has a method to execute commands, or we simulate the effect.
    // In a real integration, this might interact with the server's command buffer.
    if (server.executeBuffer) {
        server.executeBuffer(command);
        return "Executed";
    }

    // Fallback for mocked servers
    if (server.exec) {
        return server.exec(command);
    }

    return "Unknown command handler";
}
