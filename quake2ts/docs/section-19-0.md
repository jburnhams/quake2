# Test-Utils Migration Plan - Master Overview

**Project:** Quake2TS Test Utilities Consolidation
**Version:** 1.0
**Last Updated:** 2025-12-18

---

## Executive Summary

This document provides a comprehensive plan to migrate all testing utilities, mocks, helpers, and factories into the centralized `@quake2ts/test-utils` package. The migration will eliminate code duplication, provide a consistent testing API across all packages, and enable client applications to leverage these utilities for their own tests.

**Current State:**
- 603 test files across 7 packages
- Duplicate test utilities in multiple locations (e.g., BSP helpers duplicated 3 times, WebGL mocks duplicated 2 times)
- Scattered inline mocks in 100+ test files
- Basic test-utils package exists (~520 lines) but incomplete

**Target State:**
- All common test utilities centralized in test-utils package
- Zero duplication of test helper code
- Reusable mock factories for all major systems
- Comprehensive test utilities available to client applications
- Estimated ~2,800 lines of new utilities
- ~350+ test files updated to use centralized utilities

---

## Document Structure

This migration is divided into **6 parallel work streams**, each documented in a separate section file:

| Section | Work Stream | Priority | Tasks | Subtasks | Dependencies |
|---------|-------------|----------|-------|----------|--------------|
| [19-1](section-19-1.md) | Shared/Core Utilities | **HIGH** | 6 | 32 | None (start first) |
| [19-2](section-19-2.md) | Engine/Rendering Utilities | **HIGH** | 8 | 58 | 19-1 (math helpers) |
| [19-3](section-19-3.md) | Game/Entity Utilities | **HIGH** | 9 | 64 | 19-1 (collision helpers) |
| [19-4](section-19-4.md) | Client Utilities | **MEDIUM** | 9 | 57 | 19-2 (renderer mocks) |
| [19-5](section-19-5.md) | Server/Network Utilities | **MEDIUM** | 9 | 52 | 19-1, 19-3 |
| [19-6](section-19-6.md) | Environment Setup & E2E | **LOW** | 10 | 56 | 19-2, 19-4 |

**Totals:** 51 Tasks, 319 Subtasks

---

## Migration Strategy

### Parallel Work Streams

The sections are designed to be worked on in parallel by different developers:

```
Phase 1 (Week 1-2): Foundation
├─ Section 19-1: Shared/Core Utilities ← START HERE (blocks others)
│
Phase 2 (Week 2-4): Core Systems (can run in parallel)
├─ Section 19-2: Engine/Rendering Utilities
├─ Section 19-3: Game/Entity Utilities
│
Phase 3 (Week 3-5): Client/Server (can run in parallel)
├─ Section 19-4: Client Utilities
├─ Section 19-5: Server/Network Utilities
│
Phase 4 (Week 4-6): Infrastructure
└─ Section 19-6: Environment Setup & E2E
```

### Priority Levels

**HIGH Priority (Sections 19-1, 19-2, 19-3):**
- Eliminate critical duplications (BSP helpers, WebGL mocks)
- Provide foundation for all other work
- Impact: ~200 test files

**MEDIUM Priority (Sections 19-4, 19-5):**
- Client and server-specific utilities
- Important for full test coverage
- Impact: ~100 test files

**LOW Priority (Section 19-6):**
- Infrastructure and E2E utilities
- Can be done after core utilities stable
- Impact: ~30 test files

---

## Key Dependencies

### Critical Path

```
19-1 (Shared/Core) ──> 19-2 (Engine) ──> 19-4 (Client)
                   │
                   └──> 19-3 (Game) ──> 19-5 (Server)

19-2 + 19-4 ──────────> 19-6 (Setup/E2E)
```

### Detailed Dependencies

- **Section 19-1** blocks:
  - 19-2 Task 3 (math helpers needed)
  - 19-3 Task 4 (collision helpers needed)
  - 19-5 Task 1-2 (network mocks needed)

