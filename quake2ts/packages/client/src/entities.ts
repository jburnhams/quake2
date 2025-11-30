
import { EntityState } from '@quake2ts/shared';
import { RenderableEntity, Renderer } from '@quake2ts/engine';
import { mat4 } from 'gl-matrix';
import { ClientConfigStrings } from './configStrings.js';
import { ClientImports } from './index.js';

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpAngle(a: number, b: number, t: number): number {
    // Simple lerp for now, should ideally handle wrapping
    return lerp(a, b, t);
}

export function buildRenderableEntities(
    latestEntities: EntityState[],
    previousEntities: EntityState[],
    alpha: number,
    configStrings: ClientConfigStrings,
    imports: ClientImports
): RenderableEntity[] {
    const renderables: RenderableEntity[] = [];
    const assets = imports.engine.assets;
    if (!assets) return renderables;

    const prevMap = new Map(previousEntities.map(e => [e.number, e]));

    for (const ent of latestEntities) {
        const prev = prevMap.get(ent.number) ?? ent;

        const modelName = configStrings.getModelName(ent.modelIndex);
        if (!modelName) continue;

        const model = assets.getMd2Model(modelName) || assets.getMd3Model(modelName);
        if (!model) continue;

        // Interpolate origin and angles
        const origin = {
            x: lerp(prev.origin.x, ent.origin.x, alpha),
            y: lerp(prev.origin.y, ent.origin.y, alpha),
            z: lerp(prev.origin.z, ent.origin.z, alpha)
        };

        const angles = {
            x: lerpAngle(prev.angles.x, ent.angles.x, alpha),
            y: lerpAngle(prev.angles.y, ent.angles.y, alpha),
            z: lerpAngle(prev.angles.z, ent.angles.z, alpha)
        };

        // Animation interpolation
        const frame = ent.frame;
        const prevFrame = prev.frame;

        // Scale interpolation
        // Default to 1.0 if not set (or 0 means 1 in legacy, but new field implies explicit)
        // If scale is 0 in both, use 1. If 0 in one, interpolate from 0?
        // Usually 0 means default 1.
        const scaleA: number = (prev.scale !== undefined) ? prev.scale : 1.0;
        const scaleB: number = (ent.scale !== undefined) ? ent.scale : 1.0;
        const scale = lerp(scaleA, scaleB, alpha);

        // Alpha interpolation
        // Alpha is typically 0-255. 0 means opaque/default usually?
        // Or 255 opaque. Rerelease behavior: 0 might be "default" (255).
        // If undefined/0, assume 255 (opaque).
        const getAlpha = (val: number | undefined) => (val === undefined || val === 0) ? 255 : val;
        const alphaA = getAlpha(prev.alpha);
        const alphaB = getAlpha(ent.alpha);
        const alphaVal = lerp(alphaA, alphaB, alpha);
        const normalizedAlpha = alphaVal / 255.0;

        const mat = mat4.create();
        mat4.translate(mat, mat, [origin.x, origin.y, origin.z]);
        mat4.rotateZ(mat, mat, angles.z * Math.PI / 180);
        mat4.rotateY(mat, mat, angles.y * Math.PI / 180);
        mat4.rotateX(mat, mat, angles.x * Math.PI / 180);
        mat4.scale(mat, mat, [scale, scale, scale]);


        if (model.header.magic === 844121161) { // IDP2 (MD2)
             renderables.push({
                type: 'md2',
                model: model as any, // Cast to Md2Model
                blend: {
                    frame0: prevFrame,
                    frame1: frame,
                    lerp: alpha
                },
                transform: mat as Float32Array,
                skin: ent.skinNum > 0 ? configStrings.getImageName(ent.skinNum) : undefined,
                alpha: normalizedAlpha
             });
        } else if (model.header.magic === 860898377) { // IDP3 (MD3)
             renderables.push({
                type: 'md3',
                model: model as any,
                blend: {
                    frame0: prevFrame,
                    frame1: frame,
                    lerp: alpha
                },
                transform: mat as Float32Array,
                alpha: normalizedAlpha
                // Lighting? Skins?
             });
        }
    }

    return renderables;
}
