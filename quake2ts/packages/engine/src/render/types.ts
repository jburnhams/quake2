
export enum RenderMode {
  WebGL = 'webgl',
  Headless = 'headless'
}

export interface MapGeometry {
  vertices: Float32Array;
  indices: Uint32Array;
  bounds: {
    mins: [number, number, number];
    maxs: [number, number, number];
  };
}

export interface TextureReference {
  name: string;
  flags: number;
}

export interface LightmapData {
  width: number;
  height: number;
  data: Uint8Array;
}
