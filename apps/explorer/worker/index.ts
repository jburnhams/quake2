// The Worker's entry. It exports only the handler: the Workers runtime treats every named export of
// the entry as an entrypoint, so the logic and its constants live in handle.ts.
import { handle, type Runtime } from './handle';

declare const caches: { default: Runtime['cache'] };

export default {
  fetch(request: Request, env: Parameters<typeof handle>[1], ctx: Parameters<typeof handle>[2]): Promise<Response> {
    return handle(request, env, ctx, { fetch: (input, init) => fetch(input, init), cache: caches.default });
  },
};
