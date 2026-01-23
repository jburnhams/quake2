import {
  Camera,
  createRenderer,
  createWebGLContext,
  createWebGPURenderer,
  FixedTimestepLoop,
  type LoopCallbacks,
  type FixedStepContext,
  type RenderContext,
  type Renderer,
  type IRenderer,
  // Particle system
  ParticleSystem,
  ParticleRenderer,
  spawnBulletImpact,
  spawnMuzzleFlash,
} from '@quake2ts/engine';
import { vec3, mat4 } from 'gl-matrix';
import {
  type Vec3,
  type CollisionModel,
  type PmoveTraceFn,
  makeBrushFromMinsMaxs,
  makeLeafModel,
  createTraceRunner,
  PmType,
  PmFlag,
  PlayerButton,
  CONTENTS_NONE,
  angleVectors,
  RandomGenerator,
  type UserCommand,
  type ServerCommand
} from '@quake2ts/shared';
import {
  createGame,
  type GameExports,
  type GameImports,
  type GameEngine as IGameEngine,
  type GameStateSnapshot,
  MulticastType,
  createPlayerInventory,
  WeaponId,
  createPlayerWeaponStates
} from '@quake2ts/game';

// Debug renderer interface with render method (WebGL-specific)
interface WebGLDebugRenderer {
  drawLine(start: Vec3, end: Vec3, color: { r: number; g: number; b: number }): void;
  drawAxes(position: Vec3, size: number): void;
  render(viewProjection: Float32Array, alwaysOnTop?: boolean): void;
  clear(): void;
}
import { generateProceduralRoom, type ProceduralRoom } from './proceduralMap';
import { KeyboardInputHandler, type InputState } from './input';

export type RendererType = 'webgl' | 'webgpu';

export interface GameStats {
  fps: number;
  position: { x: number; y: number; z: number };
  angles: { pitch: number; yaw: number };
  onGround: boolean;
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
  private gpuFormat: GPUTextureFormat = 'bgra8unorm';
  private gpuDepthTexture: GPUTexture | null = null;

  // Game Logic
  private game: GameExports | null = null;
  private lastSnapshot: GameStateSnapshot | null = null;

  // Collision system
  private collisionModel: CollisionModel | null = null;
  private trace: PmoveTraceFn | null = null;

  // Local camera state
  private yaw = 0;
  private pitch = 0;

  // Visuals
  private bulletTraces: Array<{ start: Vec3; end: Vec3; time: number }> = [];
  private muzzleFlash = 0;

  // Particle system
  private particleSystem: ParticleSystem | null = null;
  private particleRenderer: ParticleRenderer | null = null;
  private rng: RandomGenerator = new RandomGenerator({ seed: Date.now() });

  // Physics constants
  private readonly LOOK_SPEED = 120;

  private lastFrameTime = 0;
  private frameCount = 0;
  private fps = 0;

  // Matrices
  private viewMatrix = mat4.create();
  private projectionMatrix = mat4.create();
  private viewProjectionMatrix = mat4.create();

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

    // Build collision model
    this.buildCollision();

    // Initialize Game Logic
    this.initGame();

    // Create game loop
    const callbacks: LoopCallbacks = {
      simulate: (ctx: FixedStepContext) => this.fixedUpdate(ctx),
      render: (ctx: RenderContext) => this.render(ctx),
    };

