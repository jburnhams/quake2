import {
  Vec3,
  dotVec3,
  CONTENTS_SOLID,
  Winding,
  createEmptyBounds3,
  windingBounds,
  splitWinding,
  addPointToBounds,
  baseWindingForPlane,
  copyWinding,
  MAX_WORLD_COORD
} from '@quake2ts/shared';
import type { BrushDef, EntityDef, TextureDef } from '../builder/types.js';
import {
  BspData,
  BspPlane,
  BspNode,
  BspLeaf,
  BspFace,
  BspTexInfo,
  BspModel,
  BspBrush,
  BspBrushSide,
  BspEdge,
  BSP_VERSION
} from '../types/bsp.js';
import { PlaneSet } from './planes.js';
import { generateBrushWindings } from './brushProcessing.js';
import { serializeEntities } from '../output/entityString.js';
import { generateTrivialVis } from './vis.js';
import { generateFullbrightLighting } from './lighting.js';

export interface CompileResult {
  bsp: BspData;
  stats: {
    planes: number;
    nodes: number;
    leafs: number;
    faces: number;
    brushes: number;
  };
}

class TexInfoManager {
  private texInfos: BspTexInfo[] = [];
  private lookup = new Map<string, number>();

  getTexInfos(): BspTexInfo[] {
    return this.texInfos;
  }

  findOrAdd(texture: TextureDef): number {
    // Unique key based on texture parameters
    const key = `${texture.name}_${texture.offsetX}_${texture.offsetY}_${texture.rotation}_${texture.scaleX}_${texture.scaleY}`;

    if (this.lookup.has(key)) {
      return this.lookup.get(key)!;
    }

    const scaleX = texture.scaleX || 1;
    const scaleY = texture.scaleY || 1;

    const s: Vec3 = { x: 1 / scaleX, y: 0, z: 0 };
    const t: Vec3 = { x: 0, y: -1 / scaleY, z: 0 };

    const ti: BspTexInfo = {
      s,
      sOffset: texture.offsetX || 0,
      t,
      tOffset: texture.offsetY || 0,
      flags: 0,
      value: 0,
      texture: texture.name,
      nextTexInfo: -1
    };

    const index = this.texInfos.length;
    this.texInfos.push(ti);
    this.lookup.set(key, index);

    return index;
  }
}

interface CompileFace {
  original: Winding;
  planeNum: number;
  side: number; // 0 = front, 1 = back
  texInfo: number;
}

interface BuildNode {
  planeNum: number;
  children: [BuildNode | null, BuildNode | null];
  bounds: any; // Bounds3
  faces: CompileFace[];
  isLeaf: boolean;
  contents: number;
  brushIndex?: number; // Index in source brushes if solid leaf
}

interface ProcessedBrush {
  index: number;
  def: BrushDef;
  windings: Map<number, Winding>;
}

export class SimpleCompiler {
  private planeSet = new PlaneSet();
  private texInfoManager = new TexInfoManager();

  private planes: BspPlane[] = [];
  private nodes: BspNode[] = [];
  private leafs: BspLeaf[] = [];
  private faces: BspFace[] = [];
  private edges: BspEdge[] = [];
  private surfEdges: number[] = [];
  private vertices: Vec3[] = [];
  private vertexMap: Map<string, number[]> = new Map();

  private models: BspModel[] = [];
  private brushes: BspBrush[] = [];
  private brushSides: BspBrushSide[] = [];

  private processedBrushes: ProcessedBrush[] = [];

  // Parallel arrays for leaf content
  private leafFacesList: number[][] = [];
  private leafBrushesList: number[][] = [];

  constructor(
    private inputBrushes: BrushDef[],
    private inputEntities: EntityDef[]
  ) {
    // Edge 0 is reserved/dummy
    this.edges.push({ vertices: [0, 0] });
  }

