export enum BlendMode {
  OPAQUE,
  ALPHA,
  ADDITIVE,
}

export interface Material {
  readonly texture: WebGLTexture;
  readonly blendMode: BlendMode;
  readonly twoSided: boolean;
  readonly depthWrite: boolean;
}

export class MaterialManager {
  private readonly materials: Map<string, Material> = new Map();

  getMaterial(name: string): Material | undefined {
    return this.materials.get(name);
  }

  registerMaterial(name: string, material: Material): void {
    this.materials.set(name, material);
  }
}
