
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkCapture, captureFlag } from '../../../src/modes/ctf/capture';
import { FlagEntity, FlagState } from '../../../src/modes/ctf/state';
import { Entity, Solid } from '../../../src/entities/entity';
import { EntitySystem } from '../../../src/entities/system';
import { GameExports } from '../../../src/index';
import { KeyId } from '../../../src/inventory/playerInventory';
import { createTestContext } from '@quake2ts/test-utils';

describe('CTF Capture Logic', () => {
  let context: EntitySystem;
  let game: GameExports;
  let redFlag: FlagEntity;
  let blueFlag: FlagEntity;
  let player: Entity;

  beforeEach(async () => {
    // Basic mocks
    const testCtx = await createTestContext();
    context = testCtx.entities;
    game = testCtx.game;

    // Ensure game.sound and game.centerprintf are spies
    game.sound = vi.fn();
    game.centerprintf = vi.fn();

    // Red flag setup
    redFlag = {
      classname: 'item_flag_team1',
      flagTeam: 'red',
      flagState: FlagState.AT_BASE,
      baseOrigin: { x: 100, y: 0, z: 0 },
      origin: { x: 100, y: 0, z: 0 },
      solid: Solid.Trigger,
    } as FlagEntity;

    // Blue flag setup
    blueFlag = {
      classname: 'item_flag_team2',
      flagTeam: 'blue',
      flagState: FlagState.CARRIED, // Assumed carried by player
      baseOrigin: { x: -100, y: 0, z: 0 },
      origin: { x: -100, y: 0, z: 0 },
      solid: Solid.Not,
    } as FlagEntity;

    // Mock EntitySystem iteration to find flags
    const entities = [redFlag, blueFlag];
    context.forEachEntity = (callback: (ent: Entity) => void) => {
        entities.forEach(callback);
    };

    // Player setup
    player = {
      client: {
        inventory: {
          items: new Map(),
          ammo: { counts: new Float32Array(), limits: new Float32Array() },
          keys: new Set(),
          weapons: new Set(),
        },
        score: 0,
        // Mock team property
        team: 'red',
      },
      classname: 'player',
    } as unknown as Entity;
  });

  describe('checkCapture', () => {
    it('should return false if player team does not match flag team', () => {
      // Player is red, touching blue flag
      expect(checkCapture(blueFlag, player, game, context)).toBe(false);
    });

    it('should return false if own flag is not at base', () => {
      redFlag.flagState = FlagState.DROPPED;
      expect(checkCapture(redFlag, player, game, context)).toBe(false);
    });

    it('should return false if player does not have enemy flag', () => {
      // Player has no keys
      expect(checkCapture(redFlag, player, game, context)).toBe(false);
    });

    it('should call captureFlag and return true if conditions met', () => {
      // Give player blue flag
      player.client!.inventory.keys.add(KeyId.BlueFlag);

      // Spy on captureFlag logic indirectly by checking score change or similar,
      // but captureFlag is called directly.
      // Since checkCapture calls captureFlag which we can't easily mock (same module),
      // we check the side effects of captureFlag.

      const result = checkCapture(redFlag, player, game, context);
      expect(result).toBe(true);
      expect(player.client!.score).toBe(5);
    });
  });

  describe('captureFlag', () => {
    beforeEach(() => {
        player.client!.inventory.keys.add(KeyId.BlueFlag);
    });

    it('should award 5 points to player', () => {
      captureFlag(redFlag, player, game, context);
      expect(player.client!.score).toBe(5);
    });

    it('should remove enemy flag from player inventory', () => {
      captureFlag(redFlag, player, game, context);
      expect(player.client!.inventory.keys.has(KeyId.BlueFlag)).toBe(false);
    });

    it('should reset enemy flag entity to base', () => {
      // Blue flag is currently CARRIED
      expect(blueFlag.flagState).toBe(FlagState.CARRIED);

      captureFlag(redFlag, player, game, context);

      expect(blueFlag.flagState).toBe(FlagState.AT_BASE);
      expect(blueFlag.solid).toBe(Solid.Trigger);
      expect(blueFlag.owner).toBeNull();
    });

    it('should play capture sound and message', () => {
      captureFlag(redFlag, player, game, context);
      expect(game.sound).toHaveBeenCalledWith(player, 0, 'ctf/flagcap.wav', 1, 1, 0);
      expect(game.centerprintf).toHaveBeenCalledWith(player, 'You captured the flag!');
    });
  });
});
