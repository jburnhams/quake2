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
  MAX_WORLD_COORD
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
import { generateTrivialVis } from './vis.js';
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

  findOrAdd(texture: TextureDef): number {
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

    // Update BspFaces with edge indices
    // We first calculate face metadata to determine firstEdge/numEdges
    const faceMetadata: { firstEdge: number, numEdges: number }[] = [];
    let currentEdgeOffset = 0;

    for (const f of flattened.serializedFaces) {
      const num = f.winding.numPoints;
      faceMetadata.push({ firstEdge: currentEdgeOffset, numEdges: num });
      currentEdgeOffset += num;
    }

    const finalFaces: BspFace[] = flattened.serializedFaces.map((f, i) => {
      const meta = faceMetadata[i];
      return {
        planeIndex: f.planeNum,
        side: f.side || 0,
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
    const visibility = generateTrivialVis(maxCluster + 1);

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
      brushes: [], // TODO: Populate brushes
      brushSides: [], // TODO: Populate brushSides
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
        brushes: 0,
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
        const texInfo = this.texInfoManager.findOrAdd(sideDef.texture);

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
