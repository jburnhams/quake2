/**
 * Procedural map generator for creating simple rooms with random colored surfaces.
 * Uses Quake 2 coordinate system: X forward, Y left, Z up.
 */

export interface ProceduralSurface {
  vertices: [number, number, number][];
  normal: [number, number, number];
  color: [number, number, number]; // RGB 0-1
  name: string;
}

export interface Pillar {
  x: number;
  y: number;
  halfSize: number;
  height: number;
}

export interface ProceduralRoom {
  width: number;
  depth: number;
  height: number;
  surfaces: ProceduralSurface[];
  pillars: Pillar[];
}

export interface RoomOptions {
  width: number;
  depth: number;
  height: number;
  wallThickness?: number;
  seed?: number;
}

// Simple seeded random for reproducible colors
class SeededRandom {
  private seed: number;

  constructor(seed: number = Date.now()) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  // Generate a vibrant random color
  nextColor(): [number, number, number] {
    // Use HSV with high saturation and value for vibrant colors
    const h = this.next();
    const s = 0.6 + this.next() * 0.4; // 0.6-1.0 saturation
    const v = 0.5 + this.next() * 0.5; // 0.5-1.0 value

    return hsvToRgb(h, s, v);
  }
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  let r = 0, g = 0, b = 0;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }

  return [r, g, b];
}

export function generateProceduralRoom(options: RoomOptions): ProceduralRoom {
  const {
    width,
    depth,
    height,
    seed = 42, // Default seed for reproducibility
  } = options;

  const rng = new SeededRandom(seed);
  const surfaces: ProceduralSurface[] = [];
  const pillars: Pillar[] = [];

  const halfWidth = width / 2;
  const halfDepth = depth / 2;

  // Floor (Z = 0, normal pointing up)
  surfaces.push({
    name: 'floor',
    vertices: [
      [-halfWidth, -halfDepth, 0],
      [halfWidth, -halfDepth, 0],
      [halfWidth, halfDepth, 0],
      [-halfWidth, halfDepth, 0],
    ],
    normal: [0, 0, 1],
    color: rng.nextColor(),
  });

  // Ceiling (Z = height, normal pointing down)
  surfaces.push({
    name: 'ceiling',
    vertices: [
      [-halfWidth, halfDepth, height],
      [halfWidth, halfDepth, height],
      [halfWidth, -halfDepth, height],
      [-halfWidth, -halfDepth, height],
    ],
    normal: [0, 0, -1],
    color: rng.nextColor(),
  });

  // Front wall (Y = -halfDepth, normal pointing +Y)
  surfaces.push({
    name: 'front_wall',
    vertices: [
      [-halfWidth, -halfDepth, 0],
      [-halfWidth, -halfDepth, height],
      [halfWidth, -halfDepth, height],
      [halfWidth, -halfDepth, 0],
    ],
    normal: [0, 1, 0],
    color: rng.nextColor(),
  });

  // Back wall (Y = halfDepth, normal pointing -Y)
  surfaces.push({
    name: 'back_wall',
    vertices: [
      [halfWidth, halfDepth, 0],
      [halfWidth, halfDepth, height],
      [-halfWidth, halfDepth, height],
      [-halfWidth, halfDepth, 0],
    ],
    normal: [0, -1, 0],
    color: rng.nextColor(),
  });

  // Left wall (X = -halfWidth, normal pointing +X)
  surfaces.push({
    name: 'left_wall',
    vertices: [
      [-halfWidth, halfDepth, 0],
      [-halfWidth, halfDepth, height],
      [-halfWidth, -halfDepth, height],
      [-halfWidth, -halfDepth, 0],
    ],
    normal: [1, 0, 0],
    color: rng.nextColor(),
  });

  // Right wall (X = halfWidth, normal pointing -X)
  surfaces.push({
    name: 'right_wall',
    vertices: [
      [halfWidth, -halfDepth, 0],
      [halfWidth, -halfDepth, height],
      [halfWidth, halfDepth, height],
      [halfWidth, halfDepth, 0],
    ],
    normal: [-1, 0, 0],
    color: rng.nextColor(),
  });

  // Add some interior pillars for visual interest
  const pillarCount = 4;
  const pillarSize = 32;
  const pillarHeight = height * 0.75;

  for (let i = 0; i < pillarCount; i++) {
    const angle = (i / pillarCount) * Math.PI * 2;
    const radius = Math.min(halfWidth, halfDepth) * 0.5;
    const px = Math.cos(angle) * radius;
    const py = Math.sin(angle) * radius;

    const halfPillar = pillarSize / 2;

    // Store pillar data for collision
    pillars.push({ x: px, y: py, halfSize: halfPillar, height: pillarHeight });

    // Pillar - 4 sides
    const pillarColor = rng.nextColor();

    // Front face
    surfaces.push({
      name: `pillar_${i}_front`,
      vertices: [
        [px - halfPillar, py - halfPillar, 0],
        [px - halfPillar, py - halfPillar, pillarHeight],
        [px + halfPillar, py - halfPillar, pillarHeight],
        [px + halfPillar, py - halfPillar, 0],
      ],
      normal: [0, -1, 0],
      color: pillarColor,
    });

    // Back face
    surfaces.push({
      name: `pillar_${i}_back`,
      vertices: [
        [px + halfPillar, py + halfPillar, 0],
        [px + halfPillar, py + halfPillar, pillarHeight],
        [px - halfPillar, py + halfPillar, pillarHeight],
        [px - halfPillar, py + halfPillar, 0],
      ],
      normal: [0, 1, 0],
      color: pillarColor,
    });

    // Left face
    surfaces.push({
      name: `pillar_${i}_left`,
      vertices: [
        [px - halfPillar, py + halfPillar, 0],
        [px - halfPillar, py + halfPillar, pillarHeight],
        [px - halfPillar, py - halfPillar, pillarHeight],
        [px - halfPillar, py - halfPillar, 0],
      ],
      normal: [-1, 0, 0],
      color: pillarColor,
    });

    // Right face
    surfaces.push({
      name: `pillar_${i}_right`,
      vertices: [
        [px + halfPillar, py - halfPillar, 0],
        [px + halfPillar, py - halfPillar, pillarHeight],
        [px + halfPillar, py + halfPillar, pillarHeight],
        [px + halfPillar, py + halfPillar, 0],
      ],
      normal: [1, 0, 0],
      color: pillarColor,
    });

    // Top face
    surfaces.push({
      name: `pillar_${i}_top`,
      vertices: [
        [px - halfPillar, py - halfPillar, pillarHeight],
        [px - halfPillar, py + halfPillar, pillarHeight],
        [px + halfPillar, py + halfPillar, pillarHeight],
        [px + halfPillar, py - halfPillar, pillarHeight],
      ],
      normal: [0, 0, 1],
      color: pillarColor,
    });
  }

  return {
    width,
    depth,
    height,
    surfaces,
    pillars,
  };
}

/**
 * Generate a simple test room for visual tests.
 * This creates a deterministic room that can be used for baseline comparisons.
 */
export function generateTestRoom(): ProceduralRoom {
  return generateProceduralRoom({
    width: 512,
    depth: 512,
    height: 256,
    seed: 12345, // Fixed seed for reproducibility
  });
}
