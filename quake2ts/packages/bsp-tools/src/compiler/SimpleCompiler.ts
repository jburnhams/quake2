import {
  Vec3,
  dotVec3,
  addVec3,
  scaleVec3,
  crossVec3,
  normalizeVec3,
  subtractVec3,
  lengthVec3,
  CONTENTS_SOLID,
  Winding,
  createEmptyBounds3,
  addPointToBounds,
  windingBounds,
  windingCenter,
  windingArea
} from '@quake2ts/shared';
import type { BrushDef, EntityDef, TextureDef } from '../builder/types.js';
import {
  BspData,
  BspHeader,
  BspLump,
  BspPlane,
  BspNode,
  BspLeaf,
  BspFace,
  BspTexInfo,
  BspModel,
  BspBrush,
  BspBrushSide,
  BspEdge,
  BspLumpInfo,
  BSP_MAGIC,
  BSP_VERSION
} from '../types/bsp.js';
import { PlaneSet, CompilePlane } from './planes.js';
import { generateBrushWindings } from './brushProcessing.js';

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
    // Basic implementation: assume default projection for now or derived from texture
    // Quake 2 uses projected textures.
    // For MVP, we'll create a simple projection based on the texture name and parameters.
    const key = `${texture.name}_${texture.offsetX}_${texture.offsetY}_${texture.rotation}_${texture.scaleX}_${texture.scaleY}`;

    if (this.lookup.has(key)) {
      return this.lookup.get(key)!;
    }

    // Default projection (dummy values for now as we don't have surface info here easily without face)
    // In reality, TexInfo is computed from face normal and texture parameters.
    // But TexInfo is shared across faces.
    // We'll assume a standard projection (e.g. aligned to world axes) or just store the parameters.
    // Quake 2 engines re-project based on the face normal and these vectors.
    // We need 2 vectors (S and T) and offsets.

    // For MVP, we'll just use identity/dummy values if we can't compute them fully.
    // Or we can compute them on the fly if we knew the plane.
    // But TexInfo is independent of the plane in the BSP format (it's just projection vectors).

    // Let's use a standard mapping.
    const s: Vec3 = { x: 1/ (texture.scaleX || 1), y: 0, z: 0 };
    const t: Vec3 = { x: 0, y: -1/ (texture.scaleY || 1), z: 0 }; // Flip T for Quake coords?

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
  brushIndex?: number; // Index in source brushes
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

  constructor(
    private inputBrushes: BrushDef[],
    private inputEntities: EntityDef[]
  ) {
    // Edge 0 is reserved/dummy to allow negative indices for reversal
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
    // We start with a single root node that covers the world
    const root = this.buildTree(this.processedBrushes.map(b => b.index));

    // 3. Serialize Tree to BSP structures
    this.serializeTree(root);

    // 4. Create Models (Model 0 is the world)
    this.models.push({
      mins: { x: -4096, y: -4096, z: -4096 }, // TODO: Calc bounds
      maxs: { x: 4096, y: 4096, z: 4096 },
      origin: { x: 0, y: 0, z: 0 },
      headNode: 0,
      firstFace: 0,
      numFaces: this.faces.length
    });

    // 5. Entities
    // TODO: Serialize entities

    // 6. Assemble Final Data
    this.planes = this.planeSet.getPlanes().map(p => ({ normal: p.normal, dist: p.dist, type: p.type }));

    const bsp: BspData = {
      header: { version: BSP_VERSION, lumps: new Map() }, // Lumps filled later or ignored for object return
      entities: { raw: '', entities: [] } as any, // TODO
      planes: this.planes,
      vertices: this.vertices,
      nodes: this.nodes,
      texInfo: this.texInfoManager.getTexInfos(),
      faces: this.faces,
      lightMaps: new Uint8Array(0),
      lightMapInfo: [],
      leafs: this.leafs,
      leafLists: { leafFaces: [], leafBrushes: [] }, // TODO
      edges: this.edges,
      surfEdges: new Int32Array(this.surfEdges),
      models: this.models,
      brushes: this.brushes,
      brushSides: this.brushSides,
      visibility: undefined,
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

  private buildTree(brushIndices: number[]): BuildNode {
    if (brushIndices.length === 0) {
      return {
        planeNum: -1,
        children: [null, null],
        bounds: createEmptyBounds3(),
        faces: [],
        isLeaf: true,
        contents: 0
      };
    }

    // Heuristic: Pick a splitter from the first brush's planes
    // For non-overlapping brushes, we want a plane that separates the set.
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
          // Split spanning brush? For MVP error.
          // Or just put in both?
          // If we put in both, we duplicate the brush reference.
          // For collision, this is acceptable.
          front.push(idx);
          back.push(idx);
        }
      }

      const node: BuildNode = {
        planeNum: splitPlane,
        children: [null, null],
        bounds: createEmptyBounds3(),
        faces: [], // Faces on this plane?
        isLeaf: false,
        contents: 0
      };

      node.children[0] = this.buildTree(front);
      node.children[1] = this.buildTree(back);

      return node;
    }

    // No separator found (or single brush).
    // If single brush, carve it out.
    if (brushIndices.length === 1) {
      return this.buildBrushNode(brushIndices[0]);
    }

    // Overlapping brushes that can't be separated?
    // Treat as union?
    // For MVP, just carve them sequentially.
    // Root -> Brush 1 -> Brush 2...
    // But we are in a leaf context here.
    // If we can't separate them, they overlap.
    // We can just process the first one, and put the rest in the 'empty' space of the first one?
    // That handles Union.

    // Let's try: Pick first brush, use its planes.
    // Any other brush will be pushed down.
    const first = brushIndices[0];
    const rest = brushIndices.slice(1);

    // This effectively builds a tree for 'first', but inserts 'rest' into it.
    // We need 'insertBrush' logic here.
    // Since 'buildBrushNode' returns a tree for one brush, we can't easily insert into it without modifying it.

    // Alternative: Just fail for MVP if > 1 and no separator.
    console.warn("Overlapping brushes detected, results may be incorrect.");
    return this.buildBrushNode(first);
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

         // A valid splitter must not span (for MVP) and must separate the set
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

  private buildBrushNode(brushIdx: number): BuildNode {
    const processed = this.processedBrushes[brushIdx];
    const brush = processed.def;
    const windings = processed.windings;

    // Create a chain of nodes for each face
    // But we need a tree structure.
    // We can pick planes sequentially.
    // Root (Plane 0) -> Back: Node 1 -> ... -> Back: Solid Leaf
    //                -> Front: Empty Leaf (outside)

    // Collect all unique planes for this brush
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
        side: 0, // Assume front
        texInfo
      });
    }

    if (planes.length === 0) {
       // Should not happen for valid brush
       return {
         planeNum: -1,
         children: [null, null],
         bounds: createEmptyBounds3(),
         faces: [],
         isLeaf: true,
         contents: 0
       };
    }

    return this.buildConvexChain(planes, faces, 0, brushIdx);
  }

  private buildConvexChain(planes: number[], faces: CompileFace[], index: number, brushIdx: number): BuildNode {
    if (index >= planes.length) {
      // Inside all planes -> Solid
      return {
        planeNum: -1,
        children: [null, null],
        bounds: createEmptyBounds3(),
        faces: [],
        isLeaf: true,
        contents: CONTENTS_SOLID,
        brushIndex: brushIdx
      };
    }

    const planeNum = planes[index];
    const node: BuildNode = {
      planeNum,
      children: [null, null],
      bounds: createEmptyBounds3(),
      faces: [],
      isLeaf: false,
      contents: 0
    };

    // Find faces on this plane
    // For a convex brush, faces on this plane are part of the boundary.
    // We attach them to the node.
    const onPlaneFaces = faces.filter(f => f.planeNum === planeNum);
    node.faces = onPlaneFaces;

    // Front child is Outside (Empty)
    node.children[0] = {
      planeNum: -1,
      children: [null, null],
      bounds: createEmptyBounds3(),
      faces: [],
      isLeaf: true,
      contents: 0
    };

    // Back child is recursion (Inside)
    node.children[1] = this.buildConvexChain(planes, faces, index + 1, brushIdx);

    return node;
  }

  private serializeTree(node: BuildNode): number {
    if (node.isLeaf) {
      const leaf: BspLeaf = {
        contents: node.contents,
        cluster: -1, // No vis
        area: 0,
        mins: [0, 0, 0], // TODO
        maxs: [0, 0, 0],
        firstLeafFace: 0, // TODO: Leaf faces
        numLeafFaces: 0,
        firstLeafBrush: 0, // TODO: Leaf brushes
        numLeafBrushes: 0
      };

      const leafIndex = this.leafs.length;
      this.leafs.push(leaf);
      return -(leafIndex + 1);
    }

    const planenum = node.planeNum;
    const front = this.serializeTree(node.children[0]!);
    const back = this.serializeTree(node.children[1]!);

    // Serialize faces
    const firstFace = this.faces.length;
    for (const f of node.faces) {
      this.serializeFace(f);
    }
    const numFaces = this.faces.length - firstFace;

    const bspNode: BspNode = {
      planeIndex: planenum,
      children: [front, back],
      mins: [0, 0, 0], // TODO
      maxs: [0, 0, 0],
      firstFace,
      numFaces
    };

    const nodeIndex = this.nodes.length;
    this.nodes.push(bspNode);

    return nodeIndex;
  }

  private serializeFace(f: CompileFace) {
    // Need vertices and edges
    const firstEdge = this.surfEdges.length;

    // Add vertices and edges
    const w = f.original;
    for (let i = 0; i < w.numPoints; i++) {
      const p1 = w.points[i];
      const p2 = w.points[(i + 1) % w.numPoints];

      const v1 = this.addVertex(p1);
      const v2 = this.addVertex(p2);

      const edgeIdx = this.addEdge(v1, v2);
      this.surfEdges.push(edgeIdx); // TODO: Direction
    }

    const numEdges = this.surfEdges.length - firstEdge;

    this.faces.push({
      planeIndex: f.planeNum,
      side: f.side,
      firstEdge,
      numEdges,
      texInfo: f.texInfo,
      styles: [0, 0, 0, 0],
      lightOffset: -1
    });
  }

  private addVertex(v: Vec3): number {
    const key = this.getVertexHash(v);

    // Check main bucket and neighbors to catch boundary cases
    // Epsilon is 0.01, bucket size is 1.0.
    // Boundary issue happens if v is e.g. 0.999 and duplicate is 1.001.
    // They are distance 0.002 apart (< 0.01), but in buckets '0' and '1'.
    // We should check 3x3x3 neighbors or rely on bucket size >> epsilon.
    // With bucket 1.0 vs epsilon 0.01, checking just the main bucket is "mostly" fine
    // but theoretically incorrect.
    // Let's implement neighbor checking for correctness if we want to be robust.
    // Or just check if candidate is close enough.

    // For MVP optimization, checking adjacent buckets is safer.
    // But it's 27 lookups.
    // Alternatively, just iterate all candidates from all adjacent buckets.

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

    const candidates = this.vertexMap.get(key);

    // Add new vertex
    const index = this.vertices.length;
    this.vertices.push(v);

    // Add to map
    if (!candidates) {
      this.vertexMap.set(key, [index]);
    } else {
      candidates.push(index);
    }

    return index;
  }

  private getVertexHash(v: Vec3): string {
    const x = Math.floor(v.x);
    const y = Math.floor(v.y);
    const z = Math.floor(v.z);
    return `${x}_${y}_${z}`;
  }

  private addEdge(v1: number, v2: number): number {
    // Scan edges (skip 0)
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
