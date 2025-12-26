# Quake2TS Monorepo Build Configuration Review

## Executive Summary

The current build setup has **significant issues with dependency bundling** that violate npm library best practices. Every package is creating "fat bundles" with `noExternal`, causing massive code duplication and preventing proper dependency resolution in consuming applications.

### Critical Issues

1. **❌ Library packages bundling dependencies**: All packages use `noExternal` for ESM/CJS builds
2. **❌ Code duplication**: `@quake2ts/shared` is bundled into every package
3. **❌ Missing peerDependencies**: Workspace dependencies aren't declared as peers
4. **❌ Duplicated build configs**: 6 nearly identical `tsup.config.ts` files
5. **❌ Inconsistent patterns**: cgame uses different approach than other packages

---

## Current State Analysis

### Package Types

**Library Packages** (should be published as libraries):
- `@quake2ts/shared` - Foundation utilities
- `@quake2ts/engine` - Game engine core
- `@quake2ts/game` - Game logic
- `@quake2ts/tools` - Development tools
- `@quake2ts/server` - Server runtime
- `@quake2ts/cgame` - Client game module (currently private)

**Application Packages** (end-user applications):
- `@quake2ts/client` - Full client bundle
- `quake2ts` (root) - Could be a convenience bundle

**Testing Packages**:
- `@quake2ts/test-utils` - Shared test utilities (correctly configured!)
- `@quake2ts/e2e-tests` - Test-only, not published

### Current Bundling Strategy (PROBLEMATIC)

**Example: @quake2ts/engine**
```typescript
// tsup.config.ts
{
  format: ['esm'],
  noExternal: ['@quake2ts/shared']  // ❌ Bundles shared into engine
}
```

**Example: @quake2ts/client**
```typescript
{
  format: ['esm'],
  noExternal: ['@quake2ts/shared', '@quake2ts/engine', '@quake2ts/game', '@quake2ts/cgame']
  // ❌ Bundles everything, even for ESM/CJS builds
}
```

**Result**:
- Engine bundle contains shared code
- Game bundle contains shared + engine code
- Client bundle contains shared + engine + game + cgame code
- Massive duplication across packages

---

## Best Practices for Library Packaging

### The Golden Rules

1. **Library packages should NOT bundle dependencies** in ESM/CJS builds
2. **Only bundle for browser IIFE** (standalone usage)
3. **Use peerDependencies** for workspace packages
4. **Use dependencies** for required external packages
5. **Support tree-shaking** via ESM exports

### Module Format Guidelines

#### ESM/CJS Builds (for npm publishing)
```typescript
{
  format: ['esm', 'cjs'],
  external: [/.*/],  // Keep ALL dependencies external
  // Or be explicit:
  external: ['@quake2ts/*', 'gl-matrix', 'ws', ...]
}
```

**Why?**
- Prevents code duplication
- Allows consumers to choose bundler/version
- Enables tree-shaking
- Proper dependency resolution
- Smaller package sizes

#### Browser IIFE (for CDN/standalone)
```typescript
{
  format: ['iife'],
  noExternal: [/.*/],  // Bundle EVERYTHING
  minify: true,
  platform: 'browser'
}
```

**Why?**
- Self-contained for `<script>` tag usage
- No dependency management needed
- Optimized for CDN delivery

---

## Recommended Architecture

### Package Structure

```
@quake2ts/shared (foundation)
  ├─ ESM/CJS: No dependencies bundled
  ├─ Browser IIFE: Self-contained bundle
  └─ Types: dist/types/

@quake2ts/engine (depends on shared)
  ├─ ESM/CJS: shared as peerDependency (external)
  ├─ Browser IIFE: Bundles shared + engine
  └─ Types: dist/types/

@quake2ts/game (depends on engine, shared)
  ├─ ESM/CJS: engine + shared as peerDependencies (external)
  ├─ Browser IIFE: Bundles everything
  └─ Types: dist/types/

@quake2ts/client (depends on cgame, game, engine, shared)
  ├─ ESM/CJS: All workspace deps as peerDependencies (external)
  ├─ Browser IIFE: Full game bundle with everything
  └─ Types: dist/types/

quake2ts (root package)
  └─ Browser bundle: Complete standalone game (optional convenience)
```

### Dependency Types