  compile(): CompileResult {
    // 1. Process Brushes to Windings
    this.processedBrushes = this.inputBrushes.map((b, i) => {
      return {
        index: i,
        def: b,
        windings: generateBrushWindings(b)
      };
    });

    // Populate BspBrush and BspBrushSide
    this.processedBrushes.forEach(pb => {
      const firstSide = this.brushSides.length;
      pb.def.sides.forEach(s => {
         const planeIdx = this.planeSet.findOrAdd(s.plane.normal, s.plane.dist);
         const texInfo = this.texInfoManager.findOrAdd(s.texture);
         this.brushSides.push({ planeIndex: planeIdx, texInfo });
      });
      const numSides = this.brushSides.length - firstSide;
      this.brushes.push({
         firstSide,
         numSides,
         contents: pb.def.contents ?? CONTENTS_SOLID
      });
    });

    // 2. Build BSP Tree
    // Start with a large universe box to track volume bounds
    const universeWindings = this.createUniverseWindings();
    const root = this.buildTree(this.processedBrushes.map(b => b.index), universeWindings);

    // 3. Serialize Tree to BSP structures
    const headNode = this.serializeTree(root);

    // 4. Create Models (Model 0 is the world)
    this.models.push({
      mins: root.bounds.mins, // Use root bounds
      maxs: root.bounds.maxs,
      origin: { x: 0, y: 0, z: 0 },
      headNode,
      firstFace: 0,
      numFaces: this.faces.length
    });

    // 5. Entities
    const entityString = serializeEntities(this.inputEntities);

    // 6. Lighting
    const planesList = this.planeSet.getPlanes().map(p => ({ normal: p.normal, dist: p.dist, type: p.type }));
    const lightMaps = generateFullbrightLighting(
      this.faces,
      this.vertices,
      this.texInfoManager.getTexInfos(),
      new Int32Array(this.surfEdges),
      this.edges,
      planesList
    );

    // 7. Visibility
    let maxCluster = -1;
    for (const l of this.leafs) {
      if (l.cluster > maxCluster) maxCluster = l.cluster;
    }
    const visibility = generateTrivialVis(maxCluster + 1);

    // 8. Assemble Final Data
    this.planes = planesList;

    const bsp: BspData = {
      header: { version: BSP_VERSION, lumps: new Map() },
      entities: { raw: entityString },
      planes: this.planes,
      vertices: this.vertices,
      nodes: this.nodes,
      texInfo: this.texInfoManager.getTexInfos(),
      faces: this.faces,
      lightMaps,
      lightMapInfo: [],
      leafs: this.leafs,
      leafLists: {
        leafFaces: this.leafFacesList,
        leafBrushes: this.leafBrushesList
      },
      edges: this.edges,
      surfEdges: new Int32Array(this.surfEdges),
      models: this.models,
      brushes: this.brushes,
      brushSides: this.brushSides,
      visibility,
      areas: [],
      areaPortals: []
    };

    return {
      bsp,
      stats: {
        planes: this.planes.length,
        nodes: this.nodes.length,
        leafs: this.leafs.length,
        faces: this.faces.length,
        brushes: this.brushes.length
      }
    };
  }

  private createUniverseWindings(): Winding[] {
    // Create 6 windings for a large box
    // +/- 16384 (MAX_WORLD_COORD is huge, let's pick a reasonable safe map size)
    // Actually, let's use MAX_WORLD_COORD but as box planes?
    // Or just manually construct 6 faces.
    // baseWindingForPlane gives us a huge winding.
    // We can just use 6 planes of a box and clip a base winding against others?
    // Or just manually set points.
    const size = 32768; // +/- size
    const mins = { x: -size, y: -size, z: -size };
    const maxs = { x: size, y: size, z: size };

    // We can use a helper or just define them.
    // Let's use baseWindingForPlane and clip against the other 5 planes?
    // That ensures consistency.

    const planes = [
      { normal: { x: 1, y: 0, z: 0 }, dist: maxs.x },
      { normal: { x: -1, y: 0, z: 0 }, dist: -mins.x },
      { normal: { x: 0, y: 1, z: 0 }, dist: maxs.y },
      { normal: { x: 0, y: -1, z: 0 }, dist: -mins.y },
      { normal: { x: 0, y: 0, z: 1 }, dist: maxs.z },
      { normal: { x: 0, y: 0, z: -1 }, dist: -mins.z },
    ];

    const windings: Winding[] = [];
    for (let i = 0; i < 6; i++) {
      let w = baseWindingForPlane(planes[i].normal, planes[i].dist);
      for (let j = 0; j < 6; j++) {
        if (i === j) continue;
        // Keep BACK of other planes (since they point OUT of the box)
        w = this.clipWindingOrNull(w, planes[j].normal, planes[j].dist, false);
        if (!w) break;
      }
      if (w) windings.push(w);
    }
    return windings;
  }

