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
} from '@quake2ts/engine';
import { vec3, mat4 } from 'gl-matrix';
import type { Vec3, CollisionModel, PmoveTraceFn, PmoveState, PmoveImports } from '@quake2ts/shared';
import {
  makeBrushFromMinsMaxs,
  makeLeafModel,
  createTraceRunner,
  runPmove,
  PmType,
  PmFlag,
  PlayerButton,
  WaterLevel,
  CONTENTS_NONE,
} from '@quake2ts/shared';

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

  // Collision system (using quake2ts collision)
  private collisionModel: CollisionModel | null = null;
  private trace: PmoveTraceFn | null = null;
  private pmoveImports: PmoveImports | null = null;

  // Player state (using quake2ts PmoveState)
  private pmState: PmoveState = {
    pmType: PmType.Normal,
    pmFlags: 0,
    origin: { x: 0, y: 0, z: 64 },
    velocity: { x: 0, y: 0, z: 0 },
    angles: { x: 0, y: 0, z: 0 },
    viewAngles: { x: 0, y: 0, z: 0 },
    viewHeight: 22,
    waterlevel: WaterLevel.None,
    watertype: 0,
    cmd: { forwardmove: 0, sidemove: 0, upmove: 0, buttons: 0, angles: { x: 0, y: 0, z: 0 } },
    delta_angles: { x: 0, y: 0, z: 0 },
    gravity: 800,
    mins: { x: -16, y: -16, z: -24 },
    maxs: { x: 16, y: 16, z: 32 },
  };

  // View angles (separate from pmove for smoother control)
  private yaw = 0;
  private pitch = 0;

  // Physics constants
  private readonly LOOK_SPEED = 120;

  private lastFrameTime = 0;
  private frameCount = 0;
  private fps = 0;

  // Pre-allocated matrices to avoid allocations in render loop
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

    // Create game loop with correct interface
    const callbacks: LoopCallbacks = {
      simulate: (ctx: FixedStepContext) => this.fixedUpdate(ctx.deltaMs),
      render: (ctx: RenderContext) => this.render(ctx),
    };

    this.loop = new FixedTimestepLoop(callbacks, {
      fixedDeltaMs: 1000 / 60, // 60 Hz physics
    });

    // Build collision model from room
    this.buildCollision();
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
    // North (+Y)
    brushes.push(makeBrushFromMinsMaxs(
      { x: -halfWidth, y: halfDepth - wallThickness, z: 0 },
      { x: halfWidth, y: halfDepth, z: this.room.height }
    ));
    // South (-Y)
    brushes.push(makeBrushFromMinsMaxs(
      { x: -halfWidth, y: -halfDepth, z: 0 },
      { x: halfWidth, y: -halfDepth + wallThickness, z: this.room.height }
    ));
    // East (+X)
    brushes.push(makeBrushFromMinsMaxs(
      { x: halfWidth - wallThickness, y: -halfDepth, z: 0 },
      { x: halfWidth, y: halfDepth, z: this.room.height }
    ));
    // West (-X)
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

    // Set up pmove imports with trace and pointcontents
    this.pmoveImports = {
      trace: this.trace,
      pointcontents: (_point: Vec3) => CONTENTS_NONE, // Simple: no water/lava in procedural room
    };
  }

  private async initWebGL(): Promise<void> {
    const contextState = createWebGLContext(this.canvas);
    if (!contextState) {
      throw new Error('Failed to create WebGL context');
    }
    this.gl = contextState.gl;
    this.renderer = createRenderer(this.gl);
  }

  private async initWebGPU(): Promise<void> {
    // For WebGPU, we pass the canvas directly
    const renderer = await createWebGPURenderer(this.canvas, {
      powerPreference: 'high-performance',
    });
    if (!renderer) {
      throw new Error('WebGPU not supported or failed to initialize');
    }
    this.renderer = renderer;

    // Store WebGPU state for manual rendering
    // Access the device from the renderer interface
    if ('device' in renderer) {
      this.gpuDevice = renderer.device;
    }

    // Get the canvas context for rendering
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
        x: this.pmState.origin.x,
        y: this.pmState.origin.y,
        z: this.pmState.origin.z,
      },
      angles: {
        pitch: this.pitch,
        yaw: this.yaw,
      },
      onGround: (this.pmState.pmFlags & PmFlag.OnGround) !== 0,
    };
  }

  private fixedUpdate(deltaMs: number): void {
    if (!this.inputHandler || !this.pmoveImports) return;

    const input = this.inputHandler.getState();
    const dt = deltaMs / 1000;

    // Update view angles
    this.updateViewAngles(input, dt);

    // Build pmove command from input
    let buttons: PlayerButton = 0;
    if (input.jump) buttons |= PlayerButton.Jump;

    const forwardmove = (input.forward ? 400 : 0) - (input.backward ? 400 : 0);
    const sidemove = (input.strafeRight ? 400 : 0) - (input.strafeLeft ? 400 : 0);

    // Update pmove state with new command
    this.pmState = {
      ...this.pmState,
      cmd: {
        forwardmove,
        sidemove,
        upmove: 0,
        buttons,
        angles: { x: this.pitch, y: this.yaw, z: 0 },
      },
      viewAngles: { x: this.pitch, y: this.yaw, z: 0 },
    };

    // Run quake2ts player movement physics
    this.pmState = runPmove(this.pmState, this.pmoveImports);
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

  /**
   * Build view-projection matrix with correct rotation order for FPS controls.
   *
   * The Camera class applies rotations as: Rz(yaw) * Ry(pitch)
   * This means pitch is applied in world space, causing the horizon to tilt.
   *
   * For proper FPS controls, we need: Ry(pitch) * Rz(yaw)
   * This applies yaw first (in world space), then pitch (in yaw-rotated space),
   * keeping the horizon level regardless of yaw angle.
   */
  private buildViewProjectionMatrix(eyePos: vec3, pitch: number, yaw: number): Float32Array {
    const DEG2RAD = Math.PI / 180;
    const pitchRad = pitch * DEG2RAD;
    const yawRad = yaw * DEG2RAD;

    // Build projection matrix
    const fov = 90 * DEG2RAD;
    const aspect = this.canvas.width / this.canvas.height;
    const near = 1;
    const far = 4096;
    mat4.perspective(this.projectionMatrix, fov, aspect, near, far);

    // Build view matrix with correct rotation order for FPS controls
    // Quake coordinate system: X forward, Y left, Z up
    // GL coordinate system: X right, Y up, -Z forward

    // Quake to GL coordinate transformation matrix (column-major):
    // Quake X (forward) -> GL -Z
    // Quake Y (left) -> GL -X
    // Quake Z (up) -> GL +Y
    const quakeToGl = mat4.fromValues(
       0,  0, -1, 0,  // column 0: Quake X -> GL -Z
      -1,  0,  0, 0,  // column 1: Quake Y -> GL -X
       0,  1,  0, 0,  // column 2: Quake Z -> GL +Y
       0,  0,  0, 1   // column 3: translation (none)
    );

    // Build rotation matrix with CORRECT order for FPS controls:
    // First yaw (around Z), then pitch (around local Y after yaw)
    // For view matrix (inverse of camera transform), we negate angles
    // and reverse the multiplication order
    const rotationQuake = mat4.create();
    mat4.identity(rotationQuake);

    // CORRECT ORDER: pitch first in matrix build, then yaw
    // This makes the view matrix apply yaw first, then pitch when transforming points
    mat4.rotateY(rotationQuake, rotationQuake, -pitchRad);
    mat4.rotateZ(rotationQuake, rotationQuake, -yawRad);

    // Combine rotation with coordinate transformation
    const rotationGl = mat4.create();
    mat4.multiply(rotationGl, quakeToGl, rotationQuake);

    // Apply rotation to negated position
    const negPos = vec3.negate(vec3.create(), eyePos);
    const rotatedPosQuake = vec3.transformMat4(vec3.create(), negPos, rotationQuake);

    // Transform position from Quake to GL coordinates
    const translationGl = vec3.fromValues(
      -rotatedPosQuake[1],  // Quake Y -> GL -X
       rotatedPosQuake[2],  // Quake Z -> GL +Y
      -rotatedPosQuake[0]   // Quake X -> GL -Z
    );

    // Assemble view matrix
    mat4.copy(this.viewMatrix, rotationGl);
    this.viewMatrix[12] = translationGl[0];
    this.viewMatrix[13] = translationGl[1];
    this.viewMatrix[14] = translationGl[2];

    // Combine into view-projection matrix
    mat4.multiply(this.viewProjectionMatrix, this.projectionMatrix, this.viewMatrix);

    return new Float32Array(this.viewProjectionMatrix);
  }

  private render(_ctx: RenderContext): void {
    if (!this.renderer || !this.room) return;

    // Update FPS counter
    const now = performance.now();
    this.frameCount++;
    if (now - this.lastFrameTime >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFrameTime = now;
    }

    // Calculate eye position with height offset
    const eyeHeight = this.pmState.viewHeight;
    const eyePos = vec3.fromValues(
      this.pmState.origin.x,
      this.pmState.origin.y,
      this.pmState.origin.z + eyeHeight
    );

    // Build view-projection matrix with correct rotation order for FPS controls
    // This fixes the horizon tilt issue when combining pitch and yaw
    const viewProjection = this.buildViewProjectionMatrix(eyePos, this.pitch, this.yaw);

    // Clear and render based on renderer type
    if (this.gl) {
      this.gl.clearColor(0.1, 0.1, 0.1, 1.0);
      this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
      this.gl.enable(this.gl.DEPTH_TEST);

      // Render procedural room using WebGL debug renderer
      this.renderProceduralRoomWebGL(viewProjection);
    } else if (this.gpuDevice && this.gpuContext) {
      // WebGPU path - create render pass and render debug geometry
      this.renderProceduralRoomWebGPU(viewProjection);
    }
  }

  private renderProceduralRoomWebGPU(viewProjection: Float32Array): void {
    if (!this.renderer || !this.room || !this.gpuDevice || !this.gpuContext) return;

    // Get current texture from swap chain
    const currentTexture = this.gpuContext.getCurrentTexture();
    const textureView = currentTexture.createView();

    // Create or recreate depth texture if needed
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

    // Access the debug renderer - cast to any since we know the structure
    const debug = (this.renderer as any).debug;
    if (!debug || !('render' in debug)) return;

    // Add debug geometry for the room
    for (const surface of this.room.surfaces) {
      const color = { r: surface.color[0], g: surface.color[1], b: surface.color[2] };

      // Draw surface outline
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

      // Draw diagonal for visual fill effect
      if (verts.length === 4) {
        debug.drawLine(
          { x: verts[0][0], y: verts[0][1], z: verts[0][2] },
          { x: verts[2][0], y: verts[2][1], z: verts[2][2] },
          color
        );
      }
    }

    // Draw coordinate axes at origin for reference
    debug.drawAxes({ x: 0, y: 0, z: 0 }, 64);

    // Create command encoder
    const commandEncoder = this.gpuDevice.createCommandEncoder({ label: 'game-render' });

    // Begin render pass
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

    // Render the debug geometry with correct view-projection matrix
    debug.render(renderPass, viewProjection, false);

    // End render pass
    renderPass.end();

    // Submit command buffer
    this.gpuDevice.queue.submit([commandEncoder.finish()]);

    // Clear debug geometry for next frame
    debug.clear();
  }

  private renderProceduralRoomWebGL(viewProjection: Float32Array): void {
    if (!this.renderer || !this.room) return;

    // Cast to WebGL debug renderer type which has render method
    const debug = this.renderer.debug as WebGLDebugRenderer;
    if (!debug || !('render' in debug)) return;

    // Draw room surfaces
    for (const surface of this.room.surfaces) {
      const color = { r: surface.color[0], g: surface.color[1], b: surface.color[2] };

      // Draw surface outline
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

      // Draw diagonal for visual fill effect
      if (verts.length === 4) {
        debug.drawLine(
          { x: verts[0][0], y: verts[0][1], z: verts[0][2] },
          { x: verts[2][0], y: verts[2][1], z: verts[2][2] },
          color
        );
      }
    }

    // Draw coordinate axes at origin for reference
    debug.drawAxes({ x: 0, y: 0, z: 0 }, 64);

    // Render the debug geometry with correct view-projection matrix
    debug.render(viewProjection);
    debug.clear();
  }
}
