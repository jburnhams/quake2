import { vi, type Mock } from 'vitest';

/**
 * Polyfill for the legacy Vitest Mock type which took [Args] and Return as generic arguments.
 * usage: LegacyMock<[Arg1, Arg2], ReturnType>
 */
export type LegacyMock<Args extends any[] = any[], Return = any> = Mock<(...args: Args) => Return>;

/**
 * Polyfill for vi.fn with legacy generic signature.
 * usage: legacyFn<[Arg1, Arg2], ReturnType>(impl)
 */
export function legacyFn<Args extends any[] = any[], Return = any>(
  implementation?: (...args: Args) => Return
): LegacyMock<Args, Return> {
  return vi.fn(implementation) as unknown as LegacyMock<Args, Return>;
}
