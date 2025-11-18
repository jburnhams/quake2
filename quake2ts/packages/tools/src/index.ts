import type { Vec3 } from '@quake2ts/shared';

export interface AssetSummary {
  readonly name: string;
  readonly origin?: Vec3;
}

export function describeAsset(name: string, origin?: Vec3): AssetSummary {
  return { name, origin };
}
