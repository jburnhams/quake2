import { describe, it, expect } from 'vitest';
import { createConfigStringMock, createConfigStringArrayMock, createCvarMock } from '../../src/shared/factories';
import { CvarFlags } from '@quake2ts/shared';

describe('Shared Factories', () => {
    describe('createConfigStringMock', () => {
        it('should create a config string entry', () => {
            const result = createConfigStringMock(1, 'foo');
            expect(result).toEqual({ index: 1, value: 'foo' });
        });
    });

    describe('createConfigStringArrayMock', () => {
        it('should create an empty array by default', () => {
            const result = createConfigStringArrayMock();
            expect(result).toEqual([]);
        });

        it('should create an array from entries', () => {
            const entries = { 1: 'foo', 2: 'bar' };
            const result = createConfigStringArrayMock(entries);
            expect(result).toHaveLength(2);
            expect(result).toContainEqual({ index: 1, value: 'foo' });
            expect(result).toContainEqual({ index: 2, value: 'bar' });
        });
    });

    describe('createCvarMock', () => {
        it('should create a cvar with default values', () => {
            const cvar = createCvarMock('test_cvar', '10');
            expect(cvar.name).toBe('test_cvar');
            expect(cvar.string).toBe('10');
            // 'value' property does not exist on Cvar, we should use 'string' or getters
            expect(cvar.defaultValue).toBe('10');
            expect(cvar.flags).toBe(CvarFlags.None);
        });

        it('should create a cvar with flags', () => {
            const cvar = createCvarMock('test_cvar', '10', CvarFlags.Archive);
            expect(cvar.flags).toBe(CvarFlags.Archive);
        });

        it('should be able to set value', () => {
            const cvar = createCvarMock('test_cvar', '10');
            cvar.set('20');
            expect(cvar.string).toBe('20');
        });
    });
});
