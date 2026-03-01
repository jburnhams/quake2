import {
  type Vec3,
  CONTENTS_SOLID,
  createEmptyBounds3,
  windingBounds,
  windingCenter,
  addVec3,
  scaleVec3,
  createWinding,
  baseWindingForPlane,
  chopWindingByPlanes,
  splitWinding,
  copyWinding,
  dotVec3,
  crossVec3,
  normalizeVec3,
  subtractVec3,
  MAX_WORLD_COORD,
  windingPlane
} from '@quake2ts/shared';

import type { BrushDef, EntityDef, TextureDef } from '../builder/types.js';
import {
  type BspData,
  type BspPlane,
  type BspNode,
  type BspLeaf,
  type BspFace,
  type BspTexInfo,
  type BspModel,
  type BspBrush,
  type BspBrushSide,
  type BspEdge,
  type BspVisibility,
  type BspArea,
  type BspAreaPortal,
  BSP_VERSION
} from '../types/bsp.js';

import type { CompileBrush, CompileFace, CompilePlane, CompileSide, MapBrush } from '../types/compile.js';
import { PlaneSet } from './planes.js';
import { createBrushList, processCsg, addBoxBevels, updateBrushBounds } from './csg.js';
import { buildTree, flattenTree } from './tree.js';
import { extractFaces, assignFacesToNodes, mergeCoplanarFaces, fixTJunctions } from './faces.js';
import { buildEdges } from './edges.js';
import { generateTrivialVis, computeVisibility } from './vis.js';
import { generatePortals } from './portals.js';
import { serializeEntities } from '../output/entityString.js';

// Lighting logic (currently simple placeholders or partial implementations)
import { generateFullbrightLighting } from './lighting.js';

export interface CompilerOptions {
  verbose?: boolean;
  noVis?: boolean;
  noLighting?: boolean;
  preserveDetail?: boolean;
}

export interface CompileResult {
  bsp: BspData;
  stats: {
    planes: number;
    nodes: number;
    leafs: number;
    faces: number;
    brushes: number;
    edges: number;
    vertices: number;
  };
}

class TexInfoManager {
  private texInfos: BspTexInfo[] = [];
  private lookup = new Map<string, number>();

  getTexInfos(): BspTexInfo[] {
    return this.texInfos;
  }

