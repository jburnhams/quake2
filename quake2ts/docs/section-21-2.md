# Section 21-2: CI/CD Pipeline & GitHub Pages

**Phase:** 1 (Foundation)
**Priority:** CRITICAL
**Dependencies:** 21-1
**Estimated Effort:** 2-3 days

---

## Overview

Establish the CI/CD infrastructure for automated WebGL visual tests. Create GitHub Actions workflow, configure test execution, generate visual reports, and deploy results to GitHub Pages alongside WebGPU test results.

**Reference Implementation:**
- `.github/workflows/webgpu.yml` (WebGPU workflow)
- `.github/workflows/pages.yml` (Pages deployment)
- `packages/tools/src/generate-visual-report.ts` (Report generation)

---

## Objectives

1. Create GitHub Actions workflow for WebGL visual tests
2. Configure headless GL environment in CI
3. Generate visual test reports (JSON + images)
4. Extend GitHub Pages deployment to include WebGL results
5. Provide separate navigation for WebGL vs WebGPU results

---

## Tasks

### Task 1: GitHub Actions Workflow

**File:** `.github/workflows/webgl-visual.yml` (new)

Create workflow for WebGL visual tests:

```yaml
name: WebGL Visual Tests

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  visual-tests:
    name: WebGL Visual Tests (Node 25)
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: quake2ts
    steps:
      # Checkout, setup node, pnpm (same as webgpu.yml)
      # ... standard steps ...

      # No special system dependencies needed for WebGL
      # The 'gl' package bundles what it needs

      - name: Install dependencies
        run: pnpm install

      - name: Build workspace
        run: pnpm run build

      - name: Run WebGL Visual Tests
        env:
          ALWAYS_SAVE_SNAPSHOTS: '1'
        run: pnpm run test:webgl

      - name: Generate Visual Report
        run: npx tsx packages/tools/src/generate-webgl-report.ts

      - name: Upload Visual Test Results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: webgl-visual-test-results
          path: |
            quake2ts/webgl-visual-tests.json
            quake2ts/packages/engine/tests/webgl/visual/__snapshots__
```

**Subtasks:**
1. [x] Create workflow file based on `webgpu.yml` template
2. [x] Use ubuntu-latest runner (WebGL works out of the box)
3. [x] No special system dependencies required
4. [x] Run `pnpm run test:webgl` script
5. [x] Set `ALWAYS_SAVE_SNAPSHOTS=1` to save actual/diff images on failure
6. [x] Generate report JSON
7. [x] Upload artifacts for Pages deployment
8. [x] Run on push to main and pull requests

**Implementation Notes:**
- Ubuntu has sufficient GL drivers built-in
- The `gl` package uses Mesa (already present) or bundled ANGLE
- No need for `VK_ICD_FILENAMES` like WebGPU
- Simpler setup than WebGPU workflow

---

### Task 2: Visual Report Generator

**File:** `packages/tools/src/generate-webgl-report.ts` (new)

Create report generator for WebGL test results:

```typescript
interface WebGLVisualTestResult {
  name: string;
  category: string; // '2d', 'world', 'models', etc.
  passed: boolean;
  percentDifferent: number;
  pixelsDifferent: number;
  totalPixels: number;
  baselineExists: boolean;
  hasActual: boolean;
  hasDiff: boolean;
}

interface WebGLVisualReport {
  timestamp: string;
  totalTests: number;
  passed: number;
  failed: number;
  tests: WebGLVisualTestResult[];
}

async function generateWebGLVisualReport(): Promise<void>
```

**Subtasks:**
1. [x] Scan `tests/webgl/visual/__snapshots__/stats/` for test results
2. [x] For each test, read JSON stats file
3. [x] Check for baseline/actual/diff image existence
4. [x] Determine test category from file path
5. [x] Aggregate results into report structure
6. [x] Write `webgl-visual-tests.json` to workspace root
7. [x] Handle missing files gracefully

**Implementation Notes:**
- Similar to `generate-visual-report.ts` but for WebGL
- Categories: '2d', 'world', 'models', 'lighting', 'effects', 'debug', 'integration'
- Extract category from test file path pattern
- Report format should match WebGPU for consistency

---

### Task 3: Visual Gallery Generator

**File:** `packages/tools/src/generate-gallery.ts` (modify existing)

Extend gallery generator to support both WebGL and WebGPU results:

**Subtasks:**
1. [x] Detect both `visual-tests.json` (WebGPU) and `webgl-visual-tests.json` (WebGL)
2. [x] Generate separate gallery pages or tabbed interface
3. [x] Use same HTML/CSS structure for consistency
4. [x] Add navigation between WebGL and WebGPU results
5. [x] Label images clearly (WebGL vs WebGPU)
6. [x] Support side-by-side comparison mode (future enhancement)

**Implementation Notes:**
- Can reuse existing gallery generation logic
- Create separate HTML files: `index.html` (WebGPU), `webgl.html` (WebGL)
- Or create tabbed single-page interface
- Ensure image paths resolve correctly

---

### Task 4: GitHub Pages Deployment

**File:** `.github/workflows/pages.yml` (modify existing)

Extend Pages deployment to include WebGL results:

**Subtasks:**
1. [x] Add WebGL visual tests workflow to trigger list
2. [x] Download `webgl-visual-test-results` artifact
3. [x] Copy WebGL snapshots to pages-dist structure
4. [x] Run gallery generator for both WebGL and WebGPU
5. [x] Deploy combined results to Pages

**Modifications:**

