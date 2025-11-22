import { describe, it, expect } from 'vitest';
import { ServerCommand, ClientCommand } from '../../src/protocol/ops.js';

describe('Protocol Opcodes', () => {
  it('should define ServerCommand enum correctly', () => {
    expect(ServerCommand.bad).toBe(0);
    expect(ServerCommand.muzzleflash).toBe(1);
    expect(ServerCommand.muzzleflash2).toBe(2);
    expect(ServerCommand.temp_entity).toBe(3);
    expect(ServerCommand.layout).toBe(4);
    expect(ServerCommand.inventory).toBe(5);
    expect(ServerCommand.nop).toBe(6);
    expect(ServerCommand.disconnect).toBe(7);
    expect(ServerCommand.reconnect).toBe(8);
    expect(ServerCommand.sound).toBe(9);
    expect(ServerCommand.print).toBe(10);
    expect(ServerCommand.stufftext).toBe(11);
    expect(ServerCommand.serverdata).toBe(12);
    expect(ServerCommand.configstring).toBe(13);
    expect(ServerCommand.spawnbaseline).toBe(14);
    expect(ServerCommand.centerprint).toBe(15);
    expect(ServerCommand.download).toBe(16);
    expect(ServerCommand.playerinfo).toBe(17);
    expect(ServerCommand.packetentities).toBe(18);
    expect(ServerCommand.deltapacketentities).toBe(19);
    expect(ServerCommand.frame).toBe(20);
  });

  it('should define ClientCommand enum correctly', () => {
    expect(ClientCommand.bad).toBe(0);
    expect(ClientCommand.nop).toBe(1);
    expect(ClientCommand.move).toBe(2);
    expect(ClientCommand.userinfo).toBe(3);
    expect(ClientCommand.stringcmd).toBe(4);
  });
});