- **Section 19-2** blocks:
  - 19-4 Task 1-2 (renderer mocks needed)
  - 19-6 Task 1-2 (WebGL mocks needed)

- **Section 19-3** blocks:
  - 19-5 Task 2, 4 (game context needed)

### Parallel Opportunities

**Can work simultaneously:**
- 19-2 and 19-3 after 19-1 Task 3 completes
- 19-4 and 19-5 after their dependencies met
- Within each section, many tasks are independent

---

## Test-Utils Package Structure

The final structure will mirror the source package organization:

```
packages/test-utils/
├── package.json
├── README.md
├── tsconfig.json
├── tsup.config.ts
├── src/
│   ├── index.ts (main exports)
│   │
│   ├── shared/              # Section 19-1
│   │   ├── bsp.ts           # ✓ Exists - consolidate duplicates
│   │   ├── mocks.ts         # ✓ Exists - expand
│   │   ├── math.ts          # NEW - vector/bounds factories
│   │   ├── collision.ts     # NEW - trace/surface helpers
│   │   └── factories.ts     # NEW - config strings, cvars
│   │
│   ├── game/                # Section 19-3
│   │   ├── factories.ts     # ✓ Exists - expand entity factories
│   │   ├── helpers.ts       # ✓ Exists - expand contexts
│   │   ├── helpers/
│   │   │   ├── physics.ts   # NEW - physics simulation
│   │   │   ├── spawn.ts     # NEW - spawn utilities
│   │   │   └── save.ts      # NEW - save/load helpers
│   │   └── mocks/
│   │       ├── ai.ts        # NEW - AI mocks
│   │       ├── combat.ts    # NEW - weapon/damage mocks
│   │       └── items.ts     # NEW - inventory/item mocks
│   │
│   ├── engine/              # Section 19-2
│   │   └── mocks/
│   │       ├── webgl.ts     # NEW - consolidate WebGL mocks
│   │       ├── audio.ts     # NEW - migrate audio fakes
│   │       ├── renderer.ts  # NEW - renderer factories
│   │       ├── assets.ts    # NEW - asset/resource mocks
│   │       ├── buffers.ts   # NEW - buffer/shader mocks
│   │       ├── lighting.ts  # NEW - light factories
│   │       └── particles.ts # NEW - particle mocks
│   │
│   ├── client/              # Section 19-4
│   │   ├── mocks/
│   │   │   ├── input.ts     # NEW - migrate input mocks
│   │   │   ├── state.ts     # NEW - client state mocks
│   │   │   ├── network.ts   # NEW - client network mocks
│   │   │   ├── download.ts  # NEW - download/precache mocks
│   │   │   └── console.ts   # NEW - console/command mocks
│   │   └── helpers/
│   │       ├── view.ts      # NEW - camera/view utilities
│   │       ├── hud.ts       # NEW - HUD test utilities
│   │       └── prediction.ts# NEW - prediction helpers
│   │
│   ├── server/              # Section 19-5
│   │   ├── mocks/
│   │   │   ├── transport.ts # NEW - migrate transport mock
│   │   │   ├── state.ts     # NEW - server state mocks
│   │   │   ├── connection.ts# NEW - connection mocks
│   │   │   ├── commands.ts  # NEW - server command mocks
│   │   │   └── master.ts    # NEW - master server mocks
│   │   └── helpers/
│   │       ├── multiplayer.ts # NEW - MP simulation
│   │       ├── snapshot.ts  # NEW - snapshot utilities
│   │       └── bandwidth.ts # NEW - rate limiting
│   │
│   ├── setup/               # Section 19-6
│   │   ├── browser.ts       # NEW - consolidate vitest setup
│   │   ├── node.ts          # NEW - Node environment setup
│   │   ├── canvas.ts        # NEW - canvas/WebGL helpers
│   │   ├── timing.ts        # NEW - RAF/timer mocks
│   │   ├── storage.ts       # NEW - storage mocks
│   │   └── audio.ts         # NEW - audio context setup
│   │
│   └── e2e/                 # Section 19-6
│       ├── playwright.ts    # NEW - Playwright helpers
│       ├── network.ts       # NEW - network simulators
│       └── visual.ts        # NEW - screenshot/visual testing
│
└── tests/                   # Tests for test-utils itself
    └── *.test.ts
```