  // Wrapper to handle winding clip types
  private clipWindingOrNull(w: Winding, normal: Vec3, dist: number, keepFront: boolean): Winding | null {
    // We need to import clipWinding from shared/math/winding
    // I assumed it was imported above via 'clipWinding' but it might be named differently in shared exports?
    // 'clipWinding' is correct in my plan.
    // However, I need to implement the actual call.
    // But 'clipWinding' helper in shared is available.
    // The previous file had 'winding.ts' imports.
    // The import list needs to be updated.
    // I already updated imports in the top of this file content string.

    // Wait, shared imports:
    // import { ..., splitWinding, baseWindingForPlane, copyWinding } from '@quake2ts/shared';
    // I missed 'clipWinding'.
    // And 'createWinding'.

    // I need to use splitWinding mostly.

    // For universe creation, I need clipWinding logic.
    // I can simulate clip using splitWinding.
    const split = splitWinding(w, normal, dist);
    return keepFront ? split.front : split.back;
  }

  private calculateBounds(windings: Winding[]): any {
    let bounds = createEmptyBounds3();
    for (const w of windings) {
      const wb = windingBounds(w);
      // Merge bounds
      bounds = {
        mins: {
          x: Math.min(bounds.mins.x, wb.mins.x),
          y: Math.min(bounds.mins.y, wb.mins.y),
          z: Math.min(bounds.mins.z, wb.mins.z)
        },
        maxs: {
          x: Math.max(bounds.maxs.x, wb.maxs.x),
          y: Math.max(bounds.maxs.y, wb.maxs.y),
          z: Math.max(bounds.maxs.z, wb.maxs.z)
        }
      };
    }
    return bounds;
  }

  private buildTree(brushIndices: number[], volume: Winding[]): BuildNode {
    if (brushIndices.length === 0) {
      return this.createLeafNode(0, volume, undefined);
    }

    const splitPlane = this.findSeparator(brushIndices);

    if (splitPlane !== -1) {
      const plane = this.planeSet.getPlanes()[splitPlane];
      const front: number[] = [];
      const back: number[] = [];

      for (const idx of brushIndices) {
        const result = this.classifyBrush(idx, splitPlane);
        if (result === 'front') front.push(idx);
        else if (result === 'back') back.push(idx);
        else {
          front.push(idx);
          back.push(idx);
        }
      }

      // Split volume
      const frontVolume: Winding[] = [];
      const backVolume: Winding[] = [];

      for (const w of volume) {
        const split = splitWinding(w, plane.normal, plane.dist);
        if (split.front) frontVolume.push(split.front);
        if (split.back) backVolume.push(split.back);
      }

      // Also, splitting the volume generates a new face on the plane (the "cap").
      // The vertices of this cap are already part of the split windings' edges.
      // So for BOUNDS calculation, we don't strictly need to add the new face winding.
      // The extent is defined by the remaining pieces of the original boundary.
      // So passing just split fragments is sufficient for bounds.

      const node: BuildNode = {
        planeNum: splitPlane,
        children: [null, null],
        bounds: this.calculateBounds(volume),
        faces: [],
        isLeaf: false,
        contents: 0
      };

      node.children[0] = this.buildTree(front, frontVolume);
      node.children[1] = this.buildTree(back, backVolume);

      return node;
    }

    if (brushIndices.length === 1) {
      return this.buildBrushNode(brushIndices[0], volume);
    }

    // Overlapping brushes fallback
    return this.buildBrushNode(brushIndices[0], volume);
  }

  private findSeparator(brushIndices: number[]): number {
    for (const idx of brushIndices) {
       const brush = this.inputBrushes[idx];
       for (const side of brush.sides) {
         const planeIdx = this.planeSet.findOrAdd(side.plane.normal, side.plane.dist);

         let counts = { front: 0, back: 0, span: 0 };

         for (const testIdx of brushIndices) {
           const rel = this.classifyBrush(testIdx, planeIdx);
           if (rel === 'front') counts.front++;
           else if (rel === 'back') counts.back++;
           else counts.span++;
         }

         if (counts.span === 0 && counts.front > 0 && counts.back > 0) {
           return planeIdx;
         }
       }
    }
    return -1;
  }

