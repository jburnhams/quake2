import { Vec3 } from '@quake2ts/shared';
import { IndexBuffer, VertexArray, VertexBuffer } from './resources.js';
import { ShaderProgram } from './shaderProgram.js';
import { RandomGenerator } from '@quake2ts/shared';

export type ParticleBlendMode = 'alpha' | 'additive';

export interface ParticleSpawnOptions {
  readonly position: Vec3;
  readonly velocity?: Vec3;
  readonly color?: readonly [number, number, number, number];
  readonly size?: number;
  readonly lifetime: number;
  readonly gravity?: number;
  readonly damping?: number;
  readonly bounce?: number;
  readonly blendMode?: ParticleBlendMode;
  /**
   * When true, fades alpha from 1 to 0 across the lifetime instead of remaining constant.
   */
  readonly fade?: boolean;
}

export interface ParticleSimulationOptions {
  readonly floorZ?: number;
}

interface ParticleMeshBatch {
  readonly blendMode: ParticleBlendMode;
  readonly start: number;
  readonly count: number;
}

export interface ParticleMesh {
  readonly vertices: Float32Array;
  readonly indices: Uint16Array;
  readonly batches: readonly ParticleMeshBatch[];
}

const DEFAULT_COLOR: [number, number, number, number] = [1, 1, 1, 1];

export class ParticleSystem {
  readonly maxParticles: number;
  readonly rng: RandomGenerator;

  private readonly alive: Uint8Array;
  private readonly positionX: Float32Array;
  private readonly positionY: Float32Array;
  private readonly positionZ: Float32Array;
  private readonly velocityX: Float32Array;
  private readonly velocityY: Float32Array;
  private readonly velocityZ: Float32Array;
  private readonly colorR: Float32Array;
  private readonly colorG: Float32Array;
  private readonly colorB: Float32Array;
  private readonly colorA: Float32Array;
  private readonly size: Float32Array;
  private readonly lifetime: Float32Array;
  private readonly remaining: Float32Array;
  private readonly gravity: Float32Array;
  private readonly damping: Float32Array;
  private readonly bounce: Float32Array;
  private readonly fade: Uint8Array;
  private readonly blendMode: Uint8Array; // 0 alpha, 1 additive

  constructor(maxParticles: number, rng: RandomGenerator) {
    this.maxParticles = maxParticles;
    this.rng = rng;
    this.alive = new Uint8Array(maxParticles);
    this.positionX = new Float32Array(maxParticles);
    this.positionY = new Float32Array(maxParticles);
    this.positionZ = new Float32Array(maxParticles);
    this.velocityX = new Float32Array(maxParticles);
    this.velocityY = new Float32Array(maxParticles);
    this.velocityZ = new Float32Array(maxParticles);
    this.colorR = new Float32Array(maxParticles);
    this.colorG = new Float32Array(maxParticles);
    this.colorB = new Float32Array(maxParticles);
    this.colorA = new Float32Array(maxParticles);
    this.size = new Float32Array(maxParticles);
    this.lifetime = new Float32Array(maxParticles);
    this.remaining = new Float32Array(maxParticles);
    this.gravity = new Float32Array(maxParticles);
    this.damping = new Float32Array(maxParticles);
    this.bounce = new Float32Array(maxParticles);
    this.fade = new Uint8Array(maxParticles);
    this.blendMode = new Uint8Array(maxParticles);
  }