#### peerDependencies
- **Use for**: Workspace packages that consuming apps will also install
- **Examples**: `@quake2ts/shared`, `@quake2ts/engine`
- **Benefit**: Ensures single shared instance, prevents duplication

#### dependencies
- **Use for**: External packages required at runtime
- **Examples**: `gl-matrix`, `ws`, `@wasm-audio-decoders/*`
- **Benefit**: Automatically installed with package

#### devDependencies
- **Use for**: Build tools and testing utilities
- **Examples**: `tsup`, `vitest`, `@quake2ts/test-utils`

---

## Recommended Configuration

### Shared tsup Config Factory

Create `/quake2ts/build-config/tsup.factory.ts`:

```typescript
import { defineConfig, Options } from 'tsup';

interface PackageConfig {
  /** Package name for browser global (e.g., "Quake2Shared") */
  globalName: string;
  /** Entry point (default: 'src/index.ts') */
  entry?: string;
  /** External dependencies to keep unbundled */
  external?: string[];
  /** Whether to generate browser IIFE bundle */
  browserBundle?: boolean;
}

export function createLibraryConfig(config: PackageConfig): Options[] {
  const entry = config.entry || 'src/index.ts';

  const builds: Options[] = [
    // ESM build - keep dependencies external
    {
      entry: [entry],
      format: ['esm'],
      target: 'es2020',
      sourcemap: true,
      clean: true,
      splitting: false,
      dts: false,
      outDir: 'dist/esm',
      external: config.external || [/@quake2ts\/.*/, 'gl-matrix', 'ws'],
      treeshake: true,
    },

    // CJS build - keep dependencies external
    {
      entry: [entry],
      format: ['cjs'],
      target: 'es2020',
      sourcemap: true,
      clean: false,
      splitting: false,
      dts: false,
      outDir: 'dist/cjs',
      external: config.external || [/@quake2ts\/.*/, 'gl-matrix', 'ws'],
      treeshake: true,
      outExtension() {
        return { js: '.cjs' };
      },
    },
  ];

  // Optional browser IIFE bundle - bundle everything
  if (config.browserBundle) {
    builds.push({
      entry: { index: entry },
      format: ['iife'],
      target: 'es2020',
      sourcemap: true,
      clean: false,
      splitting: false,
      dts: false,
      outDir: 'dist/browser',
      globalName: config.globalName,
      minify: true,
      platform: 'browser',
      // Bundle ALL dependencies for standalone browser usage
      noExternal: [/.*/],
    });
  }

  return builds;
}
```

### Example Package Configs

#### @quake2ts/shared/tsup.config.ts
```typescript
import { defineConfig } from 'tsup';
import { createLibraryConfig } from '../../build-config/tsup.factory';

export default defineConfig(
  createLibraryConfig({
    globalName: 'Quake2Shared',
    browserBundle: true,
    external: ['gl-matrix'], // Only external dep
  })
);
```

#### @quake2ts/engine/tsup.config.ts
```typescript
import { defineConfig } from 'tsup';
import { createLibraryConfig } from '../../build-config/tsup.factory';

export default defineConfig(
  createLibraryConfig({
    globalName: 'Quake2Engine',
    browserBundle: true,
    external: [/@quake2ts\/.*/, 'gl-matrix', '@wasm-audio-decoders/ogg-vorbis'],
  })
);
```

#### @quake2ts/client/tsup.config.ts
```typescript
import { defineConfig } from 'tsup';
import { createLibraryConfig } from '../../build-config/tsup.factory';

export default defineConfig(
  createLibraryConfig({
    globalName: 'Quake2Client',
    browserBundle: true, // Full game bundle
    external: [/@quake2ts\/.*/, 'gl-matrix'],
  })
);
```

### Updated package.json Structure

#### Library Package Example (@quake2ts/engine)

