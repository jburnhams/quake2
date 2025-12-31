import { describe, expect, it } from 'vitest';
import { detectFileType, FileType, isTextFile, isBinaryFile } from '../../../src/assets/fileType.js';

describe('FileType Detection', () => {
  it('detects file type by extension', () => {
    expect(detectFileType('maps/test.bsp')).toBe(FileType.BSP);
    expect(detectFileType('models/test.md2')).toBe(FileType.MD2);
    expect(detectFileType('pics/test.pcx')).toBe(FileType.PCX);
    expect(detectFileType('test.txt')).toBe(FileType.TXT);
    expect(detectFileType('autoexec.cfg')).toBe(FileType.CFG);
    expect(detectFileType('unknown.xyz')).toBe(FileType.Unknown);
  });

  it('detects file type by magic bytes', () => {
    // IBSP
    const bspData = new Uint8Array([0x49, 0x42, 0x53, 0x50, 0, 0, 0, 0]);
    expect(detectFileType('test.dat', bspData)).toBe(FileType.BSP);

    // IDP2
    const md2Data = new Uint8Array([0x49, 0x44, 0x50, 0x32, 0, 0, 0, 0]);
    expect(detectFileType('test.dat', md2Data)).toBe(FileType.MD2);

    // OggS
    const oggData = new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0, 0, 0, 0]);
    expect(detectFileType('test.dat', oggData)).toBe(FileType.OGG);

    // RIFF....WAVE
    const wavData = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, // RIFF
      0, 0, 0, 0,             // Size
      0x57, 0x41, 0x56, 0x45  // WAVE
    ]);
    expect(detectFileType('test.dat', wavData)).toBe(FileType.WAV);
  });

  it('identifies text files', () => {
    expect(isTextFile('readme.txt')).toBe(true);
    expect(isTextFile('config.cfg')).toBe(true);
    expect(isTextFile('image.pcx')).toBe(false);
  });

  it('identifies binary files', () => {
    expect(isBinaryFile('model.md2')).toBe(true);
    expect(isBinaryFile('note.txt')).toBe(false);
  });
});