---

## Impact Assessment

### Files to Create

**New Files:** ~35 new utility files
- Section 19-1: 3 files
- Section 19-2: 8 files
- Section 19-3: 7 files
- Section 19-4: 7 files
- Section 19-5: 7 files
- Section 19-6: 8 files

### Files to Update

**Test Files:** ~350 test files to update imports
- Shared tests: ~30 files
- Game tests: ~150 files
- Engine tests: ~50 files
- Client tests: ~85 files
- Server tests: ~20 files
- Integration/E2E tests: ~15 files

**Setup Files:** 2 vitest.setup.ts files to consolidate

### Files to Delete

**Deprecated Files:** ~10 files after migration
- `shared/tests/bsp/test-helpers.ts`
- `game/tests/physics/bsp-helpers.ts`
- `game/tests/test-helpers.ts` (already deprecated)
- `engine/tests/helpers/mockWebGL.ts`
- `engine/tests/audio/fakes.ts`
- `tests/src/mocks/webgl2.ts`
- `tests/src/mocks/input.ts`
- `server/tests/mocks/transport.ts`
- And 2-3 more scattered helper files

### Code Volume

**Estimated New Code:** ~2,800 lines
- Section 19-1: ~400 lines
- Section 19-2: ~800 lines
- Section 19-3: ~800 lines
- Section 19-4: ~500 lines
- Section 19-5: ~400 lines
- Section 19-6: ~400 lines

**Code Removed (duplicates):** ~600 lines

**Net Addition:** ~2,200 lines of utilities

---

## Risks and Mitigation

### Risk 1: Breaking Changes During Migration

**Risk:** Updating imports in 350+ test files could break tests

**Mitigation:**
- Maintain backward compatibility temporarily (re-exports)
- Migrate one package/directory at a time
- Run tests after each migration step
- Use search/replace with verification

### Risk 2: Incomplete Test Coverage

**Risk:** Test-utils itself needs comprehensive tests

**Mitigation:**
- Write tests for each utility as it's created
- Use the utilities in their own tests (dogfooding)
- Add test coverage requirements to CI

### Risk 3: Scope Creep

**Risk:** Discovering more utilities to migrate mid-process

**Mitigation:**
- This plan is comprehensive based on current analysis
- New discoveries go into backlog, not current sprint
- Stick to documented tasks unless critical

### Risk 4: Performance Impact

**Risk:** Centralized utilities could slow down test execution

**Mitigation:**
- Benchmark test suite before and after
- Optimize hot-path utilities
- Consider lazy loading for heavy mocks
- Tree-shaking ensures only used code is imported

---

## Success Criteria

### Completion Checklist

- [ ] All 319 subtasks completed across 6 sections
- [ ] Zero duplicate test utilities in codebase
- [ ] All 350+ test files updated to use `@quake2ts/test-utils`
- [ ] All deprecated files deleted
- [ ] Test-utils package has 80%+ test coverage
- [ ] Comprehensive README.md with examples
- [ ] API documentation generated
- [ ] No test failures introduced by migration
- [ ] Client applications can install and use test-utils

### Quality Metrics

**Code Quality:**
- TypeScript strict mode enabled
- All utilities have JSDoc comments
- Consistent naming conventions
- Full type safety (no `any` types)

**Test Coverage:**
- test-utils package: ≥80% coverage
- All existing tests still pass
- No performance regression >5%

**Documentation:**
- README with usage examples
- Migration guide for consumers
- API reference documentation
- Inline examples in JSDoc

---

## Timeline Estimate

Based on 2-3 developers working in parallel:

**Week 1-2: Foundation (Section 19-1)**
- Critical for all other work
- 6 tasks, 32 subtasks
- ~30 files updated