```json
{
  "name": "@quake2ts/engine",
  "version": "0.0.738",
  "type": "module",
  "main": "./dist/cjs/index.cjs",
  "module": "./dist/esm/index.js",
  "types": "./dist/types/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/types/index.d.ts",
      "import": "./dist/esm/index.js",
      "require": "./dist/cjs/index.cjs",
      "default": "./dist/esm/index.js"
    },
    "./browser": {
      "types": "./dist/types/index.d.ts",
      "default": "./dist/browser/index.js"
    }
  },
  "unpkg": "./dist/browser/index.js",
  "jsdelivr": "./dist/browser/index.js",
  "files": ["dist"],
  "sideEffects": false,
  "repository": {
    "type": "git",
    "url": "https://github.com/jburnhams/quake2.git",
    "directory": "quake2ts/packages/engine"
  },
  "peerDependencies": {
    "@quake2ts/shared": "workspace:*",
    "gl-matrix": "^3.4.4"
  },
  "dependencies": {
    "@wasm-audio-decoders/ogg-vorbis": "^0.1.14"
  },
  "devDependencies": {
    "@quake2ts/shared": "workspace:*",
    "@quake2ts/test-utils": "workspace:*",
    "gl-matrix": "^3.4.4",
    "tsup": "^8.1.0"
  }
}
```

**Key Changes**:
1. ✅ Added `repository` field with directory
2. ✅ Workspace deps moved to `peerDependencies`
3. ✅ Kept in `devDependencies` for local development
4. ✅ External runtime deps in `dependencies`

---

## Migration Plan

### Phase 1: Shared Build Configuration (Low Risk)

1. **Create build-config directory**
   ```bash
   mkdir -p quake2ts/build-config
   ```

2. **Create tsup factory** (see recommended config above)

3. **Update one package** (start with `@quake2ts/shared`) to use factory

4. **Test build output** - verify dist/ structure unchanged

5. **Migrate remaining packages** one by one

### Phase 2: Fix Dependency Bundling (Breaking Change)

**⚠️ WARNING**: This is a breaking change for consumers!

1. **Update package.json** for each library package:
   - Add `peerDependencies` section
   - Add `repository` field
   - Move workspace deps from `dependencies` to `peerDependencies`
   - Keep workspace deps in `devDependencies` for monorepo development

2. **Update tsup configs** to use `external` instead of `noExternal` for ESM/CJS

3. **Keep `noExternal` only for browser IIFE builds**

4. **Test thoroughly**:
   ```bash
   # Build all packages
   pnpm run build

   # Verify no bundled workspace deps in dist/esm and dist/cjs
   # Verify browser bundles still self-contained

   # Run all tests
   pnpm test
   ```

5. **Version bump**: Increment major version (breaking change)

### Phase 3: Standardize cgame (Optional)

**Current**: cgame uses single-step build with `dts: { resolve: true }`

**Option A**: Keep as-is (simpler, works fine for private package)

**Option B**: Align with other packages (consistency)
- Use factory config
- Add browser IIFE bundle
- Two-step build (types + bundles)

**Recommendation**: Keep as-is since it's private and simpler is better

---

## Testing the Changes

### Build Verification

```bash
# 1. Clean build
pnpm run clean
pnpm run build

# 2. Check ESM bundle doesn't include workspace deps
cd quake2ts/packages/engine
grep -r "@quake2ts/shared" dist/esm/
# Should find: imports from '@quake2ts/shared' (external reference)
# Should NOT find: bundled code from shared package

# 3. Check browser bundle DOES include everything
grep -r "Vec3" dist/browser/index.js
# Should find: bundled Vec3 implementation (from shared)

# 4. Verify types
ls dist/types/
# Should have complete .d.ts files
```

### Consumer Testing

Create test project to verify:

```json
// test-app/package.json
{
  "dependencies": {
    "@quake2ts/client": "^0.0.738",
    "@quake2ts/engine": "^0.0.738",
    "@quake2ts/shared": "^0.0.738",
    "gl-matrix": "^3.4.4"
  }
}
```

```typescript
// test-app/src/index.ts
import { Client } from '@quake2ts/client';
import { Vec3 } from '@quake2ts/shared';

// Should work without bundling shared multiple times
```

Build with Vite/Rollup/Webpack and verify bundle size is reasonable.

---

## Benefits of Recommended Approach

### For Package Consumers

✅ **No code duplication**: Single instance of shared code
✅ **Better tree-shaking**: Only bundle what you use
✅ **Smaller bundles**: No redundant code
✅ **Flexible bundling**: Choose your own bundler/version
✅ **Correct dependency resolution**: npm/pnpm handles it

### For Package Maintainers