```yaml
# Trigger on both workflows
on:
  workflow_run:
    workflows: ["WebGpu Tests", "WebGL Visual Tests"]
    types: [completed]

jobs:
  deploy:
    steps:
      # ... existing steps ...

      - name: Download WebGPU Results
        uses: actions/download-artifact@v4
        with:
          name: visual-test-results
          path: visual-test-results
          run-id: ${{ github.event.workflow_run.id }}

      - name: Download WebGL Results
        uses: actions/download-artifact@v4
        with:
          name: webgl-visual-test-results
          path: webgl-visual-test-results
          run-id: ${{ github.event.workflow_run.id }}
        continue-on-error: true

      - name: Build Pages
        run: |
          mkdir -p pages-dist
          cp -r pages/* pages-dist/

          # Build WebGPU gallery (existing)
          if [ -f "visual-test-results/visual-tests.json" ]; then
            # ... existing WebGPU logic ...
          fi

          # Build WebGL gallery (new)
          if [ -f "webgl-visual-test-results/webgl-visual-tests.json" ]; then
            npx tsx quake2ts/packages/tools/src/generate-gallery.ts \
              webgl-visual-test-results/webgl-visual-tests.json \
              pages-dist \
              --renderer webgl

            # Copy WebGL snapshots
            mkdir -p pages-dist/webgl-snapshots/{baselines,actual,diff}
            find webgl-visual-test-results -type d -name "baselines" \
              -exec cp -r {}/. pages-dist/webgl-snapshots/baselines/ \; || true
            find webgl-visual-test-results -type d -name "actual" \
              -exec cp -r {}/. pages-dist/webgl-snapshots/actual/ \; || true
            find webgl-visual-test-results -type d -name "diff" \
              -exec cp -r {}/. pages-dist/webgl-snapshots/diff/ \; || true
          fi
```

**Implementation Notes:**
- Download both artifact sets
- Keep WebGL and WebGPU snapshots separate (different directories)
- Handle case where only one workflow has run
- Continue deployment if WebGL artifact missing

---

### Task 5: Documentation README

**File:** `packages/engine/tests/webgl/visual/README.md` (new)

Create comprehensive README for WebGL visual tests:

**Content Sections:**
1. **Overview** - What are these tests, why they exist
2. **Prerequisites** - System requirements (none or minimal)
3. **Running Tests Locally**
   - `pnpm test:webgl` - Run all tests
   - `UPDATE_VISUAL=1 pnpm test:webgl` - Update baselines
4. **Writing New Tests** - Patterns and examples
5. **Test Organization** - Directory structure, categories
6. **Baseline Management** - Creating, reviewing, updating
7. **Debugging Failed Tests** - Using diff images
8. **CI/CD** - How tests run in GitHub Actions

**Subtasks:**
1. [x] Write clear, concise documentation
2. [x] Include code examples
3. [x] Link to relevant tools/scripts
4. [x] Explain baseline approval process
5. [x] Document test naming conventions

**Implementation Notes:**
- Similar to `tests/webgpu/visual/README.md`
- Emphasize that these test the production renderer
- Include examples of each test category
- Provide troubleshooting section

---

### Task 6: Test Scripts in package.json

**File:** `packages/engine/package.json` (already modified in 21-1)

Add convenience scripts:

```json
{
  "scripts": {
    "test:webgl": "cross-env TEST_TYPE=webgl vitest run",
    "test:webgl:watch": "cross-env TEST_TYPE=webgl vitest watch",
    "test:webgl:update": "cross-env UPDATE_VISUAL=1 TEST_TYPE=webgl vitest run",
    "test:webgl:ui": "cross-env TEST_TYPE=webgl vitest --ui"
  }
}
```

**Subtasks:**
1. [x] Add scripts for different test modes
2. [x] Document scripts in README
3. [x] Ensure environment variables propagate correctly

---

## Deliverables

### New Files Created
- `.github/workflows/webgl-visual.yml` (~80 lines)
- `packages/tools/src/generate-webgl-report.ts` (~150 lines)
- `packages/engine/tests/webgl/visual/README.md` (~200 lines)

### Modified Files
- `.github/workflows/pages.yml` (add WebGL artifact handling)
- `packages/tools/src/generate-gallery.ts` (support WebGL results)
- `packages/engine/package.json` (add test scripts)

---

## Testing Strategy

### Local Testing

Verify workflow components locally:

```bash
# Run tests locally
cd quake2ts/packages/engine
pnpm test:webgl

# Generate report locally
cd quake2ts
npx tsx packages/tools/src/generate-webgl-report.ts

# Verify report JSON created
cat webgl-visual-tests.json
```

### CI Testing

1. Create draft PR to trigger workflow
2. Verify workflow runs successfully
3. Check artifact upload includes all snapshots
4. Verify report JSON is valid
5. Check Pages deployment (if merged to main)

---

## Success Criteria

- [x] GitHub Actions workflow runs successfully
- [x] WebGL tests execute in CI environment
- [x] Visual report JSON generated correctly
- [x] Artifacts uploaded with all snapshots
- [x] GitHub Pages deploys with WebGL results
- [x] Can navigate between WebGL and WebGPU galleries
- [x] Documentation is clear and complete
- [x] Local and CI test execution work identically

---

## Notes for Implementer

- **Workflow Triggers:** Run on PR to catch issues before merge
- **Artifact Naming:** Use distinct names (`webgl-visual-test-results` vs `visual-test-results`)
- **Report Format:** Match WebGPU report structure for consistency
- **Gallery UI:** Keep simple, focus on functionality over design
- **Documentation:** Assume reader is familiar with testing but not this codebase
- **Failure Handling:** Tests should fail PR if visual regression detected

---

**Next Section:** [21-3: 2D Rendering (Sprites, UI, Text)](section-21-3.md)
