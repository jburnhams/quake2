/**
 * Differential tests: the TS map, alias model and sprite loaders against ref_gl's gl_model.c.
 *
 * Every .bsp, .md2 and .sp2 in the demo pak is loaded by both sides and compared field by field:
 * for maps the planes (with signbits), texinfo (with animation frame counts), faces (with
 * CalcSurfaceExtents' lightmap placement), leafs, nodes, submodels, leaf face lists and every
 * cluster's PVS row, plus Mod_PointInLeaf on random points. Header damage the C refuses must be
 * refused by the TS too.
 *
 * Uses the full demo pak0.pak when scripts/fetch-paks.sh has fetched it, else the repo's small pak.
 */
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { PakArchive, parseBsp, parseMd2, parseSprite, surfaceExtents, textureAnimationFrames, pointInLeaf, collisionModelFromBsp, type BspMap } from '@quake2ts/engine';
import { RandomGenerator } from '@quake2ts/shared';
import { BUILD_DIR, ORACLE_DIR, PAK_PATH, modelOracleBin, runOracleLines } from './oracle';

const FULL_PAK = resolve(ORACLE_DIR, '../.paks/baseq2/pak0.pak');
const PAK = existsSync(FULL_PAK) ? FULL_PAK : PAK_PATH;
const SEED = 0x60d1;
const LEAF_QUERIES = Number(process.env.ORACLE_LEAF_QUERIES ?? 20000);

interface Extracted {
  name: string;
  file: string;
  data: ArrayBuffer;
}

const f32 = Math.fround;

