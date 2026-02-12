import {
  Vec3,
  dotVec3,
  CONTENTS_SOLID,
  Winding,
  createEmptyBounds3,
  windingBounds,
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

    // Default projection logic
    // Quake 2 uses projected textures based on face normal usually, but here we store explicit params.
    // We'll use a standard projection: S along X (scaled), T along Y (scaled, flipped).

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
    const root = this.buildTree(this.processedBrushes.map(b => b.index));

    // 3. Serialize Tree to BSP structures
    const headNode = this.serializeTree(root);

    // 4. Create Models (Model 0 is the world)
    this.models.push({
      mins: { x: -4096, y: -4096, z: -4096 }, // TODO: Calc bounds
      maxs: { x: 4096, y: 4096, z: 4096 },
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
    // Count clusters (valid empty leaves)
    // We assigned cluster = index for empty leaves in serializeTree
    // Max cluster index is leafs.length - 1 roughly.
    // We need to count how many clusters actually exist.
    // For trivial vis, assume numClusters = leafs.length (worst case) or track max cluster.
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

  private buildTree(brushIndices: number[]): BuildNode {
    if (brushIndices.length === 0) {
      return this.createLeafNode(0);
    }

    const splitPlane = this.findSeparator(brushIndices);

    if (splitPlane !== -1) {
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

      const node: BuildNode = {
        planeNum: splitPlane,
        children: [null, null],
        bounds: createEmptyBounds3(),
        faces: [],
        isLeaf: false,
        contents: 0
      };

      node.children[0] = this.buildTree(front);
      node.children[1] = this.buildTree(back);

      return node;
    }

    if (brushIndices.length === 1) {
      return this.buildBrushNode(brushIndices[0]);
    }

    // Overlapping brushes fallback
    return this.buildBrushNode(brushIndices[0]);
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

  private buildBrushNode(brushIdx: number): BuildNode {
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
       return this.createLeafNode(0);
    }

    return this.buildConvexChain(planes, faces, 0, brushIdx);
  }

  private buildConvexChain(planes: number[], faces: CompileFace[], index: number, brushIdx: number): BuildNode {
    if (index >= planes.length) {
      // Inside all planes -> Solid Leaf
      const contents = this.processedBrushes[brushIdx].def.contents ?? CONTENTS_SOLID;
      return this.createLeafNode(contents, brushIdx);
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

    const onPlaneFaces = faces.filter(f => f.planeNum === planeNum);
    node.faces = onPlaneFaces;

    // Front child is Outside (Empty Leaf)
    node.children[0] = this.createLeafNode(0);

    // Back child is recursion (Inside)
    node.children[1] = this.buildConvexChain(planes, faces, index + 1, brushIdx);

    return node;
  }

  private createLeafNode(contents: number, brushIdx?: number): BuildNode {
    return {
      planeNum: -1,
      children: [null, null],
      bounds: createEmptyBounds3(),
      faces: [],
      isLeaf: true,
      contents,
      brushIndex: brushIdx
    };
  }

  private serializeTree(node: BuildNode): number {
    if (node.isLeaf) {
      const leafIndex = this.leafs.length;

      // Assign cluster: if empty (contents 0), new cluster. Else -1.
      const cluster = node.contents === 0 ? leafIndex : -1;

      // Leaf Lists
      // Populate lists
      const faces: number[] = [];
      const brushes: number[] = [];

      if (node.brushIndex !== undefined) {
        brushes.push(node.brushIndex);
      }

      // We need to find faces visible from this leaf.
      // This is hard to do here without knowing the parent context.
      // However, for convex chain:
      // The "Front" child (empty) sees the face on the node.
      // We can handle this by traversing parents or modifying buildConvexChain to inject faces into leaves.
      // Alternatively, traverse the tree AFTER building.

      // Let's defer population of faces.

      this.leafFacesList.push(faces);
      this.leafBrushesList.push(brushes);

      const leaf: BspLeaf = {
        contents: node.contents,
        cluster,
        area: 0,
        mins: [0, 0, 0],
        maxs: [0, 0, 0],
        firstLeafFace: 0, // Filled later by BspWriter logic or manual
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

      // IMPORTANT: Add this face to the FRONT child leaf's list?
      // For a convex brush node, the front child is the empty space outside the brush.
      // The face is on the boundary.
      // The front child (leaf) should include this face.
      // We need the LEAF index of the front child.
      // If front is negative, it's -(leafIndex + 1).

      if (front < 0) {
        const leafIdx = -(front + 1);
        this.leafFacesList[leafIdx].push(faceIdx);
      } else {
        // If front is a node, we should technically add to all leaves in that subtree?
        // For MVP with convex brushes, front is usually a leaf (empty space) immediately
        // unless we have split planes.
        // If we have split planes, the front child is a subtree.
        // We should add this face to all leaves in that subtree that touch the plane?
        // This gets complex.
        // For simple convex brushes, the structure is always Node -> Front: Leaf, Back: Node/Leaf.
        // So front is likely a leaf.
        this.addFaceToSubtree(front, faceIdx);
      }
    }
    const numFaces = this.faces.length - firstFace;

    const bspNode: BspNode = {
      planeIndex: planenum,
      children: [front, back],
      mins: [0, 0, 0],
      maxs: [0, 0, 0],
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

    // Check neighbors
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
    // Linear scan is slow. For MVP it's acceptable.
    // Optimization: Map<string, number> where key is `${min}_${max}`
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