**Week 2-4: Core Systems (Sections 19-2, 19-3)**
- Can parallelize across 2 developers
- 17 tasks, 122 subtasks
- ~150 files updated

**Week 3-5: Client/Server (Sections 19-4, 19-5)**
- Can parallelize across 2 developers
- 18 tasks, 109 subtasks
- ~120 files updated

**Week 4-6: Infrastructure (Section 19-6)**
- Lower priority, 1 developer
- 10 tasks, 56 subtasks
- ~30 files updated

**Total Duration:** 4-6 weeks with 2-3 developers

---

## Getting Started

### Recommended Approach

1. **Read Section 19-1 first** - Foundation utilities
2. **Complete Section 19-1 Tasks 1-4** - Highest priority
3. **Branch strategy:**
   - One branch per section (e.g., `feat/test-utils-section-19-1`)
   - Merge to main after section completes
   - Allows parallel work without conflicts

4. **Testing strategy:**
   - Run affected package tests after each task
   - Full test suite after each section
   - No merge without green CI

5. **Review strategy:**
   - Task-level reviews (subtasks can batch)
   - Focus on API design in early tasks
   - Focus on coverage in later tasks

### First Steps

```bash
# Start with Section 19-1
cd quake2ts/packages/test-utils

# Create new files
mkdir -p src/shared
touch src/shared/math.ts
touch src/shared/collision.ts
touch src/shared/factories.ts

# Begin Task 1.1: Verify BSP helpers
# ... follow section-19-1.md checklist
```

---

## Questions and Clarifications

If you encounter ambiguity during implementation:

1. **API Design Questions:** Check if similar patterns exist in codebase, follow those conventions
2. **Scope Questions:** If unclear whether to migrate something, err on the side of inclusion
3. **Performance Questions:** Profile first, optimize if proven bottleneck
4. **Breaking Changes:** Avoid if possible; use deprecation warnings if necessary

---

## Maintenance and Updates

After initial migration:

- **New Test Utilities:** Add to test-utils package, not individual packages
- **Package Structure:** Follow established patterns in this plan
- **Documentation:** Update README.md when adding utilities
- **Versioning:** Follow semantic versioning for test-utils package
- **Client Support:** Consider client application use cases when designing APIs

---

## Appendix: Quick Reference

### Section Quick Links

- [Section 19-1: Shared/Core Utilities](section-19-1.md) - BSP, math, collision, network
- [Section 19-2: Engine/Rendering Utilities](section-19-2.md) - WebGL, audio, renderer, assets
- [Section 19-3: Game/Entity Utilities](section-19-3.md) - Entities, AI, physics, save/load
- [Section 19-4: Client Utilities](section-19-4.md) - Input, view, HUD, prediction
- [Section 19-5: Server/Network Utilities](section-19-5.md) - Transport, multiplayer, snapshots
- [Section 19-6: Environment Setup & E2E](section-19-6.md) - Browser setup, Playwright, E2E

### Priority Order

**Start Immediately:**
1. Section 19-1 Task 1 (BSP consolidation)
2. Section 19-1 Task 4 (collision helpers)
3. Section 19-2 Task 1 (WebGL consolidation)
4. Section 19-2 Task 2 (audio migration)

**High Value:**
5. Section 19-3 Task 1 (entity factories)
6. Section 19-3 Task 3 (AI/combat mocks)
7. Section 19-2 Task 3 (renderer factories)
8. Section 19-4 Task 1 (input mocks)

**Medium Value:**
9. Section 19-5 Task 1 (transport mocks)
10. Section 19-4 Task 2 (view utilities)

### Current Duplications to Eliminate

1. **BSP Helpers** - 3 identical copies
2. **WebGL Mocks** - 2 different implementations
3. **Test Context Helpers** - Scattered across packages
4. **Inline Renderer Mocks** - 30+ occurrences
5. **Vitest Setup** - Client and Engine identical

---

**Next Steps:** Begin with [Section 19-1: Shared/Core Utilities](section-19-1.md)
