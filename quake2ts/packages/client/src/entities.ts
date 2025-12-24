
import { EntityState, RenderFx } from '@quake2ts/shared';
import { RenderableEntity, Renderer } from '@quake2ts/engine';
import { mat4, vec3 } from 'gl-matrix';
import { ClientConfigStrings } from './configStrings.js';
import { ClientImports } from './index.js';
import { lodRegistry } from './lod.js';

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpAngle(a: number, b: number, t: number): number {
    // Simple lerp for now, should ideally handle wrapping
    return lerp(a, b, t);
}

// Define a type that covers both Shared (camelCase) and Engine (lowercase) EntityState
// to avoid strict type mismatches when called from Demo Handler (Engine types).
type AnyEntityState = {
    number: number;
    origin: { x: number, y: number, z: number };
    angles: { x: number, y: number, z: number };
    frame: number;
    alpha?: number;
    scale?: number;
    // Shared uses camelCase
    modelIndex?: number;
    skinNum?: number;
    renderfx?: number;
    // Engine uses lowercase
    modelindex?: number;
    skinnum?: number;
};

export function buildRenderableEntities(
    latestEntities: AnyEntityState[],
    previousEntities: AnyEntityState[] | Map<number, AnyEntityState>,
    alpha: number,
    configStrings: ClientConfigStrings,
    imports: ClientImports,
    cameraPosition?: { x: number, y: number, z: number } // Optional camera position for LOD
): RenderableEntity[] {
    const renderables: RenderableEntity[] = [];
    const assets = imports.engine.assets;
    if (!assets) return renderables;

    let prevMap: Map<number, AnyEntityState>;
    if (previousEntities instanceof Map) {
        prevMap = previousEntities;
    } else {
        prevMap = new Map(previousEntities.map(e => [e.number, e]));
    }

    const camVec = cameraPosition ? vec3.fromValues(cameraPosition.x, cameraPosition.y, cameraPosition.z) : null;

    for (const ent of latestEntities) {
        const prev = prevMap.get(ent.number) ?? ent;

        // Normalize property access
        const modelIndex = ent.modelIndex ?? ent.modelindex;
        const skinNum = ent.skinNum ?? ent.skinnum;

        if (modelIndex === undefined) continue;

        let modelName = configStrings.getModelName(modelIndex);
        if (!modelName) continue;

        // Interpolate origin and angles
        const origin = {
            x: lerp(prev.origin.x, ent.origin.x, alpha),
            y: lerp(prev.origin.y, ent.origin.y, alpha),
            z: lerp(prev.origin.z, ent.origin.z, alpha)
        };

        // Check LOD
        if (camVec) {
            const dist = vec3.distance(camVec, vec3.fromValues(origin.x, origin.y, origin.z));
            const lodModel = lodRegistry.getLodModel(modelName, dist);
            if (lodModel) {
                // If the LOD model is loaded, use it. Otherwise stick to base.
                // We don't want to trigger sync loads or fail here.
                // Assuming LOD models are preloaded or check existence.
                if (assets.getMd2Model(lodModel) || assets.getMd3Model(lodModel)) {
                    modelName = lodModel;
                }
            }
        }

        const model = assets.getMd2Model(modelName) || assets.getMd3Model(modelName);
        if (!model) continue;

        const angles = {
            x: lerpAngle(prev.angles.x, ent.angles.x, alpha),
            y: lerpAngle(prev.angles.y, ent.angles.y, alpha),
            z: lerpAngle(prev.angles.z, ent.angles.z, alpha)
        };

        // Animation interpolation
        const frame = ent.frame;
        const prevFrame = prev.frame;

        // Scale interpolation
        const scaleA: number = (prev.scale !== undefined) ? prev.scale : 1.0;
        const scaleB: number = (ent.scale !== undefined) ? ent.scale : 1.0;
        const scale = lerp(scaleA, scaleB, alpha);

        // Alpha interpolation
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

        const skinName = (skinNum !== undefined && skinNum > 0) ? configStrings.getImageName(skinNum) : undefined;

        // Handle RenderFx Tints
        let tint: [number, number, number, number] | undefined;
        const renderfx = ent.renderfx ?? 0;

        // Check for Freeze effect (ShellGreen | ShellBlue) explicitly first
        if ((renderfx & (RenderFx.ShellGreen | RenderFx.ShellBlue)) === (RenderFx.ShellGreen | RenderFx.ShellBlue)) {
            tint = [0, 1, 1, 1]; // Cyan (Freeze)
        } else if (renderfx & RenderFx.ShellRed) {
            tint = [1, 0, 0, 1]; // Red Shell
        } else if (renderfx & RenderFx.ShellGreen) {
            tint = [0, 1, 0, 1]; // Green Shell
        } else if (renderfx & RenderFx.ShellBlue) {
            tint = [0, 0, 1, 1]; // Blue Shell
        } else if (renderfx & RenderFx.ShellDouble) {
            tint = [1, 1, 0, 1]; // Double Damage
        } else if (renderfx & RenderFx.ShellHalfDam) {
            tint = [0.5, 0.5, 0.5, 1]; // Half Damage
        }

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
                skin: skinName,
                alpha: normalizedAlpha,
                tint: tint as readonly [number, number, number, number] | undefined
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
                alpha: normalizedAlpha,
                tint: tint as readonly [number, number, number, number] | undefined
                // Lighting? Skins?
             });
        }
    }

    return renderables;
}
