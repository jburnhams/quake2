# WebGL Visual Tests - Playwright Migration

## Current Status

Converting WebGL visual tests from headless-gl (WebGL 1.0 only) to Playwright (full WebGL 2.0 support).

## Critical Finding

**WebGL state does NOT persist between separate `page.evaluate()` calls in Playwright!**

This means:
- ❌ WRONG: Render in one `page.evaluate()`, capture in another
- ✅ CORRECT: Render AND capture in a SINGLE `page.evaluate()`

### Working Example

See `combined-test.test.ts` for a working example that renders and captures in one evaluate:

```typescript
const pixelData = await page.evaluate(() => {
  const gl = canvas.getContext('webgl2')!;
  
  // Render
  gl.clearColor(1, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.finish();
  
  // Capture IMMEDIATELY in same context
  const pixels = new Uint8Array(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  
  // Return pixels
  return Array.from(pixels);
});
```

## Next Steps

1. Fix `webgl-playwright.ts` helper to use single-evaluate approach
2. Rewrite all sprite/text/ui-element tests using this pattern
3. Generate proper baselines
4. Remove old headless-gl based tests

## Files

- ✅ `combined-test.test.ts` - Working example (765 bytes baseline)
- ❌ `simple-test.test.ts` - Broken (separate evaluate calls, 346 bytes)
- ❌ Old approach files need rewriting

##Tests Needed

- [ ] sprites.test.ts (4 tests: checkerboard, basic, alpha, batch)
- [ ] text.test.ts (3 tests: simple, multi-line, colored)
- [ ] ui-elements.test.ts (4 tests: filled rect, overlapping, transparency, gradient)
