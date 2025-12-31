import { describe, it, expect } from 'vitest';
import { DemoValidator } from '../../../src/demo/validator.js';
import { ServerCommand } from '@quake2ts/shared';

describe('DemoValidator', () => {
  it('should validate a valid demo file', () => {
    // Create a synthetic valid demo buffer
    // Block length: 8 bytes
    // svc_serverdata (1 byte) + protocol 34 (4 bytes) + padding (3 bytes)
    const buffer = new ArrayBuffer(12);
    const view = new DataView(buffer);

    view.setInt32(0, 8, true); // Length
    view.setUint8(4, ServerCommand.serverdata); // svc_serverdata
    view.setInt32(5, 34, true); // Protocol 34

    const result = DemoValidator.validate(buffer, 'test.dm2');
    expect(result.valid).toBe(true);
    expect(result.version).toBe(34);
    expect(result.error).toBeUndefined();
  });

  it('should reject invalid file extension', () => {
    const buffer = new ArrayBuffer(10);
    const result = DemoValidator.validate(buffer, 'test.txt');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid file extension');
  });

  it('should reject file that is too small', () => {
    const buffer = new ArrayBuffer(4);
    const result = DemoValidator.validate(buffer, 'test.dm2');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('File too small');
  });

  it('should reject invalid block length (negative)', () => {
    const buffer = new ArrayBuffer(12);
    const view = new DataView(buffer);
    view.setInt32(0, -1, true);

    const result = DemoValidator.validate(buffer, 'test.dm2');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid first block length');
  });

  it('should reject invalid block length (too large)', () => {
    const buffer = new ArrayBuffer(12);
    const view = new DataView(buffer);
    view.setInt32(0, 100, true);

    const result = DemoValidator.validate(buffer, 'test.dm2');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid first block length');
  });

  it('should reject if first command is not svc_serverdata', () => {
    const buffer = new ArrayBuffer(12);
    const view = new DataView(buffer);

    view.setInt32(0, 8, true); // Length
    view.setUint8(4, ServerCommand.print); // Wrong command (e.g. print=10)

    const result = DemoValidator.validate(buffer, 'test.dm2');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('First command is not svc_serverdata');
  });
});
