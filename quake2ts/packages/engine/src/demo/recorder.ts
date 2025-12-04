import { BinaryWriter } from '@quake2ts/shared';

export class DemoRecorder {
  private isRecording: boolean = false;
  private messageBuffer: BinaryWriter;
  private startTime: number = 0;
  private frameCount: number = 0;
  private filename: string | null = null;
  private lastMessageSize: number = -1; // -1 means start of demo

  constructor() {
    this.messageBuffer = new BinaryWriter(1024 * 1024); // 1MB initial
  }

  public startRecording(filename: string, startTime: number = 0): void {
    if (this.isRecording) return;

    this.isRecording = true;
    this.filename = filename;
    this.startTime = startTime;
    this.frameCount = 0;
    this.messageBuffer.reset();

    // Write header if needed?
    // Quake 2 demos don't strictly have a file header, just -1 size message as terminator?
    // Wait, the format is [Length][Data].
    // There is no global header at file start for .dm2.
    // However, usually the first message is ServerData.
    // Some implementations might write a CDemo header, but vanilla Q2 seems to just write blocks.
    // Let's assume standard block stream.

    console.log(`DemoRecorder: Started recording to ${filename}`);
  }

  public recordMessage(data: Uint8Array): void {
    if (!this.isRecording) return;

    // Write Length (4 bytes)
    this.messageBuffer.writeLong(data.byteLength);

    // Write Data
    // BinaryWriter doesn't have writeBytes, so we might need to extend it or loop.
    // Or access buffer directly.
    // The BinaryWriter in shared/io/binaryWriter.ts has `getData()` but no generic `writeBytes`.
    // I should check if I can use writeByte in loop or if I should implement writeBytes.
    // Writing byte by byte is slow.
    // Let's check BinaryWriter again.
    // It has `ensureSpace`.
    // I can modify BinaryWriter or hack it here.
    // Actually, I can create a new Uint8Array combining existing + new data? No, slow.
    // I'll assume I can add writeBytes to BinaryWriter or use a loop for now.
    // Loop is acceptable for JS? `set` is better.
    // BinaryWriter exposes buffer via `getBuffer()`.
    // Wait, `this.view` and `this.buffer` are private.
    // But `writeString` loops.

    // Let's implement writeBytes extension or utility if possible.
    // For now, I'll use a loop to be safe with existing API.
    for(let i=0; i<data.length; i++) {
        this.messageBuffer.writeByte(data[i]);
    }

    this.frameCount++;
  }

  public stopRecording(): Uint8Array | null {
    if (!this.isRecording) return null;

    this.isRecording = false;

    // Write EOF?
    // Q2 demos end when file ends or with a -1 length block.
    // cl_main.c: CL_Stop_f -> CL_FinishDemo -> writes -1 to demofile.
    this.messageBuffer.writeLong(-1);

    console.log(`DemoRecorder: Stopped recording. Frames: ${this.frameCount}, Size: ${this.messageBuffer.getOffset()} bytes`);

    return this.messageBuffer.getData();
  }

  public getIsRecording(): boolean {
      return this.isRecording;
  }
}