  spawn(options: ParticleSpawnOptions): number | null {
    const index = this.findFreeSlot();
    if (index === -1) {
      return null;
    }

    const color = options.color ?? DEFAULT_COLOR;
    const velocity = options.velocity ?? { x: 0, y: 0, z: 0 };

    this.alive[index] = 1;
    this.positionX[index] = options.position.x;
    this.positionY[index] = options.position.y;
    this.positionZ[index] = options.position.z;
    this.velocityX[index] = velocity.x;
    this.velocityY[index] = velocity.y;
    this.velocityZ[index] = velocity.z;
    this.colorR[index] = color[0];
    this.colorG[index] = color[1];
    this.colorB[index] = color[2];
    this.colorA[index] = color[3];
    this.size[index] = options.size ?? 2.5;
    this.lifetime[index] = options.lifetime;
    this.remaining[index] = options.lifetime;
    this.gravity[index] = options.gravity ?? 800;
    this.damping[index] = options.damping ?? 0;
    this.bounce[index] = options.bounce ?? 0.25;
    this.fade[index] = options.fade ? 1 : 0;
    this.blendMode[index] = options.blendMode === 'additive' ? 1 : 0;

    return index;
  }

  update(dt: number, options: ParticleSimulationOptions = {}): void {
    const floorZ = options.floorZ ?? -Infinity;
    for (let i = 0; i < this.maxParticles; i += 1) {
      if (!this.alive[i]) {
        continue;
      }

      this.remaining[i] -= dt;
      if (this.remaining[i] <= 0) {
        this.alive[i] = 0;
        continue;
      }

      const damping = Math.max(0, 1 - this.damping[i] * dt);
      this.velocityX[i] *= damping;
      this.velocityY[i] *= damping;
      this.velocityZ[i] = this.velocityZ[i] * damping - this.gravity[i] * dt;

      this.positionX[i] += this.velocityX[i] * dt;
      this.positionY[i] += this.velocityY[i] * dt;
      this.positionZ[i] += this.velocityZ[i] * dt;

      if (this.positionZ[i] < floorZ) {
        this.positionZ[i] = floorZ;
        this.velocityZ[i] = -this.velocityZ[i] * this.bounce[i];
        this.velocityX[i] *= 0.7;
        this.velocityY[i] *= 0.7;
      }
    }
  }

  killAll(): void {
    this.alive.fill(0);
  }

  aliveCount(): number {
    let count = 0;
    for (let i = 0; i < this.maxParticles; i += 1) {
      if (this.alive[i]) {
        count += 1;
      }
    }
    return count;
  }

  getState(index: number): {
    readonly alive: boolean;
    readonly position: Vec3;
    readonly velocity: Vec3;
    readonly remaining: number;
    readonly color: readonly [number, number, number, number];
    readonly size: number;
    readonly blendMode: ParticleBlendMode;
  } {
    return {
      alive: this.alive[index] === 1,
      position: {
        x: this.positionX[index],
        y: this.positionY[index],
        z: this.positionZ[index],
      },
      velocity: {
        x: this.velocityX[index],
        y: this.velocityY[index],
        z: this.velocityZ[index],
      },
      remaining: this.remaining[index],
      color: [this.colorR[index], this.colorG[index], this.colorB[index], this.colorA[index]],
      size: this.size[index],
      blendMode: this.blendMode[index] === 1 ? 'additive' : 'alpha',
    };
  }

