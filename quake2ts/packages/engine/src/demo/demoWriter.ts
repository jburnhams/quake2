import { BinaryWriter } from '@quake2ts/shared';

export class DemoWriter {
    private writer: BinaryWriter;

    constructor() {
        this.writer = new BinaryWriter();
    }

    public writeBlock(data: Uint8Array): void {
        this.writer.writeLong(data.byteLength);
        this.writer.writeBytes(data);
    }

    public writeEOF(): void {
        this.writer.writeLong(-1);
    }

    public getData(): Uint8Array {
        return this.writer.getData();
    }
}
