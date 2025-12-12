import { DynamicLightManager, EngineImports, EntityState } from '@quake2ts/engine';
import {
  Vec3,
  MZ_BLASTER, MZ_MACHINEGUN, MZ_SHOTGUN, MZ_CHAINGUN1, MZ_CHAINGUN2, MZ_CHAINGUN3,
  MZ_RAILGUN, MZ_ROCKET, MZ_GRENADE, MZ_LOGIN, MZ_LOGOUT, MZ_SSHOTGUN, MZ_BFG, MZ_HYPERBLASTER,
  MZ_BLUEHYPERBLASTER, MZ_PHALANX, MZ_IONRIPPER, MZ_ETF_RIFLE, MZ_HEATBEAM,
  MZ_BLASTER2, MZ_TRACKER, MZ_NUKE1, MZ_NUKE2, MZ_NUKE4, MZ_NUKE8,
  TempEntity,
  angleVectors
} from '@quake2ts/shared';

// Helper to copy vec3
const copyVec3 = (v: Vec3): Vec3 => ({ x: v.x, y: v.y, z: v.z });

// Helper to scale and add
const vectorMA = (start: Vec3, scale: number, dir: Vec3): Vec3 => ({
    x: start.x + dir.x * scale,
    y: start.y + dir.y * scale,
    z: start.z + dir.z * scale
});

export interface EntityProvider {
    getEntity(entNum: number): EntityState | undefined;
    getPlayerNum(): number;
}

export class ClientEffectSystem {
    private dlightManager: DynamicLightManager;
    private engine: EngineImports;
    private entityProvider: EntityProvider;

    constructor(dlightManager: DynamicLightManager, engine: EngineImports, entityProvider: EntityProvider) {
        this.dlightManager = dlightManager;
        this.engine = engine;
        this.entityProvider = entityProvider;
    }

    // Helper to add dlight
    private addLight(key: number | undefined, origin: Vec3, color: Vec3, radius: number, minLight: number, die: number, radiusSpeed: number = 0) {
        this.dlightManager.addLight({
            key,
            origin: copyVec3(origin),
            color,
            intensity: radius,
            minLight,
            die: die,
            radiusSpeed
        }, 0);
    }

    private playSound(pos: Vec3 | null, ent: number, soundName: string, vol: number = 1.0, attn: number = 1.0) {
        if (!this.engine.audio) return;

        const index = this.engine.audio.soundindex(soundName);
        if (index === 0) return;

        if (pos) {
            this.engine.audio.positioned_sound(pos, index, vol, attn);
        } else {
            this.engine.audio.sound(ent, 0, index, vol, attn, 0);
        }
    }

