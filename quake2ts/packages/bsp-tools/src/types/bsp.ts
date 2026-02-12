// BSP structures (mirrors @quake2ts/engine/src/assets/bsp.ts)
// This file allows bsp-tools to output BSP data without depending on the engine package.

import type { Vec3 } from '@quake2ts/shared';

// Constants
export const BSP_MAGIC = 'IBSP';
export const BSP_VERSION = 38;

export interface BspLumpInfo {
  readonly offset: number;
  readonly length: number;
}

export interface BspHeader {
  readonly version: number;
  readonly lumps: ReadonlyMap<number, BspLumpInfo>;
}

export interface BspEntities {
  readonly raw: string;
  // Methods are not required for raw data output
}

export interface BspPlane {
  readonly normal: Vec3;
  readonly dist: number;
  readonly type: number;
}

export interface BspNode {
  readonly planeIndex: number;
  readonly children: [number, number]; // Positive = child node, Negative = -(leaf+1)
  readonly mins: [number, number, number];
  readonly maxs: [number, number, number];
  readonly firstFace: number;
  readonly numFaces: number;
}

export interface BspLeaf {
  readonly contents: number;
  readonly cluster: number;
  readonly area: number;
  readonly mins: [number, number, number];
  readonly maxs: [number, number, number];
  readonly firstLeafFace: number;
  readonly numLeafFaces: number;
  readonly firstLeafBrush: number;
  readonly numLeafBrushes: number;
}

export interface BspTexInfo {
  readonly s: Vec3;
  readonly sOffset: number;
  readonly t: Vec3;
  readonly tOffset: number;
  readonly flags: number;
  readonly value: number;
  readonly texture: string;
  readonly nextTexInfo: number;
}

export interface BspFace {
  readonly planeIndex: number;
  readonly side: number;
  readonly firstEdge: number;
  readonly numEdges: number;
  readonly texInfo: number;
  readonly styles: [number, number, number, number];
  readonly lightOffset: number;
}

export interface BspEdge {
  readonly vertices: [number, number];
}

export interface BspModel {
  readonly mins: Vec3;
  readonly maxs: Vec3;
  readonly origin: Vec3;
  readonly headNode: number;
  readonly firstFace: number;
  readonly numFaces: number;
}

export interface BspBrush {
  readonly firstSide: number;
  readonly numSides: number;
  readonly contents: number;
}

export interface BspBrushSide {
  readonly planeIndex: number;
  readonly texInfo: number;
}

export interface BspArea {
  readonly numAreaPortals: number;
  readonly firstAreaPortal: number;
}

export interface BspAreaPortal {
  readonly portalNumber: number;
  readonly otherArea: number;
}

export interface BspVisibilityCluster {
  readonly pvs: Uint8Array;
  readonly phs: Uint8Array;
}

export interface BspVisibility {
  readonly numClusters: number;
  readonly clusters: readonly BspVisibilityCluster[];
}

export interface BspLightmapInfo {
  readonly offset: number;
  readonly length: number;
}

export interface BspLeafLists {
  readonly leafFaces: readonly number[][];
  readonly leafBrushes: readonly number[][];
}

/**
 * Complete BSP Data structure.
 * This is the in-memory representation used by the engine.
 */
export interface BspData {
  readonly header: BspHeader;
  readonly entities: BspEntities;
  readonly planes: readonly BspPlane[];
  readonly vertices: readonly Vec3[];
  readonly nodes: readonly BspNode[];
  readonly texInfo: readonly BspTexInfo[];
  readonly faces: readonly BspFace[];
  readonly lightMaps: Uint8Array;
  readonly lightMapInfo: readonly (BspLightmapInfo | undefined)[];
  readonly leafs: readonly BspLeaf[];
  readonly leafLists: BspLeafLists;
  readonly edges: readonly BspEdge[];
  readonly surfEdges: Int32Array; // Using Int32Array for performance/memory
  readonly models: readonly BspModel[];
  readonly brushes: readonly BspBrush[];
  readonly brushSides: readonly BspBrushSide[];
  readonly visibility: BspVisibility | undefined;
  readonly areas: readonly BspArea[];
  readonly areaPortals: readonly BspAreaPortal[];
  readonly rawLumps?: ReadonlyMap<number, Uint8Array>;
}

export enum BspLump {
  Entities = 0,
  Planes = 1,
  Vertices = 2,
  Visibility = 3,
  Nodes = 4,
  TexInfo = 5,
  Faces = 6,
  Lighting = 7,
  Leafs = 8,
  LeafFaces = 9,
  LeafBrushes = 10,
  Edges = 11,
  SurfEdges = 12,
  Models = 13,
  Brushes = 14,
  BrushSides = 15,
  Pop = 16,
  Areas = 17,
  AreaPortals = 18,
}
