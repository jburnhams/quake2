import { createMockWebGL2Context } from '../engine/mocks/webgl.js';

// Re-export for compatibility during migration
// But actually we prefer to use the one from engine/mocks/webgl.ts
// This file is kept if necessary for backward compatibility of file path imports
// but the implementation is now delegating to the consolidated one.

export { createMockWebGL2Context };
