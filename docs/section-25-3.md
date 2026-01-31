# Section 25-3: Map Parser

## Overview

Implement a parser for the Quake 2 `.map` file format. This is a text-based format exported by level editors (Trenchbroom, Radiant, etc.).

**Estimated Tasks**: 14
**Dependencies**: Section 25-1 (types)
**Can Parallelize With**: Section 25-2 (Winding), Section 25-4 (Primitives)

---

## 1. Map File Format

### 1.1 Format Overview

The `.map` format is hierarchical:
```
{                           // Entity 0 (worldspawn)
  "classname" "worldspawn"
  "message" "My Map"
  {                         // Brush 0
    ( x1 y1 z1 ) ( x2 y2 z2 ) ( x3 y3 z3 ) texture offX offY rot scX scY [contents surface value]
    ( ... ) ( ... ) ( ... ) texture ...
    ...
  }
  {                         // Brush 1
    ...
  }
}
{                           // Entity 1
  "classname" "info_player_start"
  "origin" "256 256 32"
}
```

**Reference**: `q2tools/src/map.c` lines 800-900 (`ParseMapEntity`, `ParseBrush`)

### 1.2 Texture Coordinate Formats

Two formats supported:

**Standard (mapversion < 220):**
```
( p1 ) ( p2 ) ( p3 ) texture offsetX offsetY rotation scaleX scaleY
```

**Valve 220 (mapversion >= 220):**
```
( p1 ) ( p2 ) ( p3 ) texture [ ux uy uz uOffset ] [ vx vy vz vOffset ] rotation scaleX scaleY
```

**Reference**: `q2tools/src/map.c` lines 560-600 (texture parsing)

---

## 2. Tokenizer

### 2.1 Token Types

- [x] Create `src/parser/tokenizer.ts`

**File: `src/parser/tokenizer.ts`**
```typescript
export enum TokenType {
  STRING,       // "quoted string" or unquoted_word
  NUMBER,       // 123 or -45.67
  OPEN_BRACE,   // {
  CLOSE_BRACE,  // }
  OPEN_PAREN,   // (
  CLOSE_PAREN,  // )
  OPEN_BRACKET, // [
  CLOSE_BRACKET,// ]
  EOF,
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

export class MapTokenizer {
  constructor(source: string);

  peek(): Token;
  next(): Token;
  expect(type: TokenType): Token;
  expectValue(value: string): void;
  isAtEnd(): boolean;

  // Current position for error reporting
  get line(): number;
  get column(): number;
}
```

**Reference**: `q2tools/src/scriplib.c` (general tokenizer used by map.c)

### 2.2 Tokenizer Implementation

- [x] Implement whitespace/comment skipping
- [x] Implement string parsing (quoted and unquoted)
- [x] Implement number parsing
- [x] Implement punctuation tokens

**Whitespace/Comments:**
```typescript
// Skip whitespace and // comments
private skipWhitespaceAndComments(): void;
```

### 2.3 Tests

- [x] Test: Tokenize empty string → EOF
- [x] Test: Tokenize `{ }` → OPEN_BRACE, CLOSE_BRACE, EOF
- [x] Test: Tokenize `"hello"` → STRING("hello")
- [x] Test: Tokenize `123.45` → NUMBER("123.45")
- [x] Test: Tokenize with comments skipped
- [x] Test: Line/column tracking correct

---

## 3. Entity Parser

### 3.1 Entity Key-Value Pairs

- [ ] Create `src/parser/entityParser.ts`
- [ ] Implement `parseKeyValue(tokenizer): { key: string, value: string }`

**File: `src/parser/entityParser.ts`**
```typescript
export interface MapEntityDef {
  classname: string;
  properties: Map<string, string>;
  brushes: MapBrushDef[];
  line: number;  // For error reporting
}

export function parseKeyValue(tokenizer: MapTokenizer): { key: string; value: string };
```

**Reference**: `q2tools/src/map.c` lines 453-485 (`ParseEpair`)

### 3.2 Entity Parsing

- [ ] Implement `parseEntity(tokenizer): MapEntityDef`

**Signature:**
```typescript
export function parseEntity(tokenizer: MapTokenizer): MapEntityDef;
```

**Algorithm:**
1. Expect `{`
2. Loop until `}`:
   - If next is `{`, parse brush
   - Else parse key-value pair
3. Extract `classname` from properties
4. Handle special keys (`mapversion`, `origin`)

**Reference**: `q2tools/src/map.c` lines 800-880 (`ParseMapEntity`)

### 3.3 Tests

- [ ] Test: Parse entity with only properties
- [ ] Test: Parse entity with brushes
- [ ] Test: Extract classname correctly
- [ ] Test: Parse origin into Vec3

---

## 4. Brush Parser

### 4.1 Brush Side (Face) Parsing

- [ ] Create `src/parser/brushParser.ts`
- [ ] Implement `parseBrushSide(tokenizer, mapVersion): MapBrushSideDef`

**File: `src/parser/brushParser.ts`**
```typescript
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

export function parseBrushSide(
  tokenizer: MapTokenizer,
  mapVersion: number
): MapBrushSideDef;
```

**Algorithm:**
1. Parse three `( x y z )` point definitions
2. Parse texture name
3. If mapversion >= 220, parse `[ ux uy uz offset ]` for U and V
4. Parse rotation, scaleX, scaleY
5. Optionally parse contents/surface/value