  findOrAdd(texture: TextureDef, normal: Vec3): number {
    const scaleX = texture.scaleX || 1;
    const scaleY = texture.scaleY || 1;

    // Calculate base S and T vectors based on face normal
    // Quake mapping heuristics:
    let baseS: Vec3;
    let baseT: Vec3;

    const absX = Math.abs(normal.x);
    const absY = Math.abs(normal.y);
    const absZ = Math.abs(normal.z);

    if (absZ >= absX && absZ >= absY) {
      // Z is dominant: Project onto XY plane
      baseS = { x: 1, y: 0, z: 0 };
      baseT = { x: 0, y: -1, z: 0 };
    } else if (absX >= absY && absX >= absZ) {
      // X is dominant: Project onto YZ plane
      baseS = { x: 0, y: 1, z: 0 };
      baseT = { x: 0, y: 0, z: -1 };
    } else {
      // Y is dominant: Project onto XZ plane
      baseS = { x: 1, y: 0, z: 0 };
      baseT = { x: 0, y: 0, z: -1 };
    }

    const s = scaleVec3(baseS, 1 / scaleX);
    const t = scaleVec3(baseT, 1 / scaleY);

    // Include the generated vectors in the lookup key so orientation matters
    const key = `${texture.name}_${texture.offsetX}_${texture.offsetY}_${texture.rotation}_${texture.scaleX}_${texture.scaleY}_${s.x},${s.y},${s.z}_${t.x},${t.y},${t.z}`;

    if (this.lookup.has(key)) {
      return this.lookup.get(key)!;
    }

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

export class BspCompiler {
  private planeSet = new PlaneSet();
  private texInfoManager = new TexInfoManager();

  // Internal state
  private compileBrushes: CompileBrush[] = [];
  private mapBrushes: MapBrush[] = [];

  constructor(
    private options: CompilerOptions = {}
  ) {}

  compile(
    inputBrushes: BrushDef[],
    inputEntities: EntityDef[]
  ): CompileResult {
    // 1. Prepare Brushes
    this.prepareBrushes(inputBrushes);

    // 2. CSG Operations
    if (this.options.verbose) console.log('Processing CSG...');
    const csgBrushes = processCsg(
      this.compileBrushes,
      this.planeSet,
      {
        preserveDetail: this.options.preserveDetail,
        verbose: this.options.verbose
      }
    );

    // 3. Build BSP Tree
    if (this.options.verbose) console.log('Building BSP Tree...');
    const root = buildTree(csgBrushes, this.planeSet, new Set());

    // 4. Extract Faces
    if (this.options.verbose) console.log('Extracting Faces...');
    let faces = extractFaces(root, this.planeSet.getPlanes());

    // 5. Merge Faces
    if (this.options.verbose) console.log('Merging Faces...');
    faces = mergeCoplanarFaces(faces);

    // 6. Fix T-Junctions
    if (this.options.verbose) console.log('Fixing T-Junctions...');
    faces = fixTJunctions(faces);

    // 7. Assign Faces to Nodes
    if (this.options.verbose) console.log('Assigning Faces to Nodes...');
    const faceMap = assignFacesToNodes(faces, root, this.planeSet.getPlanes());

    // 8. Flatten Tree / Generate Models
    if (this.options.verbose) console.log('Flattening Tree...');
    const flattened = flattenTree(root, faceMap);

    // 9. Build Edges & Vertices
    if (this.options.verbose) console.log('Building Edges...');
    const edgeData = buildEdges(flattened.serializedFaces);

    // 10. Generate Output Data
    const planes = this.planeSet.getPlanes().map(p => ({
      normal: p.normal,
      dist: p.dist,
      type: p.type
    }));

    // Generate BspBrush and BspBrushSide lumps
    const bspBrushes: BspBrush[] = [];
    const bspBrushSides: BspBrushSide[] = [];

    for (const mapBrush of this.mapBrushes) {
      const firstSide = bspBrushSides.length;
      let numSides = 0;

      for (const side of mapBrush.sides) {
        bspBrushSides.push({
          planeIndex: side.planeNum,
          texInfo: side.texInfo
        });
        numSides++;
      }

      bspBrushes.push({
        firstSide,
        numSides,
        contents: mapBrush.contents
      });
    }

    // Update BspFaces with edge indices
    const faceMetadata: { firstEdge: number, numEdges: number }[] = [];
    let currentEdgeOffset = 0;

    for (const f of flattened.serializedFaces) {
      const num = f.winding.numPoints;
      faceMetadata.push({ firstEdge: currentEdgeOffset, numEdges: num });
      currentEdgeOffset += num;
    }

    const finalFaces: BspFace[] = flattened.serializedFaces.map((f, i) => {
      const meta = faceMetadata[i];
      const facePlane = planes[f.planeNum];
      const faceWindingPlane = windingPlane(f.winding);
      const side = dotVec3(faceWindingPlane.normal, facePlane.normal) > 0.99 ? 0 : 1;

      return {
        planeIndex: f.planeNum,
        side: side,
        firstEdge: meta.firstEdge,
        numEdges: meta.numEdges,
        texInfo: f.texInfo,
        styles: [0, 0, 0, 0],
        lightOffset: -1
      };
    });

    // 11. Lighting
    // Explicitly cast to Uint8Array to avoid ArrayBuffer mismatch in older TS/Node envs
    let lightMaps = new Uint8Array(0) as Uint8Array;
    if (!this.options.noLighting) {
      if (this.options.verbose) console.log('Generating Lighting...');
      lightMaps = generateFullbrightLighting(
          finalFaces,
          edgeData.vertices,
          this.texInfoManager.getTexInfos(),
          edgeData.surfEdges,
          edgeData.edges,
          planes
      ) as Uint8Array;
    }

    // 12. Visibility
    if (this.options.verbose) console.log('Generating Visibility...');
    let maxCluster = -1;
    for (const l of flattened.leafs) {
      if (l.cluster > maxCluster) maxCluster = l.cluster;
    }

    let visibility: import('../types/bsp.js').BspVisibility | undefined = undefined;

    if (this.options.noVis || maxCluster < 0) {
      visibility = generateTrivialVis(maxCluster + 1);
    } else {
      const portals = generatePortals(
        root,
        this.planeSet.getPlanes(),
        flattened.nodes[0]?.mins ? { x: flattened.nodes[0].mins[0], y: flattened.nodes[0].mins[1], z: flattened.nodes[0].mins[2] } : { x: -4096, y: -4096, z: -4096 },
        flattened.nodes[0]?.maxs ? { x: flattened.nodes[0].maxs[0], y: flattened.nodes[0].maxs[1], z: flattened.nodes[0].maxs[2] } : { x: 4096, y: 4096, z: 4096 }
      );

      // Use standard tree leaves if we have them instead of flattened when calling vis
      const activeLeafs: import('./tree.js').TreeLeaf[] = [];
      const stack: import('./tree.js').TreeElement[] = [root];
      const isLeaf = (n: any): n is import('./tree.js').TreeLeaf => !('planeNum' in n);
      while (stack.length > 0) {
        const node = stack.pop()!;
        if (isLeaf(node)) {
          activeLeafs.push(node);
        } else {
          stack.push(node.children[0]);
          stack.push(node.children[1]);
        }
      }

      try {
        visibility = computeVisibility(portals, activeLeafs, {
          fast: true, // For MVP we default to fast flood fill
          onProgress: this.options.verbose ? (p) => console.log(`VIS Progress: ${(p * 100).toFixed(1)}%`) : undefined
        });
      } catch (err) {
        if (this.options.verbose) console.warn('VIS computation failed:', err);
        throw err;
      }
    }

    // 13. Entities
    const entityString = serializeEntities(inputEntities);

    // 14. Assemble BSP
    const bsp: BspData = {
      header: { version: BSP_VERSION, lumps: new Map() },
      entities: { raw: entityString },
      planes,
      vertices: edgeData.vertices,
      nodes: flattened.nodes,
      texInfo: this.texInfoManager.getTexInfos(),
      faces: finalFaces,
      lightMaps,
      lightMapInfo: [],
      leafs: flattened.leafs,
      leafLists: {
        leafFaces: flattened.leafFacesList,
        leafBrushes: flattened.leafBrushesList
      },
      edges: edgeData.edges,
      surfEdges: edgeData.surfEdges, // Int32Array
      models: [{
        mins: flattened.nodes[0]?.mins ? {
            x: flattened.nodes[0].mins[0],
            y: flattened.nodes[0].mins[1],
            z: flattened.nodes[0].mins[2]
        } : {x:0, y:0, z:0},
        maxs: flattened.nodes[0]?.maxs ? {
            x: flattened.nodes[0].maxs[0],
            y: flattened.nodes[0].maxs[1],
            z: flattened.nodes[0].maxs[2]
        } : {x:0, y:0, z:0},
        origin: { x: 0, y: 0, z: 0 },
        headNode: 0,
        firstFace: 0,
        numFaces: finalFaces.length
      }], // Model 0
      brushes: bspBrushes,
      brushSides: bspBrushSides,
      visibility,
      areas: [],
      areaPortals: []
    };

    return {
      bsp,
      stats: {
        planes: planes.length,
        nodes: flattened.nodes.length,
        leafs: flattened.leafs.length,
        faces: finalFaces.length,
        brushes: bspBrushes.length,
        edges: edgeData.edges.length,
        vertices: edgeData.vertices.length
      }
    };
  }

  private prepareBrushes(inputBrushes: BrushDef[]) {
    // Clear previous state
    this.compileBrushes = [];
    this.mapBrushes = [];

    for (const def of inputBrushes) {
      const sides: CompileSide[] = [];
      const brushPlanes: { normal: Vec3; dist: number }[] = [];

      for (const sideDef of def.sides) {
        const planeNum = this.planeSet.findOrAdd(sideDef.plane.normal, sideDef.plane.dist);
        const texInfo = this.texInfoManager.findOrAdd(sideDef.texture, sideDef.plane.normal);

        brushPlanes.push({ normal: sideDef.plane.normal, dist: sideDef.plane.dist });

        sides.push({
          planeNum,
          texInfo,
          visible: true,
          tested: false,
          bevel: false,
          winding: undefined
        });
      }

      for (let i = 0; i < sides.length; i++) {
        const side = sides[i];
        const plane = brushPlanes[i];

        let w: import('@quake2ts/shared').Winding | null = baseWindingForPlane(plane.normal, plane.dist);

        for (let j = 0; j < brushPlanes.length; j++) {
          if (i === j) continue;
          if (!w) break;
          const clipPlane = brushPlanes[j];
          const split = splitWinding(w, clipPlane.normal, clipPlane.dist);
          w = split.back;
        }

        if (w) {
          side.winding = w;
        } else {
          side.visible = false;
        }
      }

      const mapBrush: MapBrush = {
        entityNum: 0, // Default worldspawn
        brushNum: this.mapBrushes.length,
        original: def, // Assigned matching type change
        sides,
        contents: def.contents ?? CONTENTS_SOLID,
        bounds: createEmptyBounds3()
      };

      const compileBrush: CompileBrush = {
        original: mapBrush,
        sides,
        bounds: createEmptyBounds3(),
        next: null
      };

      updateBrushBounds(compileBrush);
      mapBrush.bounds = compileBrush.bounds;

      addBoxBevels(compileBrush, this.planeSet);

      this.compileBrushes.push(compileBrush);
      this.mapBrushes.push(mapBrush);
    }
  }
}
