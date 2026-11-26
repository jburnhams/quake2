import { CGameImport } from '../types.js';
import { PlayerState, Vec3, dotVec3, angleVectors } from '@quake2ts/shared';

const damagePics = new Map<string, unknown>();

const DAMAGE_INDICATOR_NAMES = [
    'd_left', 'd_right', 'd_up', 'd_down'
];

export const Init_Damage = (cgi: CGameImport) => {
    for (const name of DAMAGE_INDICATOR_NAMES) {
        try {
            const pic = cgi.Draw_RegisterPic(`pics/${name}.pcx`);
            damagePics.set(name, pic);
        } catch (e) {
            cgi.Com_Print(`Failed to load HUD image: pics/${name}.pcx\n`);
        }
    }
};

const WHITE: Vec3 = { x: 1, y: 1, z: 1 };

export const Draw_Damage = (cgi: CGameImport, ps: PlayerState, width: number, height: number) => {
    // Check if we have damage to show
    if ((!ps.damageAlpha || ps.damageAlpha <= 0) && (!ps.damageIndicators || ps.damageIndicators.length === 0)) {
        return;
    }

    if (!ps.damageIndicators || ps.damageIndicators.length === 0) {
        return;
    }

    const cx = width * 0.5;
    const cy = height * 0.5;
    const { forward, right } = angleVectors(ps.viewAngles);

    // Draw indicators at a fixed radius from the center of the screen
    const radius = Math.min(width, height) * 0.25;

    for (const indicator of ps.damageIndicators) {
        // Project the direction vector onto the player's view plane
        // indicator.direction is assumed to be the vector pointing TO the damage source
        const localRight = dotVec3(indicator.direction, right);
        const localForward = dotVec3(indicator.direction, forward);

        // Calculate the angle relative to the player's view
        // 0 degrees = Right, 90 degrees = Forward
        const angle = Math.atan2(localForward, localRight) * (180 / Math.PI);

        let picName = '';
        let xOff = 0;
        let yOff = 0;

        // Map angle to quadrants
        if (angle >= 45 && angle < 135) {
            // Front (Up)
            picName = 'd_up';
            yOff = -radius;
        } else if (angle >= -45 && angle < 45) {
            // Right
            picName = 'd_right';
            xOff = radius;
        } else if (angle >= -135 && angle < -45) {
            // Back (Down)
            picName = 'd_down';
            yOff = radius;
        } else {
            // Left (angle >= 135 || angle < -135)
            picName = 'd_left';
            xOff = -radius;
        }

        const pic = damagePics.get(picName);
        if (pic) {
            const size = cgi.Draw_GetPicSize(pic);
            // Center the sprite at the calculated offset position
            const x = cx + xOff - size.width * 0.5;
            const y = cy + yOff - size.height * 0.5;

            // Use indicator strength as alpha, clamped to [0, 1]
            const alpha = Math.max(0, Math.min(1, indicator.strength));
            cgi.SCR_DrawColorPic(x, y, pic, WHITE, alpha);
        }
    }
};