**Reference**: `q2tools/src/map.c` lines 527-650 (brush side parsing)

### 4.2 Plane from Three Points

- [ ] Implement `planeFromPoints(p1: Vec3, p2: Vec3, p3: Vec3): { normal: Vec3, dist: number }`

**Signature:**
```typescript
export function planeFromPoints(
  p1: Vec3,
  p2: Vec3,
  p3: Vec3
): { normal: Vec3; dist: number } | null;  // null if degenerate
```

**Algorithm:**
1. `v1 = p2 - p1`
2. `v2 = p3 - p1`
3. `normal = normalize(cross(v1, v2))`
4. `dist = dot(normal, p1)`

**Reference**: `q2tools/src/map.c` lines 260-280 (`PlaneFromPoints`)

### 4.3 Brush Parsing

- [ ] Implement `parseBrush(tokenizer, mapVersion): MapBrushDef`

**File: `src/parser/brushParser.ts`**
```typescript
export interface MapBrushDef {
  sides: MapBrushSideDef[];
  line: number;
}

export function parseBrush(
  tokenizer: MapTokenizer,
  mapVersion: number
): MapBrushDef;
```

**Reference**: `q2tools/src/map.c` lines 492-700 (`ParseBrush`)

### 4.4 Tests

- [ ] Test: Parse simple 6-sided box brush
- [ ] Test: Parse brush with angled faces
- [ ] Test: Parse Valve 220 format UV axes
- [ ] Test: Parse optional surface flags
- [ ] Test: planeFromPoints produces correct plane
- [ ] Test: Degenerate points (collinear) returns null

---

## 5. Main Parser

### 5.1 MapParser Class

- [ ] Create `src/parser/mapParser.ts`
- [ ] Implement main `MapParser` class

**File: `src/parser/mapParser.ts`**
```typescript
export interface ParsedMap {
  entities: MapEntityDef[];
  worldspawn: MapEntityDef;  // Convenience reference to entity 0
  mapVersion: number;
}

export interface ParseOptions {
  /** Strict mode fails on warnings, lenient mode continues */
  strict?: boolean;

  /** Callback for warnings */
  onWarning?: (message: string, line: number) => void;
}

export interface ParseError {
  message: string;
  line: number;
  column: number;
}

export class MapParser {
  /**
   * Parse a .map file from string content
   */
  static parse(content: string, options?: ParseOptions): ParsedMap;

  /**
   * Validate a parsed map for common issues
   */
  static validate(map: ParsedMap): ValidationResult;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
```

### 5.2 Parsing Implementation

- [ ] Implement `MapParser.parse()`

**Algorithm:**
1. Create tokenizer
2. Loop until EOF:
   - Parse entity
   - Add to entities list
3. Validate worldspawn exists (entity 0, classname "worldspawn")
4. Extract mapversion from worldspawn properties

**Reference**: `q2tools/src/map.c` lines 910-950 (`LoadMapFile`)

### 5.3 Validation

- [ ] Implement `MapParser.validate()`

**Checks:**
- Worldspawn exists
- All brushes have >= 4 sides
- All planes are valid (non-degenerate)
- No duplicate planes in a brush
- Brush forms closed convex volume

### 5.4 Tests

- [ ] Test: Parse minimal valid map (worldspawn only)
- [ ] Test: Parse map with player start
- [ ] Test: Parse map with brushes
- [ ] Test: Error on missing worldspawn
- [ ] Test: Error on invalid brush (< 4 sides)
- [ ] Test: Warning on unusual but valid constructs

---

## 6. Error Handling

### 6.1 Parse Errors

- [ ] Create custom error class with location info

**File: `src/parser/errors.ts`**
```typescript
export class MapParseError extends Error {
  constructor(
    message: string,
    public readonly line: number,
    public readonly column: number,
    public readonly source?: string
  ) {
    super(`Line ${line}, column ${column}: ${message}`);
    this.name = 'MapParseError';
  }
}
```

### 6.2 Error Recovery

- [ ] Implement optional error recovery (skip malformed brush, continue)

---

## 7. Integration with Builder

### 7.1 MapData to Builder Conversion

- [ ] Implement conversion from parsed map to builder format

**File: `src/parser/mapToBuilder.ts`**
```typescript
import type { ParsedMap } from './mapParser';
import type { BspBuilder } from '../builder/BspBuilder';

/**
 * Convert parsed map data to BspBuilder calls
 */
export function mapToBuilder(map: ParsedMap, builder: BspBuilder): void;
```

This bridges the parser (text → data) with the compiler (data → BSP).

---

## 8. WASM Verification

### 8.1 Reference Comparison

- [ ] Create test that parses map, compiles with both TS and WASM
- [ ] Compare intermediate structures (brush counts, plane counts)

**Test Cases:**
1. Parse simple box map → verify brush/plane counts match
2. Parse corridor map → verify entity extraction matches
3. Parse with Valve 220 format → verify texture coords match

---

## Verification Checklist

- [ ] Tokenizer handles all token types
- [ ] Entity parser extracts all properties
- [ ] Brush parser handles both texture formats
- [ ] planeFromPoints matches q2tools output
- [ ] Full maps parse without errors
- [ ] Validation catches common errors
- [ ] Error messages include line numbers
- [ ] WASM comparison tests pass
