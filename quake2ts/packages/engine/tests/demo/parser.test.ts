
import { describe, it, expect, beforeEach } from 'vitest';
import { NetworkMessageParser } from '../../src/demo/parser.js';
import { BinaryStream } from '@quake2ts/shared';
import { ServerCommand } from '@quake2ts/shared';
import { TempEntity } from '@quake2ts/shared';

// Helper to create a binary stream from bytes
const createStream = (bytes: number[]): BinaryStream => {
  const buffer = new Uint8Array(bytes);
  return new BinaryStream(buffer);
};

// Helper to write values to a byte array (mimicking server writing)
const writeByte = (arr: number[], val: number) => arr.push(val & 0xFF);
const writeShort = (arr: number[], val: number) => {
  arr.push(val & 0xFF);
  arr.push((val >> 8) & 0xFF);
};
const writeLong = (arr: number[], val: number) => {
  arr.push(val & 0xFF);
  arr.push((val >> 8) & 0xFF);
  arr.push((val >> 16) & 0xFF);
  arr.push((val >> 24) & 0xFF);
};
const writeString = (arr: number[], str: string) => {
  for (let i = 0; i < str.length; i++) {
    arr.push(str.charCodeAt(i));
  }
  arr.push(0); // Null terminator
};
const writeCoord = (arr: number[], val: number) => writeShort(arr, Math.floor(val * 8));
const writeAngle = (arr: number[], val: number) => writeByte(arr, Math.floor(val * 256 / 360));
const writeAngle16 = (arr: number[], val: number) => writeShort(arr, Math.floor(val * 65536 / 360));

describe('NetworkMessageParser', () => {

  it('should parse svc_serverdata and set protocol version', () => {
    const data: number[] = [];
    writeByte(data, ServerCommand.serverdata);
    writeLong(data, 34); // Protocol 34
    writeLong(data, 123); // Server count
    writeByte(data, 1); // isDemo (RECORD_CLIENT)
    writeString(data, "baseq2");
    writeShort(data, 1); // Player num
    writeString(data, "q2dm1");

    const stream = createStream(data);
    const parser = new NetworkMessageParser(stream);

    // We can't inspect private state easily without casting to any or adding getters,
    // but we can verify it parses without error and advances stream.
    parser.parseMessage();
    expect(stream.hasMore()).toBe(false);
  });

  it('should parse svc_frame for protocol 34 (skipping extra byte)', () => {
    // Protocol 34 should read an extra byte in parseFrame
    const data: number[] = [];

    // First set protocol to 34 via serverdata
    writeByte(data, ServerCommand.serverdata);
    writeLong(data, 34);
    writeLong(data, 0); writeByte(data, 0); writeString(data, ""); writeShort(data, 0); writeString(data, "");

    // Now svc_frame
    writeByte(data, ServerCommand.frame);
    writeLong(data, 100); // seq1
    writeLong(data, 99); // seq2
    writeByte(data, 0); // UK_B1 (surpress count) - READ ONLY IF NOT PROTOCOL 26
    writeByte(data, 0); // Area count
    // No area bytes since count is 0

    const stream = createStream(data);
    const parser = new NetworkMessageParser(stream);
    parser.parseMessage();
    expect(stream.hasMore()).toBe(false);
  });

  it('should parse svc_frame for protocol 26 (NOT skipping extra byte)', () => {
    // Protocol 26 should NOT read an extra byte
    const data: number[] = [];

    // Set protocol to 26
    writeByte(data, ServerCommand.serverdata);
    writeLong(data, 26);
    writeLong(data, 0); writeByte(data, 0); writeString(data, ""); writeShort(data, 0); writeString(data, "");

    // svc_frame
    writeByte(data, ServerCommand.frame);
    writeLong(data, 100);
    writeLong(data, 99);
    // NO UK_B1 here
    writeByte(data, 0); // Area count

    const stream = createStream(data);
    const parser = new NetworkMessageParser(stream);
    parser.parseMessage();
    expect(stream.hasMore()).toBe(false);
  });

  it('should parse svc_playerinfo', () => {
    const data: number[] = [];
    writeByte(data, ServerCommand.playerinfo);

    const flags = 2 | 256; // ORIGIN (2) + VIEWANGLES (256)
    writeShort(data, flags);

    // ORIGIN
    writeShort(data, 10); writeShort(data, 20); writeShort(data, 30);

    // VIEWANGLES
    writeAngle16(data, 0); writeAngle16(data, 90); writeAngle16(data, 180);

    // STATS
    writeLong(data, 0); // No stats

    const stream = createStream(data);
    const parser = new NetworkMessageParser(stream);
    parser.parseMessage();
    expect(stream.hasMore()).toBe(false);
  });

  it('should parse svc_packetentities with termination', () => {
    const data: number[] = [];
    writeByte(data, ServerCommand.packetentities);

    // Entity 1: minimal bits (number 8bit)
    // bits = 0 (implies number 8bit comes next)
    // Actually bits is first byte.
    // U_NUMBER16 is 1<<8. So if high bit not set, number is byte.
    // Let's send bits=0 (only bits 0-7), followed by number=1
    writeByte(data, 0);
    writeByte(data, 1); // Number 1

    // Entity 0: termination
    writeByte(data, 0); // bits=0
    writeByte(data, 0); // number=0 -> Break

    const stream = createStream(data);
    const parser = new NetworkMessageParser(stream);
    parser.parseMessage();
    expect(stream.hasMore()).toBe(false);
  });

  it('should parse svc_temp_entity', () => {
      const data: number[] = [];
      writeByte(data, ServerCommand.temp_entity);
      writeByte(data, TempEntity.EXPLOSION1);
      writeCoord(data, 100); writeCoord(data, 200); writeCoord(data, 300);

      const stream = createStream(data);
      const parser = new NetworkMessageParser(stream);
      parser.parseMessage();
      expect(stream.hasMore()).toBe(false);
  });

  it('should be resilient to unknown commands', () => {
      const data: number[] = [];
      writeByte(data, 255); // Unknown command
      // Should stop or log warning but not crash
      // (in our impl we return on unknown cmd to avoid desync, or we consume if we knew length)
      // Since we don't know length, we return.

      const stream = createStream(data);
      const parser = new NetworkMessageParser(stream);
      parser.parseMessage();
      // It should have stopped reading.
      expect(stream.hasMore()).toBe(false); // It consumed the byte and returned
  });

  it('should parse complex sequence: frame -> playerinfo -> packetentities', () => {
      const data: number[] = [];
      // svc_frame (proto 34 default)
      writeByte(data, ServerCommand.frame);
      writeLong(data, 1); writeLong(data, 1); writeByte(data, 0); writeByte(data, 0);

      // svc_playerinfo
      writeByte(data, ServerCommand.playerinfo);
      writeShort(data, 0); // No flags
      writeLong(data, 0); // No stats

      // svc_packetentities
      writeByte(data, ServerCommand.packetentities);
      writeByte(data, 0); writeByte(data, 0); // Terminate

      const stream = createStream(data);
      const parser = new NetworkMessageParser(stream);
      parser.parseMessage();
      expect(stream.hasMore()).toBe(false);
  });

});
