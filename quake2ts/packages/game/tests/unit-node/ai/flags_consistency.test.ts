import { describe, it, expect } from 'vitest';
import { AiFlags as EntityAiFlags } from '../../../src/entities/entity.js';
import { AIFlags as AiConstantsFlags } from '../../../src/ai/constants.js';

describe('AI Flags Consistency', () => {
  it('should have consistent ManualSteering / ManualTarget flags', () => {
    // Both should now map to bit 11 (2048)
    expect(EntityAiFlags.ManualTarget).toBe(1 << 11);
    expect(EntityAiFlags.ManualSteering).toBe(1 << 11);
    expect(AiConstantsFlags.ManualSteering).toBe(1 << 11);
    expect(EntityAiFlags.ManualSteering).toBe(AiConstantsFlags.ManualSteering);
  });

  it('should have consistent Ducked flags', () => {
    // Bit 12 (4096)
    expect(EntityAiFlags.Ducked).toBe(1 << 12);
    expect(AiConstantsFlags.Ducked).toBe(1 << 12);
    expect(EntityAiFlags.Ducked).toBe(AiConstantsFlags.Ducked);
  });

  it('should have consistent CombatPoint flags', () => {
    // Bit 13 (8192)
    expect(EntityAiFlags.CombatPoint).toBe(1 << 13);
    expect(AiConstantsFlags.CombatPoint).toBe(1 << 13);
    expect(EntityAiFlags.CombatPoint).toBe(AiConstantsFlags.CombatPoint);
  });

  it('should have consistent Medic flags', () => {
    // Bit 14 (16384)
    expect(EntityAiFlags.Medic).toBe(1 << 14);
    expect(AiConstantsFlags.Medic).toBe(1 << 14);
    expect(EntityAiFlags.Medic).toBe(AiConstantsFlags.Medic);
  });

  it('should have consistent HoldFrame / FixTarget / Resurrecting flags', () => {
    // Q2 AI_HOLD_FRAME is 0x80 (128, bit 7)
    // Q2 AI_RESURRECTING is 0x8000 (32768, bit 15)

    // Entity.ts previously had HoldFrame at bit 14, now it should be alias for FixTarget (bit 7)
    // OR we aligned it to constants.ts which has HoldFrame at bit 7.

    // Wait, in my change to Entity.ts I added:
    // HoldFrame = 1 << 7,
    // FixTarget = HoldFrame,

    expect(EntityAiFlags.HoldFrame).toBe(1 << 7);
    expect(AiConstantsFlags.HoldFrame).toBe(1 << 7);
    expect(EntityAiFlags.HoldFrame).toBe(AiConstantsFlags.HoldFrame);

    expect(EntityAiFlags.FixTarget).toBe(1 << 7);

    // Resurrecting
    expect(EntityAiFlags.Resurrecting).toBe(1 << 15);
    expect(AiConstantsFlags.Resurrecting).toBe(1 << 15);
    expect(EntityAiFlags.Resurrecting).toBe(AiConstantsFlags.Resurrecting);
  });

  it('should match all standard flags', () => {
    expect(EntityAiFlags.StandGround).toBe(AiConstantsFlags.StandGround);
    expect(EntityAiFlags.TempStandGround).toBe(AiConstantsFlags.TempStandGround);
    expect(EntityAiFlags.SoundTarget).toBe(AiConstantsFlags.SoundTarget);
    expect(EntityAiFlags.SightCover).toBe(AiConstantsFlags.LostSight); // Aliased
    expect(EntityAiFlags.Chicken).toBe(AiConstantsFlags.PursuitLastSeen); // Aliased
    expect(EntityAiFlags.Flee).toBe(AiConstantsFlags.PursueNext); // Aliased
    expect(EntityAiFlags.Stand).toBe(AiConstantsFlags.PursueTemp); // Aliased
    expect(EntityAiFlags.GoodGuy).toBe(AiConstantsFlags.GoodGuy);
    expect(EntityAiFlags.BrtMove).toBe(AiConstantsFlags.Brutal); // Aliased
    expect(EntityAiFlags.DoNotCount).toBe(AiConstantsFlags.NoStep); // Aliased
  });
});
