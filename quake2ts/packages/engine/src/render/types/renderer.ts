export interface RendererCapabilities {
  readonly maxTextureSize: number;
  readonly maxLights: number;
  readonly supportsCompute: boolean;
  readonly supportsTimestampQuery: boolean;
}

export interface RenderCommand {
  readonly type: 'draw' | 'clear' | 'setViewport' | 'setScissor';
  readonly timestamp?: number;
}

// For logging/null renderers
export interface RenderCommandLog {
  readonly commands: ReadonlyArray<RenderCommand>;
  readonly stats: {
    readonly drawCalls: number;
    readonly triangles: number;
  };
}
