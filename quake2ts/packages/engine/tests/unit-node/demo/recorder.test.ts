import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DemoRecorder } from '@quake2ts/engine/demo/recorder.js';
import { DemoReader } from '@quake2ts/engine/demo/demoReader.js';

describe('DemoRecorder', () => {
  let recorder: DemoRecorder;

  beforeEach(() => {
    recorder = new DemoRecorder();
  });

  it('should start not recording', () => {
    expect(recorder.getIsRecording()).toBe(false);
  });

  it('should start recording', () => {
    recorder.startRecording('test.dm2');
    expect(recorder.getIsRecording()).toBe(true);
  });

  it('should record messages and stop', () => {
    recorder.startRecording('test.dm2');

    // Create a dummy message
    const msg1 = new Uint8Array([1, 2, 3]);
    recorder.recordMessage(msg1);

    const msg2 = new Uint8Array([4, 5, 6, 7]);
    recorder.recordMessage(msg2);

    const data = recorder.stopRecording();
    expect(recorder.getIsRecording()).toBe(false);
    expect(data).not.toBeNull();

    // Validate with DemoReader
    const reader = new DemoReader(data!.buffer);

    // Msg 1
    expect(reader.hasMore()).toBe(true);
    const block1 = reader.readNextBlock();
    expect(block1).not.toBeNull();
    expect(block1!.length).toBe(3);
    // Cannot easily check content of block1.data (BinaryStream) without reading
    // But length matches.

    // Msg 2
    expect(reader.hasMore()).toBe(true);
    const block2 = reader.readNextBlock();
    expect(block2).not.toBeNull();
    expect(block2!.length).toBe(4);

    // EOF (-1)
    // DemoReader readNextBlock returns null on -1 length?
    // Let's check DemoReader implementation.
    // It reads length. If < 0, it warns and returns null or breaks loop.
    // scan() breaks loop.
    // readNextBlock() returns null?
    // readNextBlock checks: if length < 0 ... return null.
    // So asking for next block should return null.

    const block3 = reader.readNextBlock();
    expect(block3).toBeNull();
  });
});