  private classifyBrush(brushIdx: number, planeIdx: number): 'front' | 'back' | 'span' {
    const processed = this.processedBrushes[brushIdx];
    const plane = this.planeSet.getPlanes()[planeIdx];
    const normal = plane.normal;
    const dist = plane.dist;

    let front = false;
    let back = false;

    for (const w of processed.windings.values()) {
       for (const p of w.points) {
         const d = dotVec3(p, normal) - dist;
         if (d > 0.1) front = true;
         if (d < -0.1) back = true;
       }
    }

    if (front && back) return 'span';
    if (front) return 'front';
    return 'back';
  }

  private buildBrushNode(brushIdx: number, volume: Winding[]): BuildNode {
    const processed = this.processedBrushes[brushIdx];
    const brush = processed.def;
    const windings = processed.windings;

    const planes: number[] = [];
    const faces: CompileFace[] = [];

    for (const [sideIdx, w] of windings.entries()) {
      const side = brush.sides[sideIdx];
      const planeIdx = this.planeSet.findOrAdd(side.plane.normal, side.plane.dist);
      if (!planes.includes(planeIdx)) {
        planes.push(planeIdx);
      }

      const texInfo = this.texInfoManager.findOrAdd(side.texture);
      faces.push({
        original: w,
        planeNum: planeIdx,
        side: 0,
        texInfo
      });
    }

    if (planes.length === 0) {
       return this.createLeafNode(0, volume, undefined);
    }

    return this.buildConvexChain(planes, faces, 0, brushIdx, volume);
  }

  private buildConvexChain(
    planes: number[],
    faces: CompileFace[],
    index: number,
    brushIdx: number,
    volume: Winding[]
  ): BuildNode {
    if (index >= planes.length) {
      // Inside all planes -> Solid Leaf
      const contents = this.processedBrushes[brushIdx].def.contents ?? CONTENTS_SOLID;
      return this.createLeafNode(contents, volume, brushIdx);
    }

    const planeNum = planes[index];
    const plane = this.planeSet.getPlanes()[planeNum];

    const node: BuildNode = {
      planeNum,
      children: [null, null],
      bounds: this.calculateBounds(volume),
      faces: [],
      isLeaf: false,
      contents: 0
    };

    const onPlaneFaces = faces.filter(f => f.planeNum === planeNum);
    node.faces = onPlaneFaces;

    // Split volume for children
    const frontVolume: Winding[] = [];
    const backVolume: Winding[] = [];

    for (const w of volume) {
      const split = splitWinding(w, plane.normal, plane.dist);
      if (split.front) frontVolume.push(split.front);
      if (split.back) backVolume.push(split.back);
    }

    // Front child is Outside (Empty Leaf)
    node.children[0] = this.createLeafNode(0, frontVolume, undefined);

    // Back child is recursion (Inside)
    node.children[1] = this.buildConvexChain(planes, faces, index + 1, brushIdx, backVolume);

    return node;
  }

  private createLeafNode(contents: number, volume: Winding[], brushIdx?: number): BuildNode {
    return {
      planeNum: -1,
      children: [null, null],
      bounds: this.calculateBounds(volume),
      faces: [],
      isLeaf: true,
      contents,
      brushIndex: brushIdx
    };
  }

