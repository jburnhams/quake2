import { PakArchive, Pic, Renderer } from '@quake2ts/engine';
import { PlayerState, angleVectors, dotVec3, Vec3 } from '@quake2ts/shared';

const damagePics = new Map<string, Pic>();

const DAMAGE_INDICATOR_NAMES = [
    'd_left', 'd_right', 'd_up', 'd_down'
];

export const Init_Damage = async (renderer: Renderer, pak: PakArchive) => {
    for (const name of DAMAGE_INDICATOR_NAMES) {
        try {
            const data = pak.readFile(`pics/${name}.pcx`);
            const pic = await renderer.registerPic(name, data.buffer as ArrayBuffer);
            damagePics.set(name, pic);
        } catch (e) {
            console.error(`Failed to load HUD image: pics/${name}.pcx`);
        }
    }
};

export const Draw_Damage = (renderer: Renderer, ps: PlayerState) => {
    if (!ps.damageIndicators) {
        return;
    }

    const screenWidth = renderer.width;
    const screenHeight = renderer.height;

    const { forward, right, up } = angleVectors(ps.viewAngles);

    for (const indicator of ps.damageIndicators) {
        const { direction, strength } = indicator;

        const normalizedDirection = { ...direction };
        const len = Math.sqrt(normalizedDirection.x * normalizedDirection.x + normalizedDirection.y * normalizedDirection.y + normalizedDirection.z * normalizedDirection.z);
        if (len > 0) {
            normalizedDirection.x /= len;
            normalizedDirection.y /= len;
            normalizedDirection.z /= len;
        }

        const rightDot = dotVec3(normalizedDirection, right);
        const forwardDot = dotVec3(normalizedDirection, forward);

        const angle = Math.atan2(forwardDot, rightDot) * 180 / Math.PI;

        let pic: Pic | undefined;
        let x = 0;
        let y = 0;

        if (angle > -45 && angle <= 45) {
            pic = damagePics.get('d_right');
            x = screenWidth - (pic?.width || 0);
            y = (screenHeight - (pic?.height || 0)) / 2;
        } else if (angle > 45 && angle <= 135) {
            pic = damagePics.get('d_up');
            x = (screenWidth - (pic?.width || 0)) / 2;
            y = 0;
        } else if (angle > 135 || angle <= -135) {
            pic = damagePics.get('d_left');
            x = 0;
            y = (screenHeight - (pic?.height || 0)) / 2;
        } else {
            pic = damagePics.get('d_down');
            x = (screenWidth - (pic?.width || 0)) / 2;
            y = screenHeight - (pic?.height || 0);
        }
        
        if (pic) {
            renderer.drawPic(x, y, pic);
        }
    }
};