  buildMesh(viewRight: Vec3, viewUp: Vec3): ParticleMesh {
    const vertices: number[] = [];
    const indices: number[] = [];
    const batches: ParticleMeshBatch[] = [];

    const buildBatch = (mode: ParticleBlendMode): void => {
      const startIndex = indices.length;
      let particleCount = 0;
      for (let i = 0; i < this.maxParticles; i += 1) {
        if (!this.alive[i]) {
          continue;
        }
        if ((mode === 'additive' ? 1 : 0) !== this.blendMode[i]) {
          continue;
        }

        particleCount += 1;
        const baseVertex = vertices.length / 9;
        const size = this.size[i] * 0.5;
        const fade = this.fade[i] ? Math.max(this.remaining[i] / this.lifetime[i], 0) : 1;
        const colorScale = this.blendMode[i] === 1 ? 1.2 : 1;

        const cR = this.colorR[i] * colorScale;
        const cG = this.colorG[i] * colorScale;
        const cB = this.colorB[i] * colorScale;
        const cA = this.colorA[i] * fade;

        const px = this.positionX[i];
        const py = this.positionY[i];
        const pz = this.positionZ[i];

        const rightX = viewRight.x * size;
        const rightY = viewRight.y * size;
        const rightZ = viewRight.z * size;
        const upX = viewUp.x * size;
        const upY = viewUp.y * size;
        const upZ = viewUp.z * size;

        const corners: readonly Vec3[] = [
          { x: px - rightX - upX, y: py - rightY - upY, z: pz - rightZ - upZ },
          { x: px + rightX - upX, y: py + rightY - upY, z: pz + rightZ - upZ },
          { x: px - rightX + upX, y: py - rightY + upY, z: pz - rightZ + upZ },
          { x: px + rightX + upX, y: py + rightY + upY, z: pz + rightZ + upZ },
        ];

        const uvs: readonly [number, number][] = [
          [0, 1],
          [1, 1],
          [0, 0],
          [1, 0],
        ];

        corners.forEach((corner, cornerIndex) => {
          vertices.push(
            corner.x,
            corner.y,
            corner.z,
            uvs[cornerIndex]?.[0] ?? 0,
            uvs[cornerIndex]?.[1] ?? 0,
            cR,
            cG,
            cB,
            cA
          );
        });

        indices.push(baseVertex, baseVertex + 1, baseVertex + 2, baseVertex + 2, baseVertex + 1, baseVertex + 3);
      }

      if (particleCount > 0) {
        batches.push({ blendMode: mode, start: startIndex, count: indices.length - startIndex });
      }
    };

    buildBatch('alpha');
    buildBatch('additive');

    return { vertices: new Float32Array(vertices), indices: new Uint16Array(indices), batches };
  }

  private findFreeSlot(): number {
    for (let i = 0; i < this.maxParticles; i += 1) {
      if (!this.alive[i]) {
        return i;
      }
    }
    return -1;
  }
}

export const PARTICLE_VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in vec3 a_position;
layout(location = 1) in vec2 a_uv;
layout(location = 2) in vec4 a_color;

uniform mat4 u_viewProjection;

out vec2 v_uv;
out vec4 v_color;

void main() {
  v_uv = a_uv;
  v_color = a_color;
  gl_Position = u_viewProjection * vec4(a_position, 1.0);
}`;

export const PARTICLE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_uv;
in vec4 v_color;

out vec4 o_color;

void main() {
  float dist = distance(v_uv, vec2(0.5));
  float alpha = v_color.a * (1.0 - smoothstep(0.35, 0.5, dist));
  o_color = vec4(v_color.rgb, alpha);
}`;

export interface ParticleRenderOptions {
  readonly viewProjection: Float32List;
  readonly viewRight: Vec3;
  readonly viewUp: Vec3;
}

export class ParticleRenderer {
  readonly gl: WebGL2RenderingContext;
  readonly program: ShaderProgram;
  readonly system: ParticleSystem;
  readonly vertexBuffer: VertexBuffer;
  readonly indexBuffer: IndexBuffer;
  readonly vertexArray: VertexArray;

  private vertexCapacity = 0;
  private indexCapacity = 0;

  constructor(gl: WebGL2RenderingContext, system: ParticleSystem) {
    this.gl = gl;
    this.system = system;
    this.program = ShaderProgram.create(gl, { vertex: PARTICLE_VERTEX_SHADER, fragment: PARTICLE_FRAGMENT_SHADER });
    this.vertexBuffer = new VertexBuffer(gl, gl.DYNAMIC_DRAW);
    this.indexBuffer = new IndexBuffer(gl, gl.DYNAMIC_DRAW);
    this.vertexArray = new VertexArray(gl);
    this.vertexArray.configureAttributes(
      [
        { index: 0, size: 3, type: gl.FLOAT, stride: 36, offset: 0 },
        { index: 1, size: 2, type: gl.FLOAT, stride: 36, offset: 12 },
        { index: 2, size: 4, type: gl.FLOAT, stride: 36, offset: 20 },
      ],
      this.vertexBuffer
    );
  }

