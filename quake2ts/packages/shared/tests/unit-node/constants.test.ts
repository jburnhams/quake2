import { describe, it, expect } from 'vitest';
import {
  CONTENTS_SOLID,
  CONTENTS_WINDOW,
  CONTENTS_AUX,
  CONTENTS_LAVA,
  CONTENTS_SLIME,
  CONTENTS_WATER,
  CONTENTS_MIST,
  CONTENTS_TRIGGER,
  CONTENTS_NO_WATERJUMP,
  CONTENTS_PROJECTILECLIP,
  CONTENTS_AREAPORTAL,
  CONTENTS_PLAYERCLIP,
  CONTENTS_MONSTERCLIP,
  CONTENTS_CURRENT_0,
  CONTENTS_CURRENT_90,
  CONTENTS_CURRENT_180,
  CONTENTS_CURRENT_270,
  CONTENTS_CURRENT_UP,
  CONTENTS_CURRENT_DOWN,
  CONTENTS_ORIGIN,
  CONTENTS_MONSTER,
  CONTENTS_DEADMONSTER,
  CONTENTS_DETAIL,
  CONTENTS_TRANSLUCENT,
  CONTENTS_LADDER,
  CONTENTS_PLAYER,
  CONTENTS_PROJECTILE,
  SURF_LIGHT,
  SURF_SLICK,
  SURF_SKY,
  SURF_WARP,
  SURF_TRANS33,
  SURF_TRANS66,
  SURF_FLOWING,
  SURF_NODRAW,
  SURF_ALPHATEST,
} from '../../src/bsp/contents.js';
import { ServerCommand, ClientCommand } from '../../src/protocol/ops.js';

describe('Shared Constants Verification', () => {
  describe('BSP Contents Flags', () => {
    it('should match standard Quake 2 values', () => {
      expect(CONTENTS_SOLID).toBe(1);
      expect(CONTENTS_WINDOW).toBe(2);
      expect(CONTENTS_AUX).toBe(4);
      expect(CONTENTS_LAVA).toBe(8);
      expect(CONTENTS_SLIME).toBe(16);
      expect(CONTENTS_WATER).toBe(32);
      expect(CONTENTS_MIST).toBe(64);
    });

    it('should match expected higher bit flags', () => {
      expect(CONTENTS_AREAPORTAL).toBe(0x8000);
      expect(CONTENTS_PLAYERCLIP).toBe(0x10000);
      expect(CONTENTS_MONSTERCLIP).toBe(0x20000);

      expect(CONTENTS_CURRENT_0).toBe(0x40000);
      expect(CONTENTS_CURRENT_90).toBe(0x80000);
      expect(CONTENTS_CURRENT_180).toBe(0x100000);
      expect(CONTENTS_CURRENT_270).toBe(0x200000);
      expect(CONTENTS_CURRENT_UP).toBe(0x400000);
      expect(CONTENTS_CURRENT_DOWN).toBe(0x800000);

      expect(CONTENTS_ORIGIN).toBe(0x1000000);
      expect(CONTENTS_MONSTER).toBe(0x2000000);
      expect(CONTENTS_DEADMONSTER).toBe(0x4000000);
      expect(CONTENTS_DETAIL).toBe(0x8000000);
      expect(CONTENTS_TRANSLUCENT).toBe(0x10000000);
      expect(CONTENTS_LADDER).toBe(0x20000000);
    });

    it('should verify Rerelease/Extension flags', () => {
      // These are likely specific to the rerelease or this port's needs
      // Checking they are unique and don't unintentionally overlap

      // CONTENTS_TRIGGER = 0x40000000
      // CONTENTS_PLAYER = 1 << 30 = 0x40000000
      expect(CONTENTS_TRIGGER).toBe(CONTENTS_PLAYER);

      // 1 << 31 results in a signed 32-bit integer (negative) in JS bitwise ops
      // 0x80000000 is a positive number in JS
      // We cast the hex constant to a signed 32-bit int using `| 0` to compare
      expect(CONTENTS_PROJECTILE).toBe(0x80000000 | 0);
    });
  });

  describe('Protocol Ops', () => {
    it('should match Quake 2 Protocol 34 server commands', () => {
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

    it('should match Client commands', () => {
      expect(ClientCommand.nop).toBe(1);
      expect(ClientCommand.move).toBe(2);
      expect(ClientCommand.userinfo).toBe(3);
      expect(ClientCommand.stringcmd).toBe(4);
    });
  });
});
