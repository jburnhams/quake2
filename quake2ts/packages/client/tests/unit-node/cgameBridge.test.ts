import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCGameImport } from '@quake2ts/client/cgameBridge';
import { createMockClientState, createMockEngineImports, createMockEngineHost } from '@quake2ts/test-utils';

describe('CGameImport cvar', () => {
    let mockHost: any;
    let mockImports: any;
    let mockState: any;

    beforeEach(() => {
        mockHost = createMockEngineHost();
        mockImports = {
            host: mockHost,
            engine: createMockEngineImports()
        };
        mockState = createMockClientState({
             tickRate: 10,
             frameTimeMs: 100,
             serverFrame: 1,
             serverProtocol: 34,
             // configStrings, getClientName, etc are provided by default, but we can override if needed
             // defaults are sufficient for these tests
        });

        // Ensure defaults match what the test expects if specific values were relied upon
        mockState.getClientName = () => 'TestPlayer';
    });

    it('should return existing cvar if it exists', () => {
        mockHost.cvars.register({ name: 'test_cvar', defaultValue: '10' });
        const cgameImport = createCGameImport(mockImports, mockState);

        const result = cgameImport.cvar('test_cvar', '20', 0);
        expect(result).toBeDefined();
        expect((result as any).name).toBe('test_cvar');
        expect((result as any).string).toBe('10'); // Should return existing value
    });

    it('should register new cvar if it does not exist', () => {
        const cgameImport = createCGameImport(mockImports, mockState);

        const result = cgameImport.cvar('new_cvar', '99', 123);
        expect(result).toBeDefined();
        expect((result as any).name).toBe('new_cvar');
        expect((result as any).string).toBe('99');

        const registered = mockHost.cvars.get('new_cvar');
        expect(registered).toBeDefined();
        expect(registered?.string).toBe('99');
    });

    it('should return null if host is missing', () => {
         const noHostImports = { ...mockImports, host: undefined };
         const cgameImport = createCGameImport(noHostImports, mockState);

         const result = cgameImport.cvar('any', '0', 0);
         expect(result).toBeNull();
    });

    it('should set cvar value', () => {
        const cvar = mockHost.cvars.register({ name: 'set_me', defaultValue: '0' });
        const cgameImport = createCGameImport(mockImports, mockState);

        cgameImport.cvar_set('set_me', '1');
        expect(cvar.string).toBe('1');
    });

    it('Com_Print calls console.log and onPrint callback', () => {
        const onPrint = vi.fn();
        const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        const cgameImport = createCGameImport(mockImports, mockState, onPrint);

        cgameImport.Com_Print('Hello World');

        expect(consoleLogSpy).toHaveBeenCalledWith('[CGAME] Hello World');
        expect(onPrint).toHaveBeenCalledWith('Hello World');

        consoleLogSpy.mockRestore();
    });

    it('Com_Error calls console.error and onPrint callback with error prefix', () => {
        const onPrint = vi.fn();
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const cgameImport = createCGameImport(mockImports, mockState, onPrint);

        cgameImport.Com_Error('Fatal Error');

        expect(consoleErrorSpy).toHaveBeenCalledWith('[CGAME ERROR] Fatal Error');
        expect(onPrint).toHaveBeenCalledWith('^1[ERROR] Fatal Error');

        consoleErrorSpy.mockRestore();
    });
});
