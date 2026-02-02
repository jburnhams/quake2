import {
  type Vec3,
  crossVec3,
  dotVec3,
  normalizeVec3,
  subtractVec3,
  lengthVec3
} from '@quake2ts/shared';
import { MapTokenizer, TokenType } from './tokenizer.js';

export interface MapBrushSideDef {
  /** Three points defining the plane (counter-clockwise when viewed from front) */
  planePoints: [Vec3, Vec3, Vec3];

  /** Texture name */
  texture: string;

  /** Texture coordinates (standard format) */
  offsetX: number;
  offsetY: number;
  rotation: number;
  scaleX: number;
  scaleY: number;

  /** Valve 220 UV axes (if mapversion >= 220) */
  uAxis?: Vec3;
  uOffset?: number;
  vAxis?: Vec3;
  vOffset?: number;

  /** Surface properties (optional) */
  contents?: number;
  surfaceFlags?: number;
  value?: number;

  line: number;
}

export interface MapBrushDef {
  sides: MapBrushSideDef[];
  line: number;
}

/**
 * Calculates a plane normal and distance from three points.
 * Matches Quake 2's winding plane calculation (effectively p2-p1 x p3-p1 logic).
 */
export function planeFromPoints(p1: Vec3, p2: Vec3, p3: Vec3): { normal: Vec3; dist: number } | null {
  const v1 = subtractVec3(p2, p1);
  const v2 = subtractVec3(p3, p1);
  // Quake 2 tools (windingPlane) uses d2 x d1 for CW winding normal.
  // Here we use v2 x v1 equivalent to match that direction.
  const normal = crossVec3(v2, v1);

  if (lengthVec3(normal) === 0) return null;
  const n = normalizeVec3(normal);
  const d = dotVec3(p1, n);
  return { normal: n, dist: d };
}

function parseVec3(tokenizer: MapTokenizer): Vec3 {
  tokenizer.expect(TokenType.OPEN_PAREN);
  const x = Number(tokenizer.expect(TokenType.NUMBER).value);
  const y = Number(tokenizer.expect(TokenType.NUMBER).value);
  const z = Number(tokenizer.expect(TokenType.NUMBER).value);
  tokenizer.expect(TokenType.CLOSE_PAREN);
  return { x, y, z };
}

export function parseBrushSide(
  tokenizer: MapTokenizer,
  mapVersion: number
): MapBrushSideDef {
  const line = tokenizer.line;

  // 1. Parse three points: ( x y z ) ( x y z ) ( x y z )
  const p1 = parseVec3(tokenizer);
  const p2 = parseVec3(tokenizer);
  const p3 = parseVec3(tokenizer);

  // 2. Parse texture name
  // Texture can be a STRING token (quoted or unquoted)
  // But wait, the tokenizer might return NUMBER if it looks like one (e.g. "3_tex" maybe parsed as NUMBER? No, my tokenizer logic handles that).
  // But strictly, texture IS a string.
  const texToken = tokenizer.next();
  // Ensure it's a string or number (sometimes textures are just numbers like '1')
  if (texToken.type !== TokenType.STRING && texToken.type !== TokenType.NUMBER) {
     throw new Error(`Expected texture name at line ${texToken.line}, got ${TokenType[texToken.type]}`);
  }
  const texture = texToken.value;

  // 3. Parse Texture Coordinates
  let uAxis: Vec3 | undefined;
  let uOffset: number | undefined;
  let vAxis: Vec3 | undefined;
  let vOffset: number | undefined;

  let offsetX = 0;
  let offsetY = 0;
  let rotation = 0;
  let scaleX = 1;
  let scaleY = 1;

  // Check for Valve 220 format: starts with '['
  const nextToken = tokenizer.peek();
  if (nextToken.type === TokenType.OPEN_BRACKET) {
    // Valve 220
    tokenizer.next(); // [
    const ux = Number(tokenizer.expect(TokenType.NUMBER).value);
    const uy = Number(tokenizer.expect(TokenType.NUMBER).value);
    const uz = Number(tokenizer.expect(TokenType.NUMBER).value);
    const uOff = Number(tokenizer.expect(TokenType.NUMBER).value);
    tokenizer.expect(TokenType.CLOSE_BRACKET); // ]

    tokenizer.expect(TokenType.OPEN_BRACKET); // [
    const vx = Number(tokenizer.expect(TokenType.NUMBER).value);
    const vy = Number(tokenizer.expect(TokenType.NUMBER).value);
    const vz = Number(tokenizer.expect(TokenType.NUMBER).value);
    const vOff = Number(tokenizer.expect(TokenType.NUMBER).value);
    tokenizer.expect(TokenType.CLOSE_BRACKET); // ]

    uAxis = { x: ux, y: uy, z: uz };
    uOffset = uOff;
    vAxis = { x: vx, y: vy, z: vz };
    vOffset = vOff;

    // Rotation, ScaleX, ScaleY still follow
    rotation = Number(tokenizer.expect(TokenType.NUMBER).value);
    scaleX = Number(tokenizer.expect(TokenType.NUMBER).value);
    scaleY = Number(tokenizer.expect(TokenType.NUMBER).value);
  } else {
    // Standard format: offX offY rot scaleX scaleY
    offsetX = Number(tokenizer.expect(TokenType.NUMBER).value);
    offsetY = Number(tokenizer.expect(TokenType.NUMBER).value);
    rotation = Number(tokenizer.expect(TokenType.NUMBER).value);
    scaleX = Number(tokenizer.expect(TokenType.NUMBER).value);
    scaleY = Number(tokenizer.expect(TokenType.NUMBER).value);
  }

  // 4. Optional: Contents, SurfaceFlags, Value
  let contents: number | undefined;
  let surfaceFlags: number | undefined;
  let value: number | undefined;

  // While next token is NUMBER, consume it.
  // There can be 0, 1, 2, or 3 numbers.
  // Wait, if it's the start of next brush side, it would be '('.
  // So we peek.

  if (tokenizer.peek().type === TokenType.NUMBER) {
     contents = Number(tokenizer.next().value);

     if (tokenizer.peek().type === TokenType.NUMBER) {
        surfaceFlags = Number(tokenizer.next().value);

        if (tokenizer.peek().type === TokenType.NUMBER) {
           value = Number(tokenizer.next().value);
        }
     }
  }

  return {
    planePoints: [p1, p2, p3],
    texture,
    offsetX,
    offsetY,
    rotation,
    scaleX,
    scaleY,
    uAxis,
    uOffset,
    vAxis,
    vOffset,
    contents,
    surfaceFlags,
    value,
    line
  };
}

/**
 * Parses a brush definition from the map file.
 */
export function parseBrush(
  tokenizer: MapTokenizer,
  mapVersion: number
): MapBrushDef {
  const line = tokenizer.line;
  // Note: We assume the opening '{' has already been consumed by the caller (parseEntity)

  const sides: MapBrushSideDef[] = [];

  while (true) {
    const token = tokenizer.peek();

    if (token.type === TokenType.CLOSE_BRACE) {
      tokenizer.next(); // consume '}'
      break;
    }

    if (token.type === TokenType.EOF) {
       throw new Error(`Unexpected EOF while parsing brush starting at line ${line}`);
    }

    // Parse brush side
    const side = parseBrushSide(tokenizer, mapVersion);
    sides.push(side);
  }

  return {
    sides,
    line
  };
}
