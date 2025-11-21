
import { mat3 } from 'gl-matrix';

export enum BlendMode {
  OPAQUE,
  ALPHA,
  ADDITIVE,
}

export class Material {
  blendMode: BlendMode = BlendMode.OPAQUE;
  twoSided: boolean = false;
  depthWrite: boolean = true;

  private readonly textures: WebGLTexture[];
  private readonly fps: number;
  private currentIndex: number = 0;
  private lastAnimationTime: number = 0;

  constructor(textures: WebGLTexture[], fps: number = 10) {
    this.textures = textures;
    this.fps = fps;
  }

  public updateAnimation(time: number) {
    if (this.textures.length <= 1) {
      return;
    }

    if (time - this.lastAnimationTime >= 1.0 / this.fps) {
      this.currentIndex = (this.currentIndex + 1) % this.textures.length;
      this.lastAnimationTime = time;
    }
  }

  get texture(): WebGLTexture {
    return this.textures[this.currentIndex];
  }

  // Placeholder for scrolling textures
  getTexCoordTransform(time: number): mat3 {
    // For now, return identity
    return mat3.create();
  }
}

export class MaterialManager {
  private readonly materials: Map<string, Material> = new Map();

  getMaterial(name: string): Material | undefined {
    return this.materials.get(name);
  }

  registerMaterial(name: string, material: Material): void {
    this.materials.set(name, material);
  }

  updateAnimations(time: number): void {
    for (const material of this.materials.values()) {
        material.updateAnimation(time);
    }
  }
}