  private serializeTree(node: BuildNode): number {
    if (node.isLeaf) {
      const leafIndex = this.leafs.length;
      const cluster = node.contents === 0 ? leafIndex : -1;

      const faces: number[] = [];
      const brushes: number[] = [];

      if (node.brushIndex !== undefined) {
        brushes.push(node.brushIndex);
      }

      this.leafFacesList.push(faces);
      this.leafBrushesList.push(brushes);

      const leaf: BspLeaf = {
        contents: node.contents,
        cluster,
        area: 0,
        mins: [
          Math.floor(node.bounds.mins.x),
          Math.floor(node.bounds.mins.y),
          Math.floor(node.bounds.mins.z)
        ],
        maxs: [
          Math.ceil(node.bounds.maxs.x),
          Math.ceil(node.bounds.maxs.y),
          Math.ceil(node.bounds.maxs.z)
        ],
        firstLeafFace: 0,
        numLeafFaces: 0,
        firstLeafBrush: 0,
        numLeafBrushes: 0
      };

      this.leafs.push(leaf);
      return -(leafIndex + 1);
    }

    const planenum = node.planeNum;
    const front = this.serializeTree(node.children[0]!);
    const back = this.serializeTree(node.children[1]!);

    const firstFace = this.faces.length;
    for (const f of node.faces) {
      const faceIdx = this.serializeFace(f);
      if (front < 0) {
        const leafIdx = -(front + 1);
        this.leafFacesList[leafIdx].push(faceIdx);
      } else {
        this.addFaceToSubtree(front, faceIdx);
      }
    }
    const numFaces = this.faces.length - firstFace;

    const bspNode: BspNode = {
      planeIndex: planenum,
      children: [front, back],
      mins: [
        Math.floor(node.bounds.mins.x),
        Math.floor(node.bounds.mins.y),
        Math.floor(node.bounds.mins.z)
      ],
      maxs: [
        Math.ceil(node.bounds.maxs.x),
        Math.ceil(node.bounds.maxs.y),
        Math.ceil(node.bounds.maxs.z)
      ],
      firstFace,
      numFaces
    };

    const nodeIndex = this.nodes.length;
    this.nodes.push(bspNode);

    return nodeIndex;
  }

  private addFaceToSubtree(nodeIdx: number, faceIdx: number) {
    if (nodeIdx < 0) {
      const leafIdx = -(nodeIdx + 1);
      this.leafFacesList[leafIdx].push(faceIdx);
      return;
    }
    const node = this.nodes[nodeIdx];
    this.addFaceToSubtree(node.children[0], faceIdx);
    this.addFaceToSubtree(node.children[1], faceIdx);
  }

  private serializeFace(f: CompileFace): number {
    const firstEdge = this.surfEdges.length;
    const w = f.original;
    for (let i = 0; i < w.numPoints; i++) {
      const p1 = w.points[i];
      const p2 = w.points[(i + 1) % w.numPoints];
      const v1 = this.addVertex(p1);
      const v2 = this.addVertex(p2);
      const edgeIdx = this.addEdge(v1, v2);
      this.surfEdges.push(edgeIdx);
    }
    const numEdges = this.surfEdges.length - firstEdge;

    const faceIdx = this.faces.length;
    this.faces.push({
      planeIndex: f.planeNum,
      side: f.side,
      firstEdge,
      numEdges,
      texInfo: f.texInfo,
      styles: [0, 0, 0, 0],
      lightOffset: -1
    });
    return faceIdx;
  }

  private addVertex(v: Vec3): number {
    const key = this.getVertexHash(v);
    const x = Math.floor(v.x);
    const y = Math.floor(v.y);
    const z = Math.floor(v.z);

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
           const nKey = `${x+dx}_${y+dy}_${z+dz}`;
           const bucket = this.vertexMap.get(nKey);
           if (bucket) {
             for (const idx of bucket) {
               const ov = this.vertices[idx];
               if (Math.abs(ov.x - v.x) < 0.01 &&
                   Math.abs(ov.y - v.y) < 0.01 &&
                   Math.abs(ov.z - v.z) < 0.01) {
                 return idx;
               }
             }
           }
        }
      }
    }

    const index = this.vertices.length;
    this.vertices.push(v);

    let bucket = this.vertexMap.get(key);
    if (!bucket) {
      bucket = [];
      this.vertexMap.set(key, bucket);
    }
    bucket.push(index);

    return index;
  }

  private getVertexHash(v: Vec3): string {
    return `${Math.floor(v.x)}_${Math.floor(v.y)}_${Math.floor(v.z)}`;
  }

  private addEdge(v1: number, v2: number): number {
    for (let i = 1; i < this.edges.length; i++) {
      const e = this.edges[i];
      if ((e.vertices[0] === v1 && e.vertices[1] === v2)) return i;
      if ((e.vertices[0] === v2 && e.vertices[1] === v1)) return -i;
    }
    const idx = this.edges.length;
    this.edges.push({ vertices: [v1, v2] });
    return idx;
  }
}
