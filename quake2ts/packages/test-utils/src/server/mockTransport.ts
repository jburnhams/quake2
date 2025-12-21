import { NetChan } from '@quake2ts/shared';

export interface RecordedPacket {
  type: 'sent' | 'received';
  timestamp: number;
  data: Uint8Array;
}

export class MockNetworkTransport {
  public netchan: NetChan;
  public recordedPackets: RecordedPacket[] = [];
  public sentPackets: Uint8Array[] = [];

  constructor() {
    this.netchan = new NetChan();
    this.netchan.setup(1234, { type: 'loopback', port: 0 });
  }

  reset() {
    this.recordedPackets = [];
    this.sentPackets = [];
    this.netchan.reset();
  }

  // Simulate receiving data from the "server"
  receive(data: Uint8Array) {
    this.recordedPackets.push({
      type: 'received',
      timestamp: Date.now(),
      data: new Uint8Array(data)
    });
    return this.netchan.process(data);
  }

  // Simulate sending data (called by the client using this transport)
  transmit(unreliableData?: Uint8Array) {
    const packet = this.netchan.transmit(unreliableData);
    this.recordedPackets.push({
      type: 'sent',
      timestamp: Date.now(),
      data: new Uint8Array(packet)
    });
    this.sentPackets.push(new Uint8Array(packet));
    return packet;
  }

  get lastSentPacket() {
    return this.sentPackets.length > 0 ? this.sentPackets[this.sentPackets.length - 1] : undefined;
  }
}