    this.loop = new FixedTimestepLoop(callbacks, {
      fixedDeltaMs: 1000 / 60,
    });
  }

  private buildCollision(): void {
    if (!this.room) return;
    const brushes = [];
    const halfWidth = this.room.width / 2;
    const halfDepth = this.room.depth / 2;
    const wallThickness = 16;

    // Floor
    brushes.push(makeBrushFromMinsMaxs(
      { x: -halfWidth, y: -halfDepth, z: -wallThickness },
      { x: halfWidth, y: halfDepth, z: 0 }
    ));
    // Ceiling
    brushes.push(makeBrushFromMinsMaxs(
      { x: -halfWidth, y: -halfDepth, z: this.room.height },
      { x: halfWidth, y: halfDepth, z: this.room.height + wallThickness }
    ));
    // Walls
    brushes.push(makeBrushFromMinsMaxs(
      { x: -halfWidth, y: halfDepth - wallThickness, z: 0 },
      { x: halfWidth, y: halfDepth, z: this.room.height }
    ));
    brushes.push(makeBrushFromMinsMaxs(
      { x: -halfWidth, y: -halfDepth, z: 0 },
      { x: halfWidth, y: -halfDepth + wallThickness, z: this.room.height }
    ));
    brushes.push(makeBrushFromMinsMaxs(
      { x: halfWidth - wallThickness, y: -halfDepth, z: 0 },
      { x: halfWidth, y: halfDepth, z: this.room.height }
    ));
    brushes.push(makeBrushFromMinsMaxs(
      { x: -halfWidth, y: -halfDepth, z: 0 },
      { x: -halfWidth + wallThickness, y: halfDepth, z: this.room.height }
    ));

    // Pillars
    for (const pillar of this.room.pillars) {
      brushes.push(makeBrushFromMinsMaxs(
        { x: pillar.x - pillar.halfSize, y: pillar.y - pillar.halfSize, z: 0 },
        { x: pillar.x + pillar.halfSize, y: pillar.y + pillar.halfSize, z: pillar.height }
      ));
    }

    this.collisionModel = makeLeafModel(brushes);
    this.trace = createTraceRunner(this.collisionModel, -1);
  }

  private initGame(): void {
    const engineHost: IGameEngine = {
        trace: (start: Vec3, end: Vec3) => {
             return this.trace ? this.trace(start, end) : { fraction: 1.0, endpos: end, allsolid: false, startsolid: false };
        },
        traceModel: undefined,
        sound: (_ent, _channel, _sound, _vol, _attn, _timeofs) => {},
        soundIndex: (_sound) => 0,
        modelIndex: (_model) => 0,
        multicast: (_origin, _type, _event, ..._args) => {},
        unicast: () => {},
        configstring: () => {},
        serverCommand: () => {},
        cvar: (name) => {
             if (name === 'g_gravity') return { number: 800, string: '800', value: '800' };
             return undefined;
        }
    };

    const gameImports: Partial<GameImports> = {
        trace: (start, _mins, _maxs, end, _passent, _contentmask) => {
            if (!this.trace) return { allsolid: false, startsolid: false, fraction: 1, endpos: end, plane: null, surfaceFlags: 0, contents: 0, ent: null };
            // Simple trace against world model (ignoring box size for now)
            const result = this.trace(start, end);
            return {
                ...result,
                plane: result.plane || null,
                surfaceFlags: result.surfaceFlags || 0,
                contents: result.contents || 0,
                ent: null
            };
        },
        pointcontents: () => 0,
        multicast: (origin, _type, _event, ..._args) => {
           // Basic hook for muzzle flashes if needed
           // For now, we rely on game state or just let it be silent
        }
    };

    this.game = createGame(gameImports, engineHost, {
        gravity: { x: 0, y: 0, z: -800 },
        deathmatch: true,
        random: this.rng
    });

    this.game.spawnWorld();

    this.game.clientBegin({
        inventory: createPlayerInventory({
            weapons: [WeaponId.Blaster],
            currentWeapon: WeaponId.Blaster
        }),
        weaponStates: createPlayerWeaponStates(),
        buttons: 0,
        pm_type: 0,
        pm_time: 0,
        pm_flags: 0,
        gun_frame: 0,
        rdflags: 0,
        fov: 90,
        pers: {
            connected: true,
            inventory: [],
            health: 100,
            max_health: 100,
            savedFlags: 0,
            selected_item: 0
        },
        stats: []
    } as any);
  }

  private async initWebGL(): Promise<void> {
    const contextState = createWebGLContext(this.canvas);
    if (!contextState) {
      throw new Error('Failed to create WebGL context');
    }
    this.gl = contextState.gl;
    this.renderer = createRenderer(this.gl);
    this.particleSystem = new ParticleSystem(1024, this.rng);
    this.particleRenderer = new ParticleRenderer(this.gl, this.particleSystem);
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
      this.gpuFormat = navigator.gpu.getPreferredCanvasFormat();
    }
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
    if (this.particleRenderer) {
      this.particleRenderer.dispose();
      this.particleRenderer = null;
    }
    this.particleSystem = null;
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
    this.game = null;
  }

  getStats(): GameStats {
    if (!this.lastSnapshot) {
        return { fps: 0, position: {x:0,y:0,z:0}, angles: {pitch:0,yaw:0}, onGround: false };
    }
    return {
      fps: this.fps,
      position: {
        x: this.lastSnapshot.origin.x,
        y: this.lastSnapshot.origin.y,
        z: this.lastSnapshot.origin.z,
      },
      angles: {
        pitch: this.pitch,
        yaw: this.yaw,
      },
      onGround: (this.lastSnapshot.pmFlags & PmFlag.OnGround) !== 0,
    };
  }

  private fixedUpdate(ctx: FixedStepContext): void {
    if (!this.inputHandler || !this.game) return;

    const input = this.inputHandler.getState();
    const dt = ctx.deltaMs / 1000;

    this.updateViewAngles(input, dt);

    let buttons: PlayerButton = 0;
    if (input.jump) buttons |= PlayerButton.Jump;
    if (input.attack) buttons |= PlayerButton.Attack;

    const forwardmove = (input.forward ? 400 : 0) - (input.backward ? 400 : 0);
    const sidemove = (input.strafeRight ? 400 : 0) - (input.strafeLeft ? 400 : 0);

    const cmd: UserCommand = {
        msec: Math.floor(ctx.deltaMs),
        buttons,
        angles: { x: this.pitch, y: this.yaw, z: 0 },
        forwardmove,
        sidemove,
        upmove: 0,
        impulse: 0,
        lightlevel: 0
    };

    const result = this.game.frame(ctx, cmd);
    this.lastSnapshot = result.state;

    // Update particles
    if (this.particleSystem) {
      this.particleSystem.update(dt, { floorZ: 0 });
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

  private buildViewProjectionMatrix(eyePos: vec3, pitch: number, yaw: number): Float32Array {
    const DEG2RAD = Math.PI / 180;
    const pitchRad = pitch * DEG2RAD;
    const yawRad = yaw * DEG2RAD;

    const fov = 90 * DEG2RAD;
    const aspect = this.canvas.width / this.canvas.height;
    const near = 1;
    const far = 4096;
    mat4.perspective(this.projectionMatrix, fov, aspect, near, far);

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
    if (!this.renderer || !this.room || !this.lastSnapshot) return;

    const now = performance.now();
    this.frameCount++;
    if (now - this.lastFrameTime >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFrameTime = now;
    }

    // Use view height from snapshot or default to 22
    const eyeHeight = 22; // this.lastSnapshot.viewHeight? (not directly in snapshot.state usually)
    const eyePos = vec3.fromValues(
      this.lastSnapshot.origin.x,
      this.lastSnapshot.origin.y,
      this.lastSnapshot.origin.z + eyeHeight
    );

    const viewProjection = this.buildViewProjectionMatrix(eyePos, this.pitch, this.yaw);

    if (this.gl) {
      this.gl.clearColor(0.1, 0.1, 0.1, 1.0);
      this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
      this.gl.enable(this.gl.DEPTH_TEST);
      this.renderProceduralRoomWebGL(viewProjection);
    } else if (this.gpuDevice && this.gpuContext) {
      this.renderProceduralRoomWebGPU(viewProjection);
    }
  }

  private renderProceduralRoomWebGPU(viewProjection: Float32Array): void {
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

    this.drawRoomGeometry(debug);
    this.drawEntities(debug);

    const commandEncoder = this.gpuDevice.createCommandEncoder({ label: 'game-render' });
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: textureView,
        clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1.0 },
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

  private renderProceduralRoomWebGL(viewProjection: Float32Array): void {
    if (!this.renderer || !this.room || !this.gl) return;

    const debug = this.renderer.debug as WebGLDebugRenderer;
    if (!debug || !('render' in debug)) return;

    this.drawRoomGeometry(debug);
    this.drawEntities(debug);

    debug.render(viewProjection);
    debug.clear();

    if (this.particleRenderer && this.particleSystem && this.lastSnapshot) {
      const eyePos = vec3.fromValues(
        this.lastSnapshot.origin.x,
        this.lastSnapshot.origin.y,
        this.lastSnapshot.origin.z + 22
      );
      const cameraAngles = vec3.fromValues(this.pitch, this.yaw, 0);

      this.gl.enable(this.gl.BLEND);
      this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
      this.particleRenderer.render({
        cameraState: {
          position: eyePos,
          angles: cameraAngles,
          fov: 90,
          aspect: this.canvas.width / this.canvas.height,
          near: 1,
          far: 4096,
        },
      });
      this.gl.disable(this.gl.BLEND);
    }
  }

  private drawRoomGeometry(debug: any): void {
      if (!this.room) return;
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
  }

  private drawEntities(debug: any): void {
      if (!this.lastSnapshot) return;

      // Draw other entities
      if (this.lastSnapshot.packetEntities) {
          for (const ent of this.lastSnapshot.packetEntities) {
              const color = { r: 0, g: 1, b: 0 }; // Green for entities
              // Draw simple box for now
              const size = 16;
              const x = ent.origin.x;
              const y = ent.origin.y;
              const z = ent.origin.z;

              // Bottom rect
              debug.drawLine({x: x-size, y: y-size, z}, {x: x+size, y: y-size, z}, color);
              debug.drawLine({x: x+size, y: y-size, z}, {x: x+size, y: y+size, z}, color);
              debug.drawLine({x: x+size, y: y+size, z}, {x: x-size, y: y+size, z}, color);
              debug.drawLine({x: x-size, y: y+size, z}, {x: x-size, y: y-size, z}, color);

              // Top rect
              const z2 = z + 32;
              debug.drawLine({x: x-size, y: y-size, z: z2}, {x: x+size, y: y-size, z: z2}, color);
              debug.drawLine({x: x+size, y: y-size, z: z2}, {x: x+size, y: y+size, z: z2}, color);
              debug.drawLine({x: x+size, y: y+size, z: z2}, {x: x-size, y: y+size, z: z2}, color);
              debug.drawLine({x: x-size, y: y+size, z: z2}, {x: x-size, y: y-size, z: z2}, color);

              // Verticals
              debug.drawLine({x: x-size, y: y-size, z}, {x: x-size, y: y-size, z: z2}, color);
              debug.drawLine({x: x+size, y: y-size, z}, {x: x+size, y: y-size, z: z2}, color);
              debug.drawLine({x: x+size, y: y+size, z}, {x: x+size, y: y+size, z: z2}, color);
              debug.drawLine({x: x-size, y: y+size, z}, {x: x-size, y: y+size, z: z2}, color);
          }
      }
  }
}