  render(options: ParticleRenderOptions): void {
    const mesh = this.system.buildMesh(options.viewRight, options.viewUp);
    if (mesh.indices.length === 0) {
      return;
    }

    const vertexData = mesh.vertices as unknown as BufferSource;
    if (mesh.vertices.byteLength > this.vertexCapacity) {
      this.vertexCapacity = mesh.vertices.byteLength;
      this.vertexBuffer.upload(vertexData, this.gl.DYNAMIC_DRAW);
    } else {
      this.vertexBuffer.update(vertexData);
    }

    const indexData = mesh.indices as unknown as BufferSource;
    if (mesh.indices.byteLength > this.indexCapacity) {
      this.indexCapacity = mesh.indices.byteLength;
      this.indexBuffer.upload(indexData, this.gl.DYNAMIC_DRAW);
    } else {
      this.indexBuffer.update(indexData);
    }

    this.gl.depthMask(false);
    this.program.use();
    const vp = this.program.getUniformLocation('u_viewProjection');
    this.gl.uniformMatrix4fv(vp, false, options.viewProjection);
    this.vertexArray.bind();

    for (const batch of mesh.batches) {
      if (batch.blendMode === 'additive') {
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE);
      } else {
        this.gl.blendFuncSeparate(
          this.gl.SRC_ALPHA,
          this.gl.ONE_MINUS_SRC_ALPHA,
          this.gl.ONE,
          this.gl.ONE_MINUS_SRC_ALPHA
        );
      }
      this.gl.drawElements(this.gl.TRIANGLES, batch.count, this.gl.UNSIGNED_SHORT, batch.start * 2);
    }

    this.gl.depthMask(true);
  }

  dispose(): void {
    this.program.dispose();
    this.vertexBuffer.dispose();
    this.indexBuffer.dispose();
    this.vertexArray.dispose();
  }
}

export interface ParticleEffectContext {
  readonly system: ParticleSystem;
  readonly origin: Vec3;
  readonly normal?: Vec3;
  readonly direction?: Vec3;
}

export function spawnBulletImpact(context: ParticleEffectContext): void {
  const { system, origin, normal = { x: 0, y: 0, z: 1 } } = context;
  for (let i = 0; i < 12; i += 1) {
    const speed = 200 + system.rng.frandom() * 180;
    const spread = system.rng.frandom() * 0.35;
    system.spawn({
      position: origin,
      velocity: {
        x: normal.x * speed + (system.rng.frandom() - 0.5) * 80,
        y: normal.y * speed + (system.rng.frandom() - 0.5) * 80,
        z: Math.max(normal.z * speed, 120) + spread * 80,
      },
      color: [1, 0.8, 0.4, 1],
      size: 2.5,
      lifetime: 0.45 + system.rng.frandom() * 0.1,
      gravity: 600,
      damping: 2,
      bounce: 0.45,
      blendMode: 'additive',
      fade: true,
    });
  }

  for (let i = 0; i < 8; i += 1) {
    system.spawn({
      position: origin,
      velocity: { x: (system.rng.frandom() - 0.5) * 40, y: (system.rng.frandom() - 0.5) * 40, z: 80 + system.rng.frandom() * 40 },
      color: [0.45, 0.45, 0.45, 0.75],
      size: 6,
      lifetime: 0.6,
      gravity: 200,
      damping: 4,
      bounce: 0.15,
      blendMode: 'alpha',
      fade: true,
    });
  }
}