    public onMuzzleFlash(entNum: number, weapon: number, time: number) {
        const ent = this.entityProvider.getEntity(entNum);
        if (!ent) return;

        const origin = { x: ent.origin.x, y: ent.origin.y, z: ent.origin.z };
        const angles = { x: ent.angles.x, y: ent.angles.y, z: ent.angles.z };

        const vectors = angleVectors(angles);
        let flashOrigin = vectorMA(origin, 18, vectors.forward);
        flashOrigin = vectorMA(flashOrigin, 16, vectors.right);

        const silenced = (weapon & 128) !== 0;
        weapon &= ~128;

        const minLight = 32;
        const duration = 0.1;
        const die = time + duration;
        const volume = silenced ? 0.2 : 1.0;

        let radius = silenced ? 100 : 200;
        if (Math.random() < 0.5) radius += Math.random() * 31;

        let color: Vec3 = { x: 1, y: 1, z: 0 }; // Default yellow

        switch (weapon) {
            case MZ_BLASTER:
                radius = 150;
                color = { x: 1, y: 1, z: 0 };
                break;
            case MZ_MACHINEGUN:
            case MZ_CHAINGUN1:
            case MZ_CHAINGUN2:
            case MZ_CHAINGUN3:
                 radius = 150;
                 color = { x: 1, y: 1, z: 0 };
                 break;
            case MZ_SHOTGUN:
            case MZ_SSHOTGUN:
                 radius = 200;
                 color = { x: 1, y: 1, z: 0 };
                 break;
            case MZ_HYPERBLASTER:
                 radius = 250;
                 color = { x: 1, y: 1, z: 0 };
                 break;
            case MZ_BLUEHYPERBLASTER:
                radius = 250;
                color = { x: 0, y: 0, z: 1 };
                break;

            case MZ_RAILGUN:
                radius = 150;
                color = { x: 0.5, y: 0.5, z: 1.0 };
                break;

            case MZ_ROCKET:
            case MZ_GRENADE:
                radius = 300;
                color = { x: 1, y: 0.5, z: 0.2 };
                break;

            case MZ_BFG:
                radius = 400;
                color = { x: 0, y: 1, z: 0 };
                break;
        }

        if (silenced) radius *= 0.75;

        this.addLight(entNum, flashOrigin, color, radius, minLight, die);

        let soundName = '';
        switch (weapon) {
             case MZ_BLASTER: soundName = "weapons/blastf1a.wav"; break;
             case MZ_SHOTGUN: soundName = "weapons/shotgf1b.wav"; break;
             case MZ_SSHOTGUN: soundName = "weapons/sshotf1b.wav"; break;
             case MZ_MACHINEGUN: soundName = `weapons/machgf${Math.floor(Math.random()*5)+1}b.wav`; break;
             case MZ_RAILGUN: soundName = "weapons/railgf1a.wav"; break;
             case MZ_ROCKET: soundName = "weapons/rocklf1a.wav"; break;
             case MZ_GRENADE: soundName = "weapons/grenlf1a.wav"; break;
             case MZ_BFG: soundName = "weapons/bfg__f1y.wav"; break;
             case MZ_HYPERBLASTER: soundName = "weapons/hyprbf1a.wav"; break;
             case MZ_BLUEHYPERBLASTER: soundName = "weapons/hyprbf1a.wav"; break;
             case MZ_CHAINGUN1:
             case MZ_CHAINGUN2:
             case MZ_CHAINGUN3:
                 // In C, these play multiple sounds with delays.
                 // For now, simplify to one primary sound.
                 soundName = `weapons/machgf${Math.floor(Math.random()*5)+1}b.wav`;
                 break;
        }

        if (soundName) {
            this.playSound(null, entNum, soundName, volume, 1.0);
        }
    }

    public onTempEntity(type: number, pos: Vec3, time: number) {
         switch (type) {
             case TempEntity.EXPLOSION1:
             case TempEntity.EXPLOSION1_BIG:
             case TempEntity.EXPLOSION1_NP:
             case TempEntity.ROCKET_EXPLOSION:
             case TempEntity.GRENADE_EXPLOSION:
             case TempEntity.ROCKET_EXPLOSION_WATER:
             case TempEntity.GRENADE_EXPLOSION_WATER:
                 {
                     const color: Vec3 = { x: 1, y: 0.5, z: 0.2 };
                     const duration = 0.5;
                     const startRadius = 50;
                     const endRadius = 400; // Expanding to 400
                     // Speed = delta / duration = 350 / 0.5 = 700
                     const speed = (endRadius - startRadius) / duration;

                     this.addLight(undefined, pos, color, startRadius, 0, time + duration, speed);
                     this.playSound(pos, 0, "weapons/rocklx1a.wav", 1.0, 0.5);
                 }
                 break;

             case TempEntity.BFG_EXPLOSION:
             case TempEntity.BFG_BIGEXPLOSION:
                 {
                     const color: Vec3 = { x: 0, y: 1, z: 0 };
                     const duration = 0.5;
                     const startRadius = 200;
                     const endRadius = 500;
                     const speed = (endRadius - startRadius) / duration;
                     this.addLight(undefined, pos, color, startRadius, 0, time + duration, speed);
                     this.playSound(pos, 0, "weapons/bfg__x1b.wav", 1.0, 0.5);
                 }
                 break;
         }
    }
}