describe(`loaders match ref_gl gl_model.c (${PAK === FULL_PAK ? 'demo pak0' : 'repo pak'})`, () => {
  let bin: string;
  const files: Record<'bsp' | 'md2' | 'sp2', Extracted[]> = { bsp: [], md2: [], sp2: [] };

  beforeAll(() => {
    bin = modelOracleBin();
    const buf = readFileSync(PAK);
    const pak = PakArchive.fromArrayBuffer('pak', buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    const dir = join(BUILD_DIR, 'models');
    mkdirSync(dir, { recursive: true });
    for (const { name } of pak.listEntries()) {
      const ext = name.slice(-3).toLowerCase() as keyof typeof files;
      if (!(ext in files)) continue;
      const bytes = pak.readFile(name);
      const file = join(dir, name.replace(/[\\/]/g, '_'));
      writeFileSync(file, bytes);
      files[ext].push({ name, file, data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer });
    }
  });

  /** Collects differences as "section index field" lines, keeping the first few of each section. */
  function differ() {
    const counts = new Map<string, number>();
    const samples: string[] = [];
    return {
      check(section: string, index: number | string, ts: unknown, c: unknown) {
        // The C prints floats with 9 digits, which names one float exactly.
        const norm = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === 'number' && !Number.isInteger(x) ? Math.fround(x) : x));
        if (norm(ts) === norm(c)) return;
        counts.set(section, (counts.get(section) ?? 0) + 1);
        if (samples.length < 12) samples.push(`${section}[${index}] ts=${JSON.stringify(ts)} c=${JSON.stringify(c)}`);
      },
      summary: () => ({ count: [...counts.values()].reduce((a, b) => a + b, 0), text: `${[...counts].map(([k, v]) => `${k}: ${v}`).join(', ')}\n${samples.join('\n')}` }),
    };
  }

  it('maps', () => {
    expect(files.bsp.length).toBeGreaterThan(0);
    const answers = runOracleLines(bin, [], files.bsp.map((m) => `bsp ${m.file}`));
    const d = differ();
    files.bsp.forEach((m, mi) => {
      const c = answers[mi];
      expect(c.error, m.name).toBeUndefined();
      const map = parseBsp(m.data);
      const collision = collisionModelFromBsp(map);
      const at = (i: number) => `${m.name} ${i}`;
      map.planes.forEach((p, i) => d.check('plane', at(i), [...p.normal, p.dist, p.type, collision.planes[i].signbits], c.planes[i]));
      d.check('planes', m.name, map.planes.length, c.planes.length);
      map.texInfo.forEach((t, i) =>
        d.check('texinfo', at(i), [[...t.s, t.sOffset], [...t.t, t.tOffset], t.flags, t.nextTexInfo > 0 ? t.nextTexInfo : -1, textureAnimationFrames(map.texInfo, i), `textures/${t.texture}.wal`], c.texinfo[i]),
      );
      map.faces.forEach((face, i) => {
        const { textureMins, extents } = surfaceExtents(map, i);
        const flags = (face.side ? 2 : 0) | (map.texInfo[face.texInfo].flags & 0x8 ? 0x10 : 0);
        d.check('face', at(i), [face.planeIndex, flags, face.firstEdge, face.numEdges, face.texInfo, ...textureMins, ...extents, ...face.styles, face.lightOffset], c.faces[i]);
      });
      d.check('faces', m.name, map.faces.length, c.faces.length);
      let mark = 0;
      map.leafs.forEach((l, i) => {
        const cl = c.leafs[i];
        d.check('leaf', at(i), [l.contents, l.cluster, l.area, [...l.mins, ...l.maxs], l.firstLeafFace, l.numLeafFaces], cl.slice(0, 6));
        d.check('leaf faces', at(i), map.leafLists.leafFaces[i], c.marksurfaces.slice(cl[4], cl[4] + cl[5]));
        mark += l.numLeafFaces;
      });
      d.check('leafs', m.name, map.leafs.length, c.leafs.length);
      map.nodes.forEach((n, i) => d.check('node', at(i), [n.planeIndex, ...n.children, [...n.mins, ...n.maxs], n.firstFace, n.numFaces], c.nodes[i].slice(0, 6)));
      map.models.forEach((b, i) => {
        // Mod_LoadSubmodels spreads the bounds by a unit.
        const spread = (v: readonly number[], by: number) => v.map((x) => f32(x + by));
        d.check('submodel', at(i), [spread(b.mins, -1), spread(b.maxs, 1), [...b.origin], b.headNode, b.firstFace, b.numFaces], [c.submodels[i][0], c.submodels[i][1], c.submodels[i][2], ...c.submodels[i].slice(4)]);
      });
      d.check('counts', m.name, [map.edges.length, map.vertices.length, map.surfEdges.length], [c.edges, c.vertexes, c.surfedges]);
      const vis = map.visibility;
      d.check('clusters', m.name, vis?.numClusters ?? 0, c.numclusters);
      vis?.clusters.forEach((cl, i) => d.check('pvs', at(i), Buffer.from(cl.pvs.subarray(0, (vis.numClusters + 7) >> 3)).toString('hex'), c.pvs[i]));
      void mark;
    });
    const { count, text } = d.summary();
    expect(count, text).toBe(0);
  });

  it('point in leaf', () => {
    const rng = new RandomGenerator({ seed: SEED });
    const d = differ();
    for (const m of files.bsp) {
      const map: BspMap = parseBsp(m.data);
      const w = map.models[0];
      const points: [number, number, number][] = [];
      for (let i = 0; i < LEAF_QUERIES; i++) {
        // Half on whole units, where points land exactly on axial planes.
        const p = [0, 1, 2].map((k) => rng.frandomRange(w.mins[k], w.maxs[k])).map((x) => (i & 1 ? Math.round(x) : f32(x))) as [number, number, number];
        points.push(p);
      }
      const answers = runOracleLines(bin, [], [`bsp ${m.file}`, ...points.map((p) => `leaf ${p.join(' ')}`)]).slice(1);
      points.forEach((p, i) => d.check('leaf', `${m.name} ${p.join(' ')}`, pointInLeaf(map, p), answers[i].leaf));
    }
    const { count, text } = d.summary();
    expect(count, text).toBe(0);
  });

  /** The TS glcmds back in the file's int stream: count (negative for a fan), then s, t, index. */
  function glcmdInts(cmds: ReturnType<typeof parseMd2>['glCommands']): number[] {
    const out: number[] = [];
    const fv = new Float32Array(1);
    const iv = new Int32Array(fv.buffer);
    for (const cmd of cmds) {
      out.push(cmd.mode === 'strip' ? cmd.vertices.length : -cmd.vertices.length);
      for (const v of cmd.vertices) {
        fv[0] = v.s;
        out.push(iv[0]);
        fv[0] = v.t;
        out.push(iv[0]);
        out.push(v.vertexIndex);
      }
    }
    out.push(0);
    return out;
  }

  it('alias models', () => {
    expect(files.md2.length).toBeGreaterThan(0);
    const answers = runOracleLines(bin, [], files.md2.map((m) => `md2 ${m.file}`));
    const d = differ();
    files.md2.forEach((m, mi) => {
      const c = answers[mi];
      expect(c.error, m.name).toBeUndefined();
      const md2 = parseMd2(m.data);
      const h = md2.header;
      d.check('header', m.name, [h.skinWidth, h.skinHeight, h.frameSize, h.numSkins, h.numVertices, h.numTexCoords, h.numTriangles, h.numGlCommands, h.numFrames, h.offsetEnd, h.version], c.header);
      d.check('skins', m.name, md2.skins.map((s) => s.name), c.skins);
      d.check('st', m.name, md2.texCoords.flatMap((t) => [t.s, t.t]), c.st);
      d.check('tris', m.name, md2.triangles.flatMap((t) => [...t.vertexIndices, ...t.texCoordIndices]), c.tris);
      md2.frames.forEach((fr, i) => {
        const cf = c.frames[i];
        d.check('frame name', `${m.name} ${i}`, fr.name, cf.name);
        const bytes = Buffer.from(cf.verts, 'hex');
        fr.vertices.forEach((v, j) => {
          // The renderer's decompression (GL_LerpVerts at backlerp 0): translate + v * scale, in floats.
          const want = [0, 1, 2].map((k) => f32(cf.translate[k] + f32(bytes[j * 4 + k] * cf.scale[k])));
          const got = [v.position.x, v.position.y, v.position.z];
          if (want.some((x, k) => Math.abs(x - got[k]) > 1e-4)) d.check('vertex', `${m.name} ${i}.${j}`, got, want);
          d.check('normal', `${m.name} ${i}.${j}`, v.normalIndex, bytes[j * 4 + 3]);
        });
      });
      // The C keeps the stream as it is; the TS stops at the terminating 0.
      const ints = glcmdInts(md2.glCommands);
      d.check('glcmds', m.name, ints, c.glcmds.slice(0, ints.length));
    });
    const { count, text } = d.summary();
    expect(count, text).toBe(0);
  });

  it('sprites', () => {
    expect(files.sp2.length).toBeGreaterThan(0);
    const answers = runOracleLines(bin, [], files.sp2.map((m) => `sp2 ${m.file}`));
    const d = differ();
    files.sp2.forEach((m, i) => {
      expect(answers[i].error, m.name).toBeUndefined();
      d.check('sprite', m.name, parseSprite(m.data).frames.map((f) => [f.width, f.height, f.originX, f.originY, f.name]), answers[i].frames);
    });
    const { count, text } = d.summary();
    expect(count, text).toBe(0);
  });

  it('refuses the alias models the C refuses', () => {
    const base = files.md2[0];
    const view = (b: ArrayBuffer) => new DataView(b);
    // Header damage gl_model.c checks for: version, skin height, and empty or oversized counts.
    const damage: [string, (v: DataView) => void][] = [
      ['version', (v) => v.setInt32(4, 7, true)],
      ['skin height', (v) => v.setInt32(12, 481, true)],
      ['no vertices', (v) => v.setInt32(24, 0, true)],
      ['too many vertices', (v) => v.setInt32(24, 2049, true)],
      ['no st', (v) => v.setInt32(28, 0, true)],
      ['no triangles', (v) => v.setInt32(32, 0, true)],
      ['no frames', (v) => v.setInt32(40, 0, true)],
    ];
    const lines: string[] = [];
    const bufs = damage.map(([name, hurt]) => {
      const b = base.data.slice(0);
      hurt(view(b));
      const file = join(BUILD_DIR, 'models', `damaged_${name.replace(/ /g, '_')}.md2`);
      writeFileSync(file, new Uint8Array(b));
      lines.push(`md2 ${file}`);
      return b;
    });
    const answers = runOracleLines(bin, [], lines);
    const wrong: string[] = [];
    damage.forEach(([name], i) => {
      let tsRefused = false;
      try {
        parseMd2(bufs[i]);
      } catch {
        tsRefused = true;
      }
      if (tsRefused !== !!answers[i].error) wrong.push(`${name}: ts ${tsRefused ? 'refused' : 'loaded'}, c ${answers[i].error ? `refused (${answers[i].error})` : 'loaded'}`);
    });
    expect(wrong).toEqual([]);
  });
});