export function spawnExplosion(context: ParticleEffectContext): void {
  const { system, origin } = context;
  for (let i = 0; i < 40; i += 1) {
    const theta = system.rng.frandom() * Math.PI * 2;
    const phi = Math.acos(2 * system.rng.frandom() - 1);
    const speed = 220 + system.rng.frandom() * 260;
    const dir = {
      x: Math.sin(phi) * Math.cos(theta),
      y: Math.sin(phi) * Math.sin(theta),
      z: Math.cos(phi),
    };
    system.spawn({
      position: origin,
      velocity: { x: dir.x * speed, y: dir.y * speed, z: dir.z * speed },
      color: [1, 0.6, 0.2, 1],
      size: 5,
      lifetime: 0.9,
      gravity: 700,
      damping: 1,
      bounce: 0.35,
      blendMode: 'additive',
      fade: true,
    });
  }

  for (let i = 0; i < 16; i += 1) {
    system.spawn({
      position: origin,
      velocity: { x: (system.rng.frandom() - 0.5) * 30, y: (system.rng.frandom() - 0.5) * 30, z: 120 + system.rng.frandom() * 120 },
      color: [0.25, 0.25, 0.25, 0.9],
      size: 12,
      lifetime: 1.2,
      gravity: 300,
      damping: 3,
      blendMode: 'alpha',
      fade: true,
    });
  }
}

export function spawnBlood(context: ParticleEffectContext): void {
  const { system, origin, direction = { x: 0, y: 0, z: 1 } } = context;
  for (let i = 0; i < 24; i += 1) {
    const speed = 120 + system.rng.frandom() * 180;
    system.spawn({
      position: origin,
      velocity: {
        x: direction.x * speed + (system.rng.frandom() - 0.5) * 70,
        y: direction.y * speed + (system.rng.frandom() - 0.5) * 70,
        z: direction.z * speed + system.rng.frandom() * 80,
      },
      color: [0.6, 0, 0, 0.95],
      size: 3,
      lifetime: 0.8,
      gravity: 900,
      damping: 1,
      bounce: 0.2,
      blendMode: 'alpha',
      fade: true,
    });
  }
}

export function spawnTeleportFlash(context: ParticleEffectContext): void {
  const { system, origin } = context;
  for (let i = 0; i < 30; i += 1) {
    const angle = system.rng.frandom() * Math.PI * 2;
    const radius = 8 + system.rng.frandom() * 8;
    system.spawn({
      position: origin,
      velocity: { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, z: 100 + system.rng.frandom() * 80 },
      color: [0.4, 0.6, 1, 0.9],
      size: 4,
      lifetime: 0.5,
      gravity: 300,
      damping: 2,
      blendMode: 'additive',
      fade: true,
    });
  }
}

export function spawnMuzzleFlash(context: ParticleEffectContext): void {
  const { system, origin, direction = { x: 1, y: 0, z: 0 } } = context;
  for (let i = 0; i < 10; i += 1) {
    const speed = 350 + system.rng.frandom() * 100;
    system.spawn({
      position: origin,
      velocity: {
        x: direction.x * speed + (system.rng.frandom() - 0.5) * 30,
        y: direction.y * speed + (system.rng.frandom() - 0.5) * 30,
        z: direction.z * speed + (system.rng.frandom() - 0.5) * 30,
      },
      color: [1, 0.8, 0.3, 1],
      size: 3,
      lifetime: 0.25,
      gravity: 200,
      damping: 1,
      blendMode: 'additive',
      fade: true,
    });
  }
}

export function spawnTrail(context: ParticleEffectContext): void {
  const { system, origin, direction = { x: 0, y: 0, z: 0 } } = context;
  for (let i = 0; i < 6; i += 1) {
    system.spawn({
      position: {
        x: origin.x + direction.x * i * 2,
        y: origin.y + direction.y * i * 2,
        z: origin.z + direction.z * i * 2,
      },
      velocity: { x: (system.rng.frandom() - 0.5) * 15, y: (system.rng.frandom() - 0.5) * 15, z: 20 + system.rng.frandom() * 15 },
      color: [0.6, 0.6, 0.6, 0.8],
      size: 2.2,
      lifetime: 0.6,
      gravity: 200,
      damping: 1.5,
      blendMode: 'alpha',
      fade: true,
    });
  }
}
