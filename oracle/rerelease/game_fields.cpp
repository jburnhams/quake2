/* Game-side fields of an edict for host.cpp's dump: this file sees the game's whole edict_t
 * (g_local.h), which host.cpp, as the engine, does not. */
#include "rerelease/g_local.h"

extern "C" const char *rg_classname(const void *e) {
	const char *c = static_cast<const edict_t *>(e)->classname;
	return c ? c : "";
}
