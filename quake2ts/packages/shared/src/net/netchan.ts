import { BinaryWriter } from '../io/binaryWriter.js';

// qcommon/qcommon.h
export interface NetAddress {
  type: string;
  port: number;
}

// qcommon/qcommon.h
export const MAX_MSGLEN = 1400;
export const FRAGMENT_SIZE = 1024;
export const PACKET_HEADER = 10;

/**
 * NetChan implementation based on qcommon/net_chan.c
 * Handles reliable and unreliable message sequencing and transmission.
 */
export class NetChan {
  public qport: number = 0;
  public remoteAddress: NetAddress = { type: 'loopback', port: 0 };

  public incomingSequence: number = 0;
  public outgoingSequence: number = 0;

  public incomingAcknowledged: number = 0;
  public incomingReliableAcknowledged: boolean = false;

  public incomingReliableSequence: number = 0;
  public outgoingReliableSequence: number = 0;

  public reliableMessage: BinaryWriter;
  public reliableLength: number = 0;

  public lastReceived: number = 0;
  public lastSent: number = 0;

  constructor() {
    // Netchan_Init / Netchan_Setup logic
    this.qport = Math.floor(Math.random() * 65536);
    this.reliableMessage = new BinaryWriter(new Uint8Array(MAX_MSGLEN));
    this.lastSent = Date.now();
    this.lastReceived = Date.now();
  }
}
