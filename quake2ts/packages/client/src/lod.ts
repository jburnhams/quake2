
export interface LodModel {
    distance: number;
    model: string;
}

export class LodRegistry {
    private registry = new Map<string, LodModel[]>();

    register(baseModel: string, lods: LodModel[]) {
        // Sort LODs by distance descending so we can find the first one that fits
        this.registry.set(baseModel, lods.sort((a, b) => b.distance - a.distance));
    }

    getLodModel(baseModel: string, distance: number): string | undefined {
        const lods = this.registry.get(baseModel);
        if (!lods) return undefined;

        // Find first LOD where distance > threshold
        // Actually, typically:
        // dist 0-500: base
        // dist 500-1000: lod1
        // dist 1000+: lod2

        // My registry has { distance: 500, model: lod1 }, { distance: 1000, model: lod2 }

        // If distance > 1000, use lod2.
        // If distance > 500, use lod1.

        for (const lod of lods) {
            if (distance > lod.distance) {
                return lod.model;
            }
        }

        return undefined;
    }
}

export const lodRegistry = new LodRegistry();
