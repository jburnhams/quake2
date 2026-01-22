/**
 * Game engine for the playable Quake 2 TypeScript demo
 * Uses quake2ts systems for rendering, collision, and skybox
 */
import {
  Camera,
  createRenderer,
  createWebGLContext,
  createWebGPURenderer,
  FixedTimestepLoop,
  SkyboxPipeline,
  type LoopCallbacks,
  type FixedStepContext,
  type RenderContext,
  type Renderer,
  type IRenderer,
} from '@quake2ts/engine';
import { CONTENTS_SOLID } from '@quake2ts/shared';
import type { Vec3 } from '@quake2ts/shared';
import { vec3, mat4 } from 'gl-matrix';
import { generateProceduralRoom, type ProceduralRoom } from './proceduralMap';
import { KeyboardInputHandler, type InputState } from './input';
import { CollisionWorld, buildCollisionFromRoom } from './collision';

export type RendererType = 'webgl' | 'webgpu';

export interface GameStats {
  fps: number;
  position: { x: number; y: number; z: number };
  angles: { pitch: number; yaw: number };
  onGround: boolean;
}

// WebGL debug renderer interface
interface WebGLDebugRenderer {
  drawLine(start: Vec3, end: Vec3, color: { r: number; g: number; b: number }): void;
  drawAxes(position: Vec3, size: number): void;
  render(viewProjection: Float32Array, alwaysOnTop?: boolean): void;
  clear(): void;
}

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private rendererType: RendererType;
  private renderer: Renderer | IRenderer | null = null;
  private camera: Camera | null = null;
  private loop: FixedTimestepLoop | null = null;
  private inputHandler: KeyboardInputHandler | null = null;
  private room: ProceduralRoom | null = null;
  private gl: WebGL2RenderingContext | null = null;

  // WebGPU-specific state
  private gpuDevice: GPUDevice | null = null;
  private gpuContext: GPUCanvasContext | null = null;
  private gpuDepthTexture: GPUTexture | null = null;

  // Collision system
  private collisionWorld: CollisionWorld = new CollisionWorld();

  // Player state
  private position = vec3.fromValues(0, 0, 0);
  private velocity = vec3.fromValues(0, 0, 0);
  private yaw = 0;
  private pitch = 0;
  private onGround = false;

  // Physics constants
  private readonly MOVE_SPEED = 320;
  private readonly LOOK_SPEED = 120;
  private readonly GRAVITY = 800;
  private readonly JUMP_VELOCITY = 270;
  private readonly FRICTION = 6;
  private readonly PLAYER_HEIGHT = 56;
  private readonly PLAYER_RADIUS = 16;

  // Pre-allocated matrices
  private viewMatrix = mat4.create();
  private projectionMatrix = mat4.create();
  private viewProjectionMatrix = mat4.create();

  // Skybox
  private skyboxPipeline: SkyboxPipeline | null = null;
  private skyboxCubemap: WebGLTexture | null = null;

  // Weapon state
  private weaponBobTime = 0;
  private isFiring = false;
  private fireTime = 0;

  // Stats
  private lastFrameTime = 0;
  private frameCount = 0;
  private fps = 0;

  constructor(canvas: HTMLCanvasElement, rendererType: RendererType = 'webgl') {
    this.canvas = canvas;
    this.rendererType = rendererType;
  }

  async init(): Promise<void> {
    // Generate procedural room
    this.room = generateProceduralRoom({
      width: 512,
      depth: 512,
      height: 256,
      wallThickness: 16,
    });

    // Build collision world from room
    buildCollisionFromRoom(
      this.collisionWorld,
      this.room.width,
      this.room.depth,
      this.room.height,
      this.room.wallThickness,
      this.room.pillars
    );

    // Initialize renderer
    if (this.rendererType === 'webgl') {
      await this.initWebGL();
    } else {
      await this.initWebGPU();
    }

    // Initialize camera
    this.camera = new Camera(this.canvas.width, this.canvas.height);
    this.camera.setPerspective(90, this.canvas.width / this.canvas.height, 1, 4096);

    // Initialize input handler
    this.inputHandler = new KeyboardInputHandler(this.canvas);
    this.inputHandler.bind();

    // Create game loop
    const callbacks: LoopCallbacks = {
      simulate: (ctx: FixedStepContext) => this.fixedUpdate(ctx.deltaMs),
      render: (ctx: RenderContext) => this.render(ctx),
    };

    this.loop = new FixedTimestepLoop(callbacks, {
      fixedDeltaMs: 1000 / 60,
    });
  }

  private async initWebGL(): Promise<void> {
    const contextState = createWebGLContext(this.canvas);
    if (!contextState) {
      throw new Error('Failed to create WebGL context');
    }
    this.gl = contextState.gl;
    this.renderer = createRenderer(this.gl);

    // Initialize skybox
    this.skyboxPipeline = new SkyboxPipeline(this.gl);
    this.createSkyboxCubemap();
  }

  private async initWebGPU(): Promise<void> {
    const renderer = await createWebGPURenderer(this.canvas, {
      powerPreference: 'high-performance',
    });
    if (!renderer) {
      throw new Error('WebGPU not supported or failed to initialize');
    }
    this.renderer = renderer;

    if ('device' in renderer) {
      this.gpuDevice = renderer.device;
    }

    const context = this.canvas.getContext('webgpu');
    if (context) {
      this.gpuContext = context;
    }
  }

  private createSkyboxCubemap(): void {
    if (!this.gl) return;

    const gl = this.gl;
    this.skyboxCubemap = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.skyboxCubemap);

    const size = 64;
    const faces = [
      { target: gl.TEXTURE_CUBE_MAP_POSITIVE_X, color: [135, 180, 220] },
      { target: gl.TEXTURE_CUBE_MAP_NEGATIVE_X, color: [135, 180, 220] },
      { target: gl.TEXTURE_CUBE_MAP_POSITIVE_Y, color: [80, 140, 200] },
      { target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, color: [100, 80, 60] },
      { target: gl.TEXTURE_CUBE_MAP_POSITIVE_Z, color: [135, 180, 220] },
      { target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, color: [135, 180, 220] },
    ];

    for (const face of faces) {
      const data = new Uint8Array(size * size * 4);
      for (let i = 0; i < size * size; i++) {
        const y = Math.floor(i / size);
        const gradient = y / size;
        data[i * 4 + 0] = Math.floor(face.color[0] * (0.7 + gradient * 0.3));
        data[i * 4 + 1] = Math.floor(face.color[1] * (0.7 + gradient * 0.3));
        data[i * 4 + 2] = Math.floor(face.color[2] * (0.7 + gradient * 0.3));
        data[i * 4 + 3] = 255;
      }
      gl.texImage2D(face.target, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    }

    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  start(): void {
    if (!this.loop) {
      throw new Error('Engine not initialized');
    }
    this.lastFrameTime = performance.now();
    this.loop.start();
  }

  stop(): void {
    if (this.loop) {
      this.loop.stop();
    }
  }

  dispose(): void {
    this.stop();
    if (this.inputHandler) {
      this.inputHandler.unbind();
    }
    if (this.gpuDepthTexture) {
      this.gpuDepthTexture.destroy();
      this.gpuDepthTexture = null;
    }
    if (this.skyboxPipeline) {
      this.skyboxPipeline.dispose();
      this.skyboxPipeline = null;
    }
    if (this.skyboxCubemap && this.gl) {
      this.gl.deleteTexture(this.skyboxCubemap);
      this.skyboxCubemap = null;
    }
    if (this.renderer && 'dispose' in this.renderer) {
      this.renderer.dispose();
    }
    this.renderer = null;
    this.camera = null;
    this.loop = null;
    this.inputHandler = null;
    this.gl = null;
    this.gpuDevice = null;
    this.gpuContext = null;
  }

  getStats(): GameStats {
    return {
      fps: this.fps,
      position: {
        x: this.position[0],
        y: this.position[1],
        z: this.position[2],
      },
      angles: {
        pitch: this.pitch,
        yaw: this.yaw,
      },
      onGround: this.onGround,
    };
  }

  private fixedUpdate(deltaMs: number): void {
    if (!this.inputHandler) return;

    const input = this.inputHandler.getState();
    const dt = deltaMs / 1000;

    // Update view angles
    this.updateViewAngles(input, dt);

    // Update movement with collision
    this.updateMovement(input, dt);

    // Update weapon bob
    const isMoving = input.forward || input.backward || input.strafeLeft || input.strafeRight;
    if (isMoving && this.onGround) {
      this.weaponBobTime += dt * 10;
    }

    // Handle firing
    if (input.fire && !this.isFiring) {
      this.isFiring = true;
      this.fireTime = 0.15;
    }
    if (this.fireTime > 0) {
      this.fireTime -= dt;
      if (this.fireTime <= 0) {
        this.isFiring = false;
      }
    }
  }

  private updateViewAngles(input: InputState, dt: number): void {
    if (input.lookLeft) this.yaw += this.LOOK_SPEED * dt;
    if (input.lookRight) this.yaw -= this.LOOK_SPEED * dt;
    if (input.lookUp) this.pitch -= this.LOOK_SPEED * dt;
    if (input.lookDown) this.pitch += this.LOOK_SPEED * dt;

    this.pitch = Math.max(-89, Math.min(89, this.pitch));
    if (this.yaw < 0) this.yaw += 360;
    if (this.yaw >= 360) this.yaw -= 360;
  }

  private updateMovement(input: InputState, dt: number): void {
    // Check ground
    const groundTrace = this.collisionWorld.trace(
      { x: this.position[0], y: this.position[1], z: this.position[2] },
      { x: this.position[0], y: this.position[1], z: this.position[2] - 1 },
      { x: -this.PLAYER_RADIUS, y: -this.PLAYER_RADIUS, z: 0 },
      { x: this.PLAYER_RADIUS, y: this.PLAYER_RADIUS, z: this.PLAYER_HEIGHT }
    );
    this.onGround = groundTrace.fraction < 1.0 || this.position[2] <= 0.1;

    // Gravity
    if (!this.onGround) {
      this.velocity[2] -= this.GRAVITY * dt;
    } else {
      if (this.velocity[2] < 0) {
        this.velocity[2] = 0;
      }
      if (this.position[2] < 0) {
        this.position[2] = 0;
      }
    }

    // Jump
    if (input.jump && this.onGround) {
      this.velocity[2] = this.JUMP_VELOCITY;
      this.onGround = false;
    }

    // Calculate movement direction
    const yawRad = (this.yaw * Math.PI) / 180;
    const forward = vec3.fromValues(Math.cos(yawRad), Math.sin(yawRad), 0);
    const right = vec3.fromValues(-Math.sin(yawRad), Math.cos(yawRad), 0);

    const wishDir = vec3.create();
    if (input.forward) vec3.add(wishDir, wishDir, forward);
    if (input.backward) vec3.subtract(wishDir, wishDir, forward);
    if (input.strafeLeft) vec3.add(wishDir, wishDir, right);
    if (input.strafeRight) vec3.subtract(wishDir, wishDir, right);

    const wishSpeed = vec3.length(wishDir);
    if (wishSpeed > 0.001) {
      vec3.normalize(wishDir, wishDir);
    }

    // Apply friction and acceleration
    if (this.onGround) {
      const speed = Math.sqrt(this.velocity[0] ** 2 + this.velocity[1] ** 2);
      if (speed > 0) {
        const drop = speed * this.FRICTION * dt;
        const newSpeed = Math.max(0, speed - drop);
        const scale = newSpeed / speed;
        this.velocity[0] *= scale;
        this.velocity[1] *= scale;
      }
      if (wishSpeed > 0) {
        this.velocity[0] = wishDir[0] * this.MOVE_SPEED;
        this.velocity[1] = wishDir[1] * this.MOVE_SPEED;
      }
    } else {
      if (wishSpeed > 0) {
        const airAccel = 0.1;
        this.velocity[0] += wishDir[0] * this.MOVE_SPEED * airAccel * dt;
        this.velocity[1] += wishDir[1] * this.MOVE_SPEED * airAccel * dt;
      }
    }

    // Move with collision
    this.moveWithCollision(dt);
  }

  private moveWithCollision(dt: number): void {
    const start: Vec3 = { x: this.position[0], y: this.position[1], z: this.position[2] };
    const end: Vec3 = {
      x: this.position[0] + this.velocity[0] * dt,
      y: this.position[1] + this.velocity[1] * dt,
      z: this.position[2] + this.velocity[2] * dt,
    };

    const mins: Vec3 = { x: -this.PLAYER_RADIUS, y: -this.PLAYER_RADIUS, z: 0 };
    const maxs: Vec3 = { x: this.PLAYER_RADIUS, y: this.PLAYER_RADIUS, z: this.PLAYER_HEIGHT };

    const trace = this.collisionWorld.trace(start, end, mins, maxs);

    if (trace.fraction >= 1.0) {
      // No collision, move freely
      this.position[0] = end.x;
      this.position[1] = end.y;
      this.position[2] = end.z;
    } else {
      // Hit something, move to contact point and slide
      this.position[0] = start.x + (end.x - start.x) * trace.fraction * 0.99;
      this.position[1] = start.y + (end.y - start.y) * trace.fraction * 0.99;
      this.position[2] = start.z + (end.z - start.z) * trace.fraction * 0.99;

      // Clip velocity along collision plane
      if (trace.planeNormal) {
        const backoff =
          this.velocity[0] * trace.planeNormal.x +
          this.velocity[1] * trace.planeNormal.y +
          this.velocity[2] * trace.planeNormal.z;

        this.velocity[0] -= trace.planeNormal.x * backoff * 1.01;
        this.velocity[1] -= trace.planeNormal.y * backoff * 1.01;
        this.velocity[2] -= trace.planeNormal.z * backoff * 1.01;
      }
    }

    // Ensure we stay in bounds
    if (this.room) {
      const halfW = this.room.width / 2 - this.PLAYER_RADIUS - 1;
      const halfD = this.room.depth / 2 - this.PLAYER_RADIUS - 1;
      this.position[0] = Math.max(-halfW, Math.min(halfW, this.position[0]));
      this.position[1] = Math.max(-halfD, Math.min(halfD, this.position[1]));
      this.position[2] = Math.max(0, Math.min(this.room.height - this.PLAYER_HEIGHT, this.position[2]));
    }
  }

  private buildViewProjectionMatrix(eyePos: vec3, pitch: number, yaw: number): Float32Array {
    const DEG2RAD = Math.PI / 180;
    const pitchRad = pitch * DEG2RAD;
    const yawRad = yaw * DEG2RAD;

    const fov = 90 * DEG2RAD;
    const aspect = this.canvas.width / this.canvas.height;
    mat4.perspective(this.projectionMatrix, fov, aspect, 1, 4096);

    const quakeToGl = mat4.fromValues(
       0,  0, -1, 0,
      -1,  0,  0, 0,
       0,  1,  0, 0,
       0,  0,  0, 1
    );

    const rotationQuake = mat4.create();
    mat4.identity(rotationQuake);
    mat4.rotateY(rotationQuake, rotationQuake, -pitchRad);
    mat4.rotateZ(rotationQuake, rotationQuake, -yawRad);

    const rotationGl = mat4.create();
    mat4.multiply(rotationGl, quakeToGl, rotationQuake);

    const negPos = vec3.negate(vec3.create(), eyePos);
    const rotatedPosQuake = vec3.transformMat4(vec3.create(), negPos, rotationQuake);

    const translationGl = vec3.fromValues(
      -rotatedPosQuake[1],
       rotatedPosQuake[2],
      -rotatedPosQuake[0]
    );

    mat4.copy(this.viewMatrix, rotationGl);
    this.viewMatrix[12] = translationGl[0];
    this.viewMatrix[13] = translationGl[1];
    this.viewMatrix[14] = translationGl[2];

    mat4.multiply(this.viewProjectionMatrix, this.projectionMatrix, this.viewMatrix);
    return new Float32Array(this.viewProjectionMatrix);
  }

  private render(_ctx: RenderContext): void {
    if (!this.renderer || !this.room) return;

    const now = performance.now();
    this.frameCount++;
    if (now - this.lastFrameTime >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFrameTime = now;
    }

    const eyePos = vec3.fromValues(
      this.position[0],
      this.position[1],
      this.position[2] + this.PLAYER_HEIGHT - 10
    );

    const viewProjection = this.buildViewProjectionMatrix(eyePos, this.pitch, this.yaw);

    if (this.gl) {
      this.renderWebGL(viewProjection, eyePos);
    } else if (this.gpuDevice && this.gpuContext) {
      this.renderWebGPU(viewProjection);
    }
  }

  private renderWebGL(viewProjection: Float32Array, eyePos: vec3): void {
    if (!this.gl || !this.renderer || !this.room || !this.camera) return;
    const gl = this.gl;

    gl.clearColor(0.5, 0.7, 0.9, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);

    // Update camera for skybox
    this.camera.setPosition(eyePos[0], eyePos[1], eyePos[2]);
    this.camera.setRotation(this.pitch, this.yaw, 0);

    // Render skybox
    if (this.skyboxPipeline && this.skyboxCubemap) {
      gl.depthMask(false);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.skyboxCubemap);

      this.skyboxPipeline.bind({
        cameraState: this.camera.toState(),
        scroll: [0, 0],
        textureUnit: 0,
      });
      this.skyboxPipeline.draw();
      gl.depthMask(true);
    }

    // Render room geometry
    this.renderRoomGeometry(viewProjection);

    // Render weapon and HUD
    this.renderWeaponAndHUD();
  }

  private renderRoomGeometry(viewProjection: Float32Array): void {
    if (!this.renderer || !this.room) return;

    const debug = this.renderer.debug as WebGLDebugRenderer;
    if (!debug || !('render' in debug)) return;

    // Draw surfaces with cross-hatching for visual fill
    for (const surface of this.room.surfaces) {
      const color = { r: surface.color[0], g: surface.color[1], b: surface.color[2] };
      const verts = surface.vertices;

      // Outline
      for (let i = 0; i < verts.length; i++) {
        const v0 = verts[i];
        const v1 = verts[(i + 1) % verts.length];
        debug.drawLine(
          { x: v0[0], y: v0[1], z: v0[2] },
          { x: v1[0], y: v1[1], z: v1[2] },
          color
        );
      }

      // Cross-hatch for fill effect
      if (verts.length === 4) {
        debug.drawLine(
          { x: verts[0][0], y: verts[0][1], z: verts[0][2] },
          { x: verts[2][0], y: verts[2][1], z: verts[2][2] },
          color
        );
        debug.drawLine(
          { x: verts[1][0], y: verts[1][1], z: verts[1][2] },
          { x: verts[3][0], y: verts[3][1], z: verts[3][2] },
          color
        );

        // Add more lines for denser fill
        const mid01 = this.midpoint(verts[0], verts[1]);
        const mid23 = this.midpoint(verts[2], verts[3]);
        debug.drawLine(
          { x: mid01[0], y: mid01[1], z: mid01[2] },
          { x: mid23[0], y: mid23[1], z: mid23[2] },
          color
        );

        const mid12 = this.midpoint(verts[1], verts[2]);
        const mid30 = this.midpoint(verts[3], verts[0]);
        debug.drawLine(
          { x: mid12[0], y: mid12[1], z: mid12[2] },
          { x: mid30[0], y: mid30[1], z: mid30[2] },
          color
        );
      }
    }

    debug.drawAxes({ x: 0, y: 0, z: 0 }, 64);
    debug.render(viewProjection);
    debug.clear();
  }

  private midpoint(a: [number, number, number], b: [number, number, number]): [number, number, number] {
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  }

  private renderWeaponAndHUD(): void {
    if (!this.renderer) return;

    this.renderer.begin2D();

    const w = this.canvas.width;
    const h = this.canvas.height;

    // Weapon bob
    const bobX = Math.sin(this.weaponBobTime) * 4;
    const bobY = Math.abs(Math.cos(this.weaponBobTime * 0.5)) * 2;
    const recoilY = this.isFiring ? 15 : 0;

    const weaponX = w / 2 - 50 + bobX;
    const weaponY = h - 140 + bobY + recoilY;

    // Weapon body
    this.renderer.drawfillRect(weaponX, weaponY, 100, 70, [0.35, 0.35, 0.4, 1]);
    this.renderer.drawfillRect(weaponX + 35, weaponY - 25, 30, 35, [0.45, 0.45, 0.5, 1]);
    this.renderer.drawfillRect(weaponX + 30, weaponY + 50, 40, 50, [0.3, 0.3, 0.35, 1]);

    // Muzzle flash
    if (this.isFiring && this.fireTime > 0.08) {
      this.renderer.drawfillRect(weaponX + 35, weaponY - 50, 30, 30, [1, 0.9, 0.3, 0.9]);
      this.renderer.drawfillRect(weaponX + 40, weaponY - 45, 20, 20, [1, 1, 0.6, 0.8]);
    }

    // Crosshair
    const cx = w / 2;
    const cy = h / 2;
    this.renderer.drawfillRect(cx - 12, cy - 1, 10, 2, [0, 1, 0, 0.9]);
    this.renderer.drawfillRect(cx + 2, cy - 1, 10, 2, [0, 1, 0, 0.9]);
    this.renderer.drawfillRect(cx - 1, cy - 12, 2, 10, [0, 1, 0, 0.9]);
    this.renderer.drawfillRect(cx - 1, cy + 2, 2, 10, [0, 1, 0, 0.9]);

    // HUD - simple health display
    this.renderer.drawfillRect(10, h - 40, 104, 24, [0, 0, 0, 0.5]);
    this.renderer.drawfillRect(12, h - 38, 100, 20, [0.2, 0.7, 0.2, 0.8]);

    // Ammo display
    this.renderer.drawfillRect(w - 114, h - 40, 104, 24, [0, 0, 0, 0.5]);
    this.renderer.drawfillRect(w - 112, h - 38, 100, 20, [0.7, 0.5, 0.2, 0.8]);

    this.renderer.end2D();
  }

  private renderWebGPU(viewProjection: Float32Array): void {
    if (!this.renderer || !this.room || !this.gpuDevice || !this.gpuContext) return;

    const currentTexture = this.gpuContext.getCurrentTexture();
    const textureView = currentTexture.createView();

    if (!this.gpuDepthTexture ||
        this.gpuDepthTexture.width !== currentTexture.width ||
        this.gpuDepthTexture.height !== currentTexture.height) {
      if (this.gpuDepthTexture) {
        this.gpuDepthTexture.destroy();
      }
      this.gpuDepthTexture = this.gpuDevice.createTexture({
        size: { width: currentTexture.width, height: currentTexture.height },
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
    }

    const debug = (this.renderer as any).debug;
    if (!debug || !('render' in debug)) return;

    for (const surface of this.room.surfaces) {
      const color = { r: surface.color[0], g: surface.color[1], b: surface.color[2] };
      const verts = surface.vertices;

      for (let i = 0; i < verts.length; i++) {
        const v0 = verts[i];
        const v1 = verts[(i + 1) % verts.length];
        debug.drawLine(
          { x: v0[0], y: v0[1], z: v0[2] },
          { x: v1[0], y: v1[1], z: v1[2] },
          color
        );
      }

      if (verts.length === 4) {
        debug.drawLine(
          { x: verts[0][0], y: verts[0][1], z: verts[0][2] },
          { x: verts[2][0], y: verts[2][1], z: verts[2][2] },
          color
        );
      }
    }

    debug.drawAxes({ x: 0, y: 0, z: 0 }, 64);

    const commandEncoder = this.gpuDevice.createCommandEncoder({ label: 'game-render' });
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: textureView,
        clearValue: { r: 0.5, g: 0.7, b: 0.9, a: 1.0 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
      depthStencilAttachment: {
        view: this.gpuDepthTexture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
    });

    debug.render(renderPass, viewProjection, false);
    renderPass.end();
    this.gpuDevice.queue.submit([commandEncoder.finish()]);
    debug.clear();
  }
}
