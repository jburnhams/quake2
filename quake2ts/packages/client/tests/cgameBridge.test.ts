import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCGameImport } from '../src/cgameBridge';
import { CvarRegistry } from '@quake2ts/engine';

describe('CGameImport cvar', () => {
    let mockCvars: CvarRegistry;
    let mockHost: any;
    let mockImports: any;
    let mockState: any;

    beforeEach(() => {
        mockCvars = new CvarRegistry();
        mockHost = {
            cvars: mockCvars
        };
        mockImports = {
            host: mockHost,
            engine: {
                renderer: {}
            }
        };
        mockState = {
             tickRate: 10,
             frameTimeMs: 100,
             serverFrame: 1,
             serverProtocol: 34,
             configStrings: { get: () => '' },
             getClientName: () => 'TestPlayer',
             getKeyBinding: () => '',
             inAutoDemo: false
        };
    });

    it('should return existing cvar if it exists', () => {
        mockCvars.register({ name: 'test_cvar', defaultValue: '10' });
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

        const registered = mockCvars.get('new_cvar');
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
        const cvar = mockCvars.register({ name: 'set_me', defaultValue: '0' });
        const cgameImport = createCGameImport(mockImports, mockState);

        cgameImport.cvar_set('set_me', '1');
        expect(cvar.string).toBe('1');
    });
});
