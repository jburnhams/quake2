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
import { vec3 } from 'gl-matrix';
import type { Vec3 } from '@quake2ts/shared';

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

  // Player state
  private position = vec3.fromValues(0, 0, 64); // Start at center, 64 units up
  private velocity = vec3.fromValues(0, 0, 0);
  private yaw = 0; // degrees
  private pitch = 0; // degrees

  // Physics constants (matching Quake 2)
  private readonly MOVE_SPEED = 320;
  private readonly LOOK_SPEED = 120; // degrees per second
  private readonly GRAVITY = 800;
  private readonly JUMP_VELOCITY = 270;
  private readonly FRICTION = 6;
  private readonly FLOOR_HEIGHT = 0; // Ground level

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
    if (this.renderer && 'dispose' in this.renderer) {
      this.renderer.dispose();
    }
    this.renderer = null;
    this.camera = null;
    this.loop = null;
    this.inputHandler = null;
    this.gl = null;
  }

  getStats(): GameStats {
    return {
      fps: this.fps,
      position: {
        x: this.position[0],
        y: this.position[1],
        z: this.position[2],
      },
    };
  }

  private fixedUpdate(deltaMs: number): void {
    if (!this.inputHandler) return;

    const input = this.inputHandler.getState();
    const dt = deltaMs / 1000; // Convert to seconds

    // Update view angles
    this.updateViewAngles(input, dt);

    // Update movement
    this.updateMovement(input, dt);
  }

  private updateViewAngles(input: InputState, dt: number): void {
    // Arrow keys for looking
    if (input.lookLeft) {
      this.yaw += this.LOOK_SPEED * dt;
    }
    if (input.lookRight) {
      this.yaw -= this.LOOK_SPEED * dt;
    }
    if (input.lookUp) {
      this.pitch -= this.LOOK_SPEED * dt;
    }
    if (input.lookDown) {
      this.pitch += this.LOOK_SPEED * dt;
    }

    // Clamp pitch to prevent flipping
    this.pitch = Math.max(-89, Math.min(89, this.pitch));

    // Normalize yaw
    this.yaw = this.yaw % 360;
  }

  private updateMovement(input: InputState, dt: number): void {
    // Check if on ground
    const onGround = this.position[2] <= this.FLOOR_HEIGHT + 0.1;

    // Apply gravity if not on ground
    if (!onGround) {
      this.velocity[2] -= this.GRAVITY * dt;
    } else {
      this.velocity[2] = 0;
      this.position[2] = this.FLOOR_HEIGHT;
    }

    // Jump
    if (input.jump && onGround) {
      this.velocity[2] = this.JUMP_VELOCITY;
    }

    // Calculate forward and right vectors based on yaw (in Quake coordinates: X forward, Y left, Z up)
    const yawRad = (this.yaw * Math.PI) / 180;
    const forward = vec3.fromValues(Math.cos(yawRad), Math.sin(yawRad), 0);
    const right = vec3.fromValues(-Math.sin(yawRad), Math.cos(yawRad), 0);

    // Calculate wish velocity from input
    const wishDir = vec3.create();
    if (input.forward) vec3.add(wishDir, wishDir, forward);
    if (input.backward) vec3.subtract(wishDir, wishDir, forward);
    if (input.strafeLeft) vec3.add(wishDir, wishDir, right);
    if (input.strafeRight) vec3.subtract(wishDir, wishDir, right);

    // Normalize and scale
    const wishSpeed = vec3.length(wishDir);
    if (wishSpeed > 0.001) {
      vec3.normalize(wishDir, wishDir);
    }

    // Apply movement
    if (onGround) {
      // Ground movement with friction
      const speed = vec3.length([this.velocity[0], this.velocity[1], 0]);
      if (speed > 0) {
        const drop = speed * this.FRICTION * dt;
        const newSpeed = Math.max(0, speed - drop);
        const scale = newSpeed / speed;
        this.velocity[0] *= scale;
        this.velocity[1] *= scale;
      }

      // Accelerate
      if (wishSpeed > 0) {
        this.velocity[0] = wishDir[0] * this.MOVE_SPEED;
        this.velocity[1] = wishDir[1] * this.MOVE_SPEED;
      }
    } else {
      // Air movement (reduced control)
      if (wishSpeed > 0) {
        const airAccel = 0.1;
        this.velocity[0] += wishDir[0] * this.MOVE_SPEED * airAccel * dt;
        this.velocity[1] += wishDir[1] * this.MOVE_SPEED * airAccel * dt;
      }
    }

    // Update position
    this.position[0] += this.velocity[0] * dt;
    this.position[1] += this.velocity[1] * dt;
    this.position[2] += this.velocity[2] * dt;

    // Simple collision with room bounds
    if (this.room) {
      const halfWidth = this.room.width / 2 - 32;
      const halfDepth = this.room.depth / 2 - 32;
      this.position[0] = Math.max(-halfWidth, Math.min(halfWidth, this.position[0]));
      this.position[1] = Math.max(-halfDepth, Math.min(halfDepth, this.position[1]));
      this.position[2] = Math.max(this.FLOOR_HEIGHT, Math.min(this.room.height - 32, this.position[2]));
    }
  }

  private render(_ctx: RenderContext): void {
    if (!this.renderer || !this.camera || !this.room) return;

    // Update FPS counter
    const now = performance.now();
    this.frameCount++;
    if (now - this.lastFrameTime >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFrameTime = now;
    }

    // Set camera position and angles
    // Eye height offset
    const eyeHeight = 56; // Quake 2 standing eye height
    this.camera.setPosition(this.position[0], this.position[1], this.position[2] + eyeHeight);
    this.camera.setRotation(this.pitch, this.yaw, 0);

    // Clear and render based on renderer type
    if (this.gl) {
      this.gl.clearColor(0.1, 0.1, 0.1, 1.0);
      this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
      this.gl.enable(this.gl.DEPTH_TEST);

      // Render procedural room using WebGL debug renderer
      this.renderProceduralRoomWebGL();
    } else {
      // WebGPU path - use the renderFrame method of the renderer
      // For now, we just render the debug geometry
      // TODO: Implement WebGPU debug rendering
    }
  }

  private renderProceduralRoomWebGL(): void {
    if (!this.renderer || !this.camera || !this.room) return;

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

    // Render the debug geometry
    const viewProjection = this.camera.viewProjectionMatrix;
    debug.render(new Float32Array(viewProjection));
    debug.clear();
  }
}