✅ **Smaller package sizes**: ESM/CJS builds don't include deps
✅ **Faster builds**: Less code to bundle
✅ **Clearer dependencies**: peerDependencies make requirements explicit
✅ **Less configuration duplication**: Shared factory config
✅ **Industry standard**: Follows npm best practices

### For Browser Users

✅ **Still works**: Browser IIFE bundles remain self-contained
✅ **CDN ready**: unpkg/jsdelivr bundles include everything
✅ **Drop-in replacement**: `<script>` tag usage unchanged

---

## Additional Recommendations

### 1. Consider Root Package Bundle

The root `quake2ts` package could provide a complete browser bundle:

```json
// quake2ts/package.json
{
  "name": "quake2ts",
  "version": "0.0.738",
  "description": "Complete Quake II TypeScript port - browser bundle",
  "main": "./dist/quake2.js",
  "unpkg": "./dist/quake2.js",
  "jsdelivr": "./dist/quake2.js",
  "repository": {
    "type": "git",
    "url": "https://github.com/jburnhams/quake2.git"
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup"
  }
}
```

This provides a single-file bundle for CDN usage while individual packages remain tree-shakeable.

### 2. External Dependency Strategy

**gl-matrix** is used in multiple packages. Two options:

**Option A: Peer Dependency** (Recommended)
- Declare as `peerDependencies` in all packages
- Consumers install once, shared across packages
- Better for tree-shaking

**Option B: Regular Dependency**
- Keep as `dependencies` in packages that need it
- npm deduplicates automatically
- Simpler for consumers

**Recommendation**: Use peerDependencies for better control

### 3. Documentation Updates

After migration, document:
- Installation instructions with peer dependencies
- Browser CDN usage via `/browser` export
- Tree-shaking setup for bundlers
- Migration guide for existing consumers

---

## File Checklist

### Files to Create
- [ ] `/quake2ts/build-config/tsup.factory.ts`
- [ ] `/quake2ts/build-config/package.json` (if factory needs dependencies)
- [ ] `/quake2ts/MIGRATION-GUIDE.md` (for consumers)

### Files to Update (per package)
- [ ] `package.json` - Add repository, peerDependencies
- [ ] `tsup.config.ts` - Use factory, remove noExternal from ESM/CJS
- [ ] `README.md` - Update installation instructions (if exists)

### Packages to Update (in order)
1. [ ] `@quake2ts/shared` (no dependencies)
2. [ ] `@quake2ts/engine` (depends on shared)
3. [ ] `@quake2ts/game` (depends on engine, shared)
4. [ ] `@quake2ts/tools` (depends on engine, shared)
5. [ ] `@quake2ts/cgame` (depends on game, engine, shared)
6. [ ] `@quake2ts/server` (depends on game, engine, shared)
7. [ ] `@quake2ts/client` (depends on all)
8. [ ] `@quake2ts/test-utils` (already correct, just add repository)

---

## Questions & Answers

### Q: Won't external dependencies break browser builds?

**A**: No! Browser IIFE builds still use `noExternal` to bundle everything. Only ESM/CJS builds keep deps external.

### Q: What about backward compatibility?

**A**: Breaking change. Version bump to next major. Consumers need to install peer dependencies.

### Q: Why keep workspace deps in devDependencies too?

**A**: For monorepo development. Allows local development/testing without publishing.

### Q: Should cgame be published or stay private?

**A**: Currently private. If it's only used by `@quake2ts/client`, keep it private. If consumers might want client-side logic separately, publish it.

### Q: What about tree-shaking?

**A**: ESM builds with external deps enable tree-shaking. Browser IIFE doesn't tree-shake (bundles everything), but that's expected for standalone usage.

---

## Summary

**Current State**: Fat bundles everywhere, massive code duplication, not following library best practices

**Recommended State**:
- ESM/CJS builds keep dependencies external
- Browser IIFE bundles everything for standalone usage
- Proper peerDependencies declaration
- Shared build configuration
- Industry-standard packaging

**Migration Effort**: Medium
- Create shared config: 2 hours
- Update all packages: 4-6 hours
- Testing: 2-4 hours
- Documentation: 1-2 hours
- **Total: ~1-2 days**

**Risk Level**: Medium
- Breaking change for consumers
- Requires thorough testing
- Clear migration guide needed

**Benefit Level**: High
- Significant bundle size reduction
- Better consumer experience
- Follows npm best practices
- Easier to maintain
