import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient, ClientExports, ClientImports } from '../src/index.js';
import { ClientConfigStrings } from '../src/configStrings.js';

describe('Client Events Integration', () => {
    let client: ClientExports;
    let imports: ClientImports;

    beforeEach(() => {
        imports = {
            engine: {
                trace: vi.fn().mockReturnValue({ fraction: 1.0, endpos: { x: 0, y: 0, z: 0 } }),
                renderer: {
                    renderFrame: vi.fn(),
                    width: 800,
                    height: 600,
                    begin2D: vi.fn(),
                    end2D: vi.fn(),
                    drawPic: vi.fn(),
                    drawText: vi.fn(),
                    measureText: vi.fn().mockReturnValue({ width: 0, height: 0 }),
                    getPerformanceReport: vi.fn().mockReturnValue({}),
                    createTexture: vi.fn(),
                    uploadTexture: vi.fn(),
                } as any,
                assets: {
                    getMap: vi.fn(),
                    listFiles: vi.fn().mockReturnValue([]),
                    getPic: vi.fn(),
                } as any,
                audio: {
                    playSound: vi.fn(),
                } as any,
            } as any,
            host: {
                commands: {
                    register: vi.fn(),
                    execute: vi.fn(),
                } as any,
                cvars: {
                    register: vi.fn(),
                    get: vi.fn().mockReturnValue({ string: '', number: 0, flags: 0 }),
                    list: vi.fn().mockReturnValue([]),
                    setValue: vi.fn(),
                } as any,
                time: 0,
                paused: false
            } as any
        };
        client = createClient(imports);
    });

    it('should fire onCenterPrint when ParseCenterPrint is called', () => {
        const spy = vi.fn();
        client.onCenterPrint = spy;
        client.ParseCenterPrint('Hello World');
        expect(spy).toHaveBeenCalledWith('Hello World');
    });

    it('should fire onNotify when ParseNotify is called', () => {
        const spy = vi.fn();
        client.onNotify = spy;
        client.ParseNotify('Player joined');
        expect(spy).toHaveBeenCalledWith('Player joined');
    });

    it('should parse pickup messages correctly', () => {
        const spy = vi.fn();
        client.onPickupMessage = spy;

        // Quake 2 pickup messages usually start with "You got the "
        client.ParseNotify('You got the Shotgun');
        expect(spy).toHaveBeenCalledWith('Shotgun', undefined);

        client.ParseNotify('You got the Railgun');
        expect(spy).toHaveBeenCalledWith('Railgun', undefined);
    });

    it('should NOT fire onPickupMessage for normal chat', () => {
        const spy = vi.fn();
        client.onPickupMessage = spy;

        client.ParseNotify('Player1: Hello');
        expect(spy).not.toHaveBeenCalled();
    });

    it('should parse obituary messages correctly', () => {
         const spy = vi.fn();
         client.onObituaryMessage = spy;

         // "Player1 died."
         client.ParseNotify('Player1 died.');
         expect(spy).toHaveBeenCalledWith('Player1', undefined, 'died.');

         // "Player1 was railed by Player2"
         client.ParseNotify('Player1 was railed by Player2');
         expect(spy).toHaveBeenCalledWith('Player1', 'Player2', 'was railed by');
    });
});
