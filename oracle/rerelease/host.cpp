/*
 * A headless host for id's rerelease game (the GPL game DLL, fetched unmodified into
 * .id-source/rerelease), so the TypeScript game can be held to it frame by frame.
 *
 * id published the rerelease's game code but not its engine, so this is the engine's part,
 * written from 3.21's server (sv_game.c, sv_world.c, sv_init.c), which the rerelease engine
 * grew from, with collision answered by 3.21's cmodel.c (world_shim.c). Where the rerelease
 * changed the contract, its game.h says how, and this follows it:
 *   - a box entity collides with the contents its svflags name (SVF_MONSTER, SVF_DEADMONSTER,
 *     SVF_PLAYER, SVF_PROJECTILE; CONTENTS_MONSTER otherwise, as 3.21's box hull has);
 *   - BoxEdicts takes a filter that keeps, skips or ends the search;
 *   - the game runs at 40 Hz (gi.tick_rate), RunFrame(true) does nothing until a player is in,
 *     and PrepFrame clears events once a frame has been sent.
 * The game's rand is mt19937 through libstdc++'s distributions, seeded 5489 (std::mt19937's
 * default) after Init, which seeds it from the clock.
 *
 * Usage: q2rgame <map.bsp> <mapname> <out.jsonl> [ticks=1200] [cvar=value...]
 * One scripted player (edict 1) walks, strafes, jumps, fires, crouches and changes weapon, a
 * usercmd every 25 ms tick; every tick the host writes the usercmd and every in-use edict.
 */
#include "rerelease/q_std.h"
#include "rerelease/game.h"
#include "world_shim.h"
#include <map>
#include <random>
#include <string>
#include <vector>

extern "C" void shim_load(const char *path);
extern "C" game_export_t *GetGameAPI(game_import_t *import);
extern std::mt19937 mt_rand;
extern "C" const char *rg_classname(const void *e);

static game_import_t gi;
static game_export_t *ge;
static FILE *out;
static uint32_t server_frame;

static edict_t *EDICT(uint32_t n) { return (edict_t *)((byte *)ge->edicts + ge->edict_size * n); }
static uint32_t NUM(const edict_t *e) { return (uint32_t)(((const byte *)e - (const byte *)ge->edicts) / ge->edict_size); }

/* ---------------- configstrings and indexes (SV_FindIndex) ---------------- */

static std::vector<std::string> configstrings(MAX_CONFIGSTRINGS);
static std::vector<int> submodel_headnode;

static void PF_configstring(int num, const char *s) {
	if (num < 0 || num >= (int)MAX_CONFIGSTRINGS) gi.Com_Error("configstring: bad index");
	configstrings[num] = s ? s : "";
}
static const char *PF_get_configstring(int num) {
	if (num < 0 || num >= (int)MAX_CONFIGSTRINGS) return "";
	return configstrings[num].c_str();
}
static int find_index(const char *name, int start, int max) {
	if (!name || !name[0]) return 0;
	int i;
	for (i = 1; i < max && !configstrings[start + i].empty(); i++)
		if (configstrings[start + i] == name) return i;
	if (i == max) gi.Com_Error("find_index: overflow");
	configstrings[start + i] = name;
	static const bool log = getenv("Q2RGAME_INDEX_LOG") != nullptr;
	if (log) fprintf(stderr, "%c %s\n", start == CS_MODELS ? 'm' : start == CS_SOUNDS ? 's' : 'i', name);
	return i;
}
static int PF_modelindex(const char *n) { return find_index(n, CS_MODELS, MAX_MODELS); }
static int PF_soundindex(const char *n) { return find_index(n, CS_SOUNDS, MAX_SOUNDS); }
static int PF_imageindex(const char *n) { return find_index(n, CS_IMAGES, MAX_IMAGES); }

/* ---------------- the world (sv_world.c) ---------------- */

constexpr int AREA_DEPTH = 4;
constexpr int MAX_TOTAL_ENT_LEAFS = 128;

struct areanode_t {
	int axis = -1;
	float dist = 0;
	areanode_t *children[2] = {nullptr, nullptr};
	std::vector<edict_t *> solids, triggers;
};
static std::vector<areanode_t> areanodes;

struct link_t {
	areanode_t *node = nullptr;
	bool trigger = false;
};
static std::vector<link_t> links;

static areanode_t *create_areanode(int depth, vec3_t mins, vec3_t maxs) {
	areanodes.emplace_back();
	areanode_t *anode = &areanodes.back();
	if (depth == AREA_DEPTH) return anode;
	vec3_t size = maxs - mins;
	anode->axis = size[0] > size[1] ? 0 : 1;
	anode->dist = 0.5f * (maxs[anode->axis] + mins[anode->axis]);
	vec3_t mins1 = mins, maxs1 = maxs, mins2 = mins, maxs2 = maxs;
	maxs1[anode->axis] = mins2[anode->axis] = anode->dist;
	anode->children[0] = create_areanode(depth + 1, mins2, maxs2);
	anode->children[1] = create_areanode(depth + 1, mins1, maxs1);
	return anode;
}

static void clear_world() {
	areanodes.clear();
	areanodes.reserve(64); // 31 nodes; pointers into it must not move
	float mins[3], maxs[3];
	int headnode;
	ws_inline_model(0, mins, maxs, &headnode);
	create_areanode(0, vec3_t {mins[0], mins[1], mins[2]}, vec3_t {maxs[0], maxs[1], maxs[2]});
	links.assign(MAX_EDICTS, link_t {});
}

static void PF_unlinkentity(edict_t *ent) {
	link_t &l = links[NUM(ent)];
	if (l.node) {
		auto &list = l.trigger ? l.node->triggers : l.node->solids;
		for (auto it = list.begin(); it != list.end(); ++it)
			if (*it == ent) { list.erase(it); break; }
		l.node = nullptr;
	}
	ent->linked = false;
}

static void PF_linkentity(edict_t *ent) {
	if (links[NUM(ent)].node) PF_unlinkentity(ent);
	if (ent == EDICT(0)) return; // don't add the world
	if (!ent->inuse) return;

	ent->size = ent->maxs - ent->mins;

	// encode the size into the entity_state for client prediction (3.21's packing)
	if (ent->solid == SOLID_BBOX && !(ent->svflags & SVF_DEADMONSTER)) {
		int i = (int)(ent->maxs[0] / 8); i = std::clamp(i, 1, 31);
		int j = (int)(-ent->mins[2] / 8); j = std::clamp(j, 1, 31);
		int k = (int)((ent->maxs[2] + 32) / 8); k = std::clamp(k, 1, 63);
		ent->s.solid = (k << 10) | (j << 5) | i;
	} else if (ent->solid == SOLID_BSP)
		ent->s.solid = 31; // a solid_bbox will never create this value
	else
		ent->s.solid = 0;

	if (ent->solid == SOLID_BSP && (ent->s.angles[0] || ent->s.angles[1] || ent->s.angles[2])) {
		float max = 0;
		for (int i = 0; i < 3; i++) {
			float v = fabsf(ent->mins[i]);
			if (v > max) max = v;
			v = fabsf(ent->maxs[i]);
			if (v > max) max = v;
		}
		for (int i = 0; i < 3; i++) {
			ent->absmin[i] = ent->s.origin[i] - max;
			ent->absmax[i] = ent->s.origin[i] + max;
		}
	} else {
		for (int i = 0; i < 3; i++) {
			ent->absmin[i] = ent->s.origin[i] + ent->mins[i];
			ent->absmax[i] = ent->s.origin[i] + ent->maxs[i];
		}
	}
	// because movement is clipped an epsilon away from an actual edge,
	// we must fully check even when bounding boxes don't quite touch
	for (int i = 0; i < 3; i++) { ent->absmin[i] -= 1; ent->absmax[i] += 1; }

	// link to PVS leafs: only the areas matter here, no frames are sent
	int leafs[MAX_TOTAL_ENT_LEAFS], topnode;
	float amin[3] = {ent->absmin[0], ent->absmin[1], ent->absmin[2]}, amax[3] = {ent->absmax[0], ent->absmax[1], ent->absmax[2]};
	int num = ws_box_leafnums(amin, amax, leafs, MAX_TOTAL_ENT_LEAFS, &topnode);
	ent->areanum = 0;
	ent->areanum2 = 0;
	for (int i = 0; i < num; i++) {
		int area = ws_leaf_area(leafs[i]);
		if (area) {
			// doors may legally straggle two areas, but nothing should ever need more than that
			if (ent->areanum && ent->areanum != area) ent->areanum2 = area;
			else ent->areanum = area;
		}
	}

	// if first time, make sure old_origin is valid
	if (!ent->linkcount) memcpy(ent->s.old_origin, ent->s.origin, sizeof(ent->s.origin));
	ent->linkcount++;
	ent->linked = true;

	if (ent->solid == SOLID_NOT) return;

	areanode_t *node = &areanodes[0];
	while (node->axis != -1) {
		if (ent->absmin[node->axis] > node->dist) node = node->children[0];
		else if (ent->absmax[node->axis] < node->dist) node = node->children[1];
		else break; // crosses the node
	}
	link_t &l = links[NUM(ent)];
	l.node = node;
	l.trigger = ent->solid == SOLID_TRIGGER;
	(l.trigger ? node->triggers : node->solids).push_back(ent);
}

/* SV_AreaEdicts with the rerelease's filter. */
static size_t PF_BoxEdicts(gvec3_cref_t mins, gvec3_cref_t maxs, edict_t **list, size_t maxcount, solidity_area_t areatype,
	BoxEdictsFilter_t filter, void *filter_data) {
	size_t count = 0;
	bool ended = false;
	auto walk = [&](auto &&self, areanode_t *node) -> void {
		auto &start = areatype == AREA_SOLID ? node->solids : node->triggers;
		std::vector<edict_t *> snapshot = start;
		for (edict_t *check : snapshot) {
			if (ended) return;
			if (check->solid == SOLID_NOT) continue; // deactivated
			if (check->absmin[0] > maxs[0] || check->absmin[1] > maxs[1] || check->absmin[2] > maxs[2] ||
				check->absmax[0] < mins[0] || check->absmax[1] < mins[1] || check->absmax[2] < mins[2])
				continue; // not touching
			BoxEdictsResult_t r = filter ? filter(check, filter_data) : BoxEdictsResult_t::Keep;
			if ((r & ~BoxEdictsResult_t::End) == BoxEdictsResult_t::Keep) {
				if (list && count < maxcount) list[count] = check;
				count++;
			}
			if ((int)r & (int)BoxEdictsResult_t::End) { ended = true; return; }
		}
		if (node->axis == -1) return; // terminal node
		if (maxs[node->axis] > node->dist) self(self, node->children[0]);
		if (ended) return;
		if (mins[node->axis] < node->dist) self(self, node->children[1]);
	};
	walk(walk, &areanodes[0]);
	return list ? std::min(count, maxcount) : count;
}

static int box_contents(const edict_t *ent) {
	if (ent->svflags & SVF_DEADMONSTER) return CONTENTS_DEADMONSTER;
	if (ent->svflags & SVF_MONSTER) return CONTENTS_MONSTER;
	if (ent->svflags & SVF_PLAYER) return CONTENTS_PLAYER;
	if (ent->svflags & SVF_PROJECTILE) return CONTENTS_PROJECTILE;
	return CONTENTS_MONSTER;
}

/* SV_HullForEntity: a brush model's own hull, else a box of the entity's size. */
static int hull_for_entity(const edict_t *ent, bool triggers) {
	if (ent->solid == SOLID_BSP || (triggers && (ent->svflags & SVF_HULL))) {
		const std::string &name = configstrings[CS_MODELS + ent->s.modelindex];
		if (!name.empty() && name[0] == '*') return submodel_headnode[atoi(name.c_str() + 1)];
		if (ent->solid == SOLID_BSP) gi.Com_Error("MOVETYPE_PUSH with a non bsp model");
	}
	float mn[3] = {ent->mins[0], ent->mins[1], ent->mins[2]}, mx[3] = {ent->maxs[0], ent->maxs[1], ent->maxs[2]};
	return ws_headnode_for_box(mn, mx, box_contents(ent));
}

static std::map<std::pair<int, int>, csurface_t> surfaces;
static csurface_t *surface_for(int flags, int value) {
	auto key = std::make_pair(flags, value);
	auto it = surfaces.find(key);
	if (it == surfaces.end()) {
		csurface_t s {};
		s.flags = (surfflags_t)flags;
		s.value = value;
		it = surfaces.emplace(key, s).first;
	}
	return &it->second;
}

static trace_t to_trace(const shim_trace_t &st, edict_t *ent) {
	trace_t t {};
	t.fraction = st.fraction;
	for (int i = 0; i < 3; i++) {
		t.endpos[i] = st.endpos[i];
		t.plane.normal[i] = st.normal[i];
	}
	t.plane.dist = st.dist;
	t.plane.type = (byte)st.type;
	t.plane.signbits = (byte)st.signbits;
	t.contents = (contents_t)st.contents;
	t.surface = surface_for(st.surfaceFlags, st.surfaceValue);
	t.startsolid = st.startsolid != 0;
	t.allsolid = st.allsolid != 0;
	t.ent = ent;
	return t;
}

#define F3(v) float v##_[3] = {(v)[0], (v)[1], (v)[2]}

static trace_t clip_to(edict_t *touch, gvec3_cref_t start, const float *mn, const float *mx, gvec3_cref_t end, contents_t mask, bool triggers) {
	int headnode = hull_for_entity(touch, triggers);
	float zero[3] = {0, 0, 0};
	F3(start); F3(end);
	float o[3] = {touch->s.origin[0], touch->s.origin[1], touch->s.origin[2]};
	float a[3] = {touch->s.angles[0], touch->s.angles[1], touch->s.angles[2]};
	shim_trace_t st;
	ws_trace(start_, end_, mn, mx, headnode, (int)mask, o, touch->solid == SOLID_BSP ? a : zero, &st);
	return to_trace(st, touch);
}

/* SV_Trace and SV_ClipMoveToEntities. */
static trace_t PF_trace(gvec3_cref_t start, gvec3_cptr_t mins, gvec3_cptr_t maxs, gvec3_cref_t end, const edict_t *passent, contents_t mask) {
	float mn[3] = {0, 0, 0}, mx[3] = {0, 0, 0};
	if (mins) { mn[0] = mins[0]; mn[1] = mins[1]; mn[2] = mins[2]; }
	if (maxs) { mx[0] = maxs[0]; mx[1] = maxs[1]; mx[2] = maxs[2]; }
	F3(start); F3(end);
	shim_trace_t st;
	ws_trace(start_, end_, mn, mx, 0, (int)mask, nullptr, nullptr, &st);
	trace_t best = to_trace(st, EDICT(0));
	if (best.fraction == 0) return best; // blocked by the world

	float boxmins[3], boxmaxs[3];
	for (int i = 0; i < 3; i++) {
		if (end[i] > start[i]) {
			boxmins[i] = start[i] + mn[i] - 1;
			boxmaxs[i] = end[i] + mx[i] + 1;
		} else {
			boxmins[i] = end[i] + mn[i] - 1;
			boxmaxs[i] = start[i] + mx[i] + 1;
		}
	}
	static edict_t *touchlist[MAX_EDICTS];
	size_t num = PF_BoxEdicts(boxmins, boxmaxs, touchlist, MAX_EDICTS, AREA_SOLID, nullptr, nullptr);
	for (size_t i = 0; i < num; i++) {
		edict_t *touch = touchlist[i];
		if (touch->solid == SOLID_NOT) continue;
		if (touch == passent) continue;
		if (best.allsolid) return best;
		if (passent) {
			if (touch->owner == passent) continue; // don't clip against own missiles
			if (passent->owner == touch) continue; // don't clip against owner
		}
		if (!(mask & CONTENTS_DEADMONSTER) && (touch->svflags & SVF_DEADMONSTER)) continue;
		trace_t t = clip_to(touch, start, mn, mx, end, mask, false);
		if (t.allsolid || t.startsolid || t.fraction < best.fraction) {
			if (best.startsolid) {
				best = t;
				best.startsolid = true;
			} else
				best = t;
		} else if (t.startsolid)
			best.startsolid = true;
	}
	return best;
}

static trace_t PF_clip(edict_t *entity, gvec3_cref_t start, gvec3_cptr_t mins, gvec3_cptr_t maxs, gvec3_cref_t end, contents_t mask) {
	float mn[3] = {0, 0, 0}, mx[3] = {0, 0, 0};
	if (mins) { mn[0] = mins[0]; mn[1] = mins[1]; mn[2] = mins[2]; }
	if (maxs) { mx[0] = maxs[0]; mx[1] = maxs[1]; mx[2] = maxs[2]; }
	return clip_to(entity, start, mn, mx, end, mask, true);
}

/* SV_PointContents. */
static contents_t PF_pointcontents(gvec3_cref_t p) {
	F3(p);
	int contents = ws_point_contents(p_, 0, nullptr, nullptr);
	static edict_t *touch[MAX_EDICTS];
	size_t num = PF_BoxEdicts(p, p, touch, MAX_EDICTS, AREA_SOLID, nullptr, nullptr);
	for (size_t i = 0; i < num; i++) {
		edict_t *hit = touch[i];
		int headnode = hull_for_entity(hit, false);
		float o[3] = {hit->s.origin[0], hit->s.origin[1], hit->s.origin[2]};
		float a[3] = {hit->s.angles[0], hit->s.angles[1], hit->s.angles[2]};
		contents |= ws_point_contents(p_, headnode, o, a);
	}
	return (contents_t)contents;
}

/* PF_setmodel. */
static void PF_setmodel(edict_t *ent, const char *name) {
	if (!name) gi.Com_Error("PF_setmodel: NULL");
	ent->s.modelindex = PF_modelindex(name);
	if (name[0] == '*') {
		float mn[3], mx[3];
		int headnode;
		ws_inline_model(atoi(name + 1), mn, mx, &headnode);
		ent->mins = {mn[0], mn[1], mn[2]};
		ent->maxs = {mx[0], mx[1], mx[2]};
		PF_linkentity(ent);
	}
}

static bool PF_inPVS(gvec3_cref_t a, gvec3_cref_t b, bool portals) {
	F3(a); F3(b);
	return ws_in_pvs(a_, b_, portals);
}
static bool PF_inPHS(gvec3_cref_t a, gvec3_cref_t b, bool portals) {
	F3(a); F3(b);
	return ws_in_phs(a_, b_, portals);
}
static void PF_SetAreaPortalState(int portal, bool open) { ws_set_area_portal(portal, open); }
static bool PF_AreasConnected(int a, int b) { return ws_areas_connected(a, b); }

/* ---------------- cvars, commands, memory ---------------- */

static std::map<std::string, cvar_t *> cvars;
static void cvar_store(cvar_t *v, const char *value) {
	free(v->string);
	v->string = strdup(value);
	v->value = (float)atof(value);
	v->integer = atoi(value);
	v->modified_count++;
	if (!v->modified_count) v->modified_count = 1;
}
static cvar_t *PF_cvar(const char *name, const char *value, cvar_flags_t flags) {
	auto it = cvars.find(name);
	if (it != cvars.end()) {
		it->second->flags = (cvar_flags_t)(it->second->flags | flags);
		return it->second;
	}
	if (!value) return nullptr;
	cvar_t *v = (cvar_t *)calloc(1, sizeof(cvar_t));
	v->name = strdup(name);
	v->flags = flags;
	cvar_store(v, value);
	cvars[name] = v;
	return v;
}
static cvar_t *PF_cvar_set(const char *name, const char *value) {
	cvar_t *v = PF_cvar(name, value, CVAR_NOFLAGS);
	cvar_store(v, value);
	return v;
}

static std::vector<std::string> args;
static std::string args_rest;
static void tokenize(const char *line) {
	args.clear();
	args_rest.clear();
	const char *p = line;
	while (*p) {
		while (*p == ' ') p++;
		if (!*p) break;
		if (args.size() == 1) args_rest = p;
		const char *s = p;
		while (*p && *p != ' ') p++;
		args.emplace_back(s, p - s);
	}
}
static int PF_argc() { return (int)args.size(); }
static const char *PF_argv(int n) { return n >= 0 && n < (int)args.size() ? args[n].c_str() : ""; }
static const char *PF_args() { return args_rest.c_str(); }

static std::multimap<int, void *> tags;
static void *PF_TagMalloc(size_t size, int tag) {
	void *p = calloc(1, size ? size : 1);
	tags.emplace(tag, p);
	return p;
}
static void PF_TagFree(void *block) {
	for (auto it = tags.begin(); it != tags.end(); ++it)
		if (it->second == block) { tags.erase(it); break; }
	free(block);
}
static void PF_FreeTags(int tag) {
	auto range = tags.equal_range(tag);
	for (auto it = range.first; it != range.second; ++it) free(it->second);
	tags.erase(tag);
}

/* Info strings: \key\value\key\value */
static size_t PF_Info_ValueForKey(const char *s, const char *key, char *buffer, size_t len) {
	if (len) buffer[0] = 0;
	if (!s) return 0;
	const char *p = s;
	while (*p) {
		if (*p == '\\') p++;
		const char *k = p;
		while (*p && *p != '\\') p++;
		std::string kk(k, p - k);
		if (*p) p++;
		const char *v = p;
		while (*p && *p != '\\') p++;
		std::string vv(v, p - v);
		if (kk == key) {
			if (len) Q_strlcpy(buffer, vv.c_str(), len);
			return vv.size();
		}
	}
	return 0;
}
static bool PF_Info_RemoveKey(char *s, const char *key) {
	std::string in(s), result;
	size_t i = 0;
	bool removed = false;
	while (i < in.size()) {
		if (in[i] == '\\') i++;
		size_t k = in.find('\\', i);
		if (k == std::string::npos) break;
		size_t v = in.find('\\', k + 1);
		if (v == std::string::npos) v = in.size();
		std::string kk = in.substr(i, k - i), vv = in.substr(k + 1, v - k - 1);
		if (kk == key) removed = true;
		else result += "\\" + kk + "\\" + vv;
		i = v;
	}
	strcpy(s, result.c_str());
	return removed;
}
static bool PF_Info_SetValueForKey(char *s, const char *key, const char *value) {
	PF_Info_RemoveKey(s, key);
	if (!value || !value[0]) return true;
	strcat(s, "\\");
	strcat(s, key);
	strcat(s, "\\");
	strcat(s, value);
	return true;
}

/* ---------------- what the host does not need yet ---------------- */

static void PF_Broadcast_Print(print_type_t, const char *) {}
static void PF_Com_Print(const char *msg) {
	if (getenv("Q2RGAME_LOG")) fputs(msg, stderr);
}
static void PF_Client_Print(edict_t *, print_type_t, const char *) {}
static void PF_Center_Print(edict_t *, const char *) {}
static void PF_sound(edict_t *, soundchan_t, int, float, float, float) {}
static void PF_positioned_sound(gvec3_cref_t, edict_t *, soundchan_t, int, float, float, float) {}
static void PF_local_sound(edict_t *, gvec3_cptr_t, edict_t *, soundchan_t, int, float, float, float, uint32_t) {}
[[noreturn]] static void PF_Com_Error(const char *message) {
	fprintf(stderr, "Com_Error: %s\n", message);
	exit(3);
}
static void PF_multicast(gvec3_cref_t, multicast_t, bool) {}
static void PF_unicast(edict_t *, bool, uint32_t) {}
static void PF_WriteInt(int) {}
static void PF_WriteFloat(float) {}
static void PF_WriteString(const char *) {}
static void PF_WriteVec(gvec3_cref_t) {}
static void PF_WriteEntity(const edict_t *) {}
static void PF_AddCommandString(const char *text) {
	if (getenv("Q2RGAME_LOG")) fprintf(stderr, "command: %s", text);
}
static void PF_DebugGraph(float, int) {}
static void *PF_GetExtension(const char *) { return nullptr; }
static void PF_Bot_Edict(const edict_t *) {}
static GoalReturnCode PF_Bot_MoveToPoint(const edict_t *, gvec3_cref_t, const float) { return GoalReturnCode::Error; }
static GoalReturnCode PF_Bot_FollowActor(const edict_t *, const edict_t *) { return GoalReturnCode::Error; }
static bool PF_GetPathToGoal(const PathRequest &, PathInfo &info) {
	info.returnCode = PathReturnCode::NoNavAvailable;
	return false;
}
static void PF_Loc_Print(edict_t *, print_type_t, const char *, const char **, size_t) {}
static void PF_Draw_Line(gvec3_cref_t, gvec3_cref_t, const rgba_t &, const float, const bool) {}
static void PF_Draw_Point(gvec3_cref_t, const float, const rgba_t &, const float, const bool) {}
static void PF_Draw_Circle(gvec3_cref_t, const float, const rgba_t &, const float, const bool) {}
static void PF_Draw_Bounds(gvec3_cref_t, gvec3_cref_t, const rgba_t &, const float, const bool) {}
static void PF_Draw_OrientedWorldText(gvec3_cref_t, const char *, const rgba_t &, const float, const float, const bool) {}
static void PF_Draw_StaticWorldText(gvec3_cref_t, gvec3_cref_t, const char *, const rgba_t &, const float, const float, const bool) {}
static void PF_Draw_Cylinder(gvec3_cref_t, const float, const float, const rgba_t &, const float, const bool) {}
static void PF_Draw_Ray(gvec3_cref_t, gvec3_cref_t, const float, const float, const rgba_t &, const float, const bool) {}
static void PF_Draw_Arrow(gvec3_cref_t, gvec3_cref_t, const float, const rgba_t &, const rgba_t &, const float, const bool) {}
static void PF_ReportMatchDetails(bool) {}
static uint32_t PF_ServerFrame() { return server_frame; }
static void PF_SendToClipBoard(const char *) {}

/* ---------------- the scripted player ---------------- */

/* Eight phases of 40 ticks (one second each): walk, strafe, jump, fire, crouch, fire, weapnext, weave. */
static void script(usercmd_t &cmd, int t) {
	int phase = (t / 40) % 8;
	cmd = {};
	cmd.msec = 25;
	cmd.angles[YAW] = (float)((t * 3) % 360);
	cmd.angles[PITCH] = (t % 60) < 30 ? 10.f : -10.f;
	switch (phase) {
	case 0: cmd.forwardmove = 400; break;
	case 1: cmd.forwardmove = 200; cmd.sidemove = 200; break;
	case 2: cmd.forwardmove = 400; if (t % 20 < 2) cmd.buttons = BUTTON_JUMP; break;
	case 3: cmd.sidemove = -400; cmd.buttons = (t % 8) < 4 ? BUTTON_ATTACK : BUTTON_NONE; break;
	case 4: cmd.forwardmove = -200; cmd.buttons = BUTTON_CROUCH; break;
	case 5: cmd.forwardmove = 400; cmd.buttons = BUTTON_ATTACK; break;
	case 6: cmd.forwardmove = 300; break;
	case 7: cmd.forwardmove = 400; cmd.sidemove = (t % 16) < 8 ? 300.f : -300.f; break;
	}
	cmd.server_frame = server_frame;
}

/* ---------------- the dump ---------------- */

#define J3(v) (double)(v)[0], (double)(v)[1], (double)(v)[2]

static void dump(int tick, const usercmd_t &cmd) {
	fprintf(out, "{\"t\":\"cmd\",\"tick\":%d,\"msec\":%d,\"buttons\":%d,\"angles\":[%.9g,%.9g,%.9g],\"move\":[%.9g,%.9g]}\n",
		tick, cmd.msec, (int)cmd.buttons, J3(cmd.angles), (double)cmd.forwardmove, (double)cmd.sidemove);
	fprintf(out, "{\"t\":\"ents\",\"tick\":%d,\"num_edicts\":%u,\"e\":[", tick, ge->num_edicts);
	bool first = true;
	for (uint32_t n = 0; n < ge->num_edicts; n++) {
		edict_t *e = EDICT(n);
		if (!e->inuse) continue;
		const entity_state_t &s = e->s;
		fprintf(out, "%s{\"n\":%u,\"classname\":\"%s\",\"origin\":[%.9g,%.9g,%.9g],\"angles\":[%.9g,%.9g,%.9g],\"old_origin\":[%.9g,%.9g,%.9g],"
			"\"model\":[%d,%d,%d,%d],\"frame\":%d,\"skin\":%d,\"effects\":%llu,\"renderfx\":%u,\"ssolid\":%u,\"sound\":%d,"
			"\"event\":%d,\"alpha\":%.9g,\"scale\":%.9g,\"owner\":%d,\"svflags\":%u,\"solid\":%d,\"linked\":%d,"
			"\"mins\":[%.9g,%.9g,%.9g],\"maxs\":[%.9g,%.9g,%.9g],\"clipmask\":%u",
			first ? "" : ",", n, rg_classname(e), J3(s.origin), J3(s.angles), J3(s.old_origin), s.modelindex, s.modelindex2, s.modelindex3,
			s.modelindex4, s.frame, s.skinnum, (unsigned long long)s.effects, (unsigned)s.renderfx, s.solid, s.sound,
			(int)s.event, (double)s.alpha, (double)s.scale, s.owner, (unsigned)e->svflags, (int)e->solid, e->linked ? 1 : 0,
			J3(e->mins), J3(e->maxs), (unsigned)e->clipmask);
		if (e->client) {
			const player_state_t &ps = e->client->ps;
			const pmove_state_t &pm = ps.pmove;
			fprintf(out, ",\"ps\":{\"pm_type\":%d,\"origin\":[%.9g,%.9g,%.9g],\"velocity\":[%.9g,%.9g,%.9g],\"pm_flags\":%d,"
				"\"pm_time\":%d,\"gravity\":%d,\"delta\":[%.9g,%.9g,%.9g],\"viewheight\":%d,\"viewangles\":[%.9g,%.9g,%.9g],"
				"\"viewoffset\":[%.9g,%.9g,%.9g],\"kick\":[%.9g,%.9g,%.9g],\"gunangles\":[%.9g,%.9g,%.9g],"
				"\"gunoffset\":[%.9g,%.9g,%.9g],\"gunindex\":%d,\"gunskin\":%d,\"gunframe\":%d,\"gunrate\":%d,"
				"\"blend\":[%.9g,%.9g,%.9g,%.9g],\"damage_blend\":[%.9g,%.9g,%.9g,%.9g],\"fov\":%.9g,\"rdflags\":%d,\"stats\":[",
				(int)pm.pm_type, J3(pm.origin), J3(pm.velocity), (int)pm.pm_flags, (int)pm.pm_time, (int)pm.gravity,
				J3(pm.delta_angles), (int)pm.viewheight, J3(ps.viewangles), J3(ps.viewoffset), J3(ps.kick_angles),
				J3(ps.gunangles), J3(ps.gunoffset), ps.gunindex, ps.gunskin, ps.gunframe, ps.gunrate,
				(double)ps.screen_blend[0], (double)ps.screen_blend[1], (double)ps.screen_blend[2], (double)ps.screen_blend[3],
				(double)ps.damage_blend[0], (double)ps.damage_blend[1], (double)ps.damage_blend[2], (double)ps.damage_blend[3],
				(double)ps.fov, (int)ps.rdflags);
			for (size_t i = 0; i < MAX_STATS; i++) fprintf(out, "%s%d", i ? "," : "", (int)ps.stats[i]);
			fprintf(out, "]}");
		}
		fprintf(out, "}");
		first = false;
	}
	fprintf(out, "]}\n");
}

/** Every configstring that is set, as {"t":"cs","cs":{"index":"value",...}}. */
static void dump_configstrings() {
	fprintf(out, "{\"t\":\"cs\",\"cs\":{");
	bool first = true;
	for (size_t i = 0; i < configstrings.size(); i++) {
		if (configstrings[i].empty()) continue;
		fprintf(out, "%s\"%zu\":\"", first ? "" : ",", i);
		for (unsigned char c : configstrings[i]) {
			if (c == '"' || c == '\\') fprintf(out, "\\%c", c);
			else if (c < 0x20 || c >= 0x7f) fprintf(out, "\\u%04x", c);
			else fputc(c, out);
		}
		fputc('"', out);
		first = false;
	}
	fprintf(out, "}}\n");
}

/* ---------------- main ---------------- */

int main(int argc, char **argv) {
	if (argc < 4) {
		fprintf(stderr, "usage: q2rgame <map.bsp> <mapname> <out.jsonl> [ticks=1200] [cvar=value...]\n");
		return 1;
	}
	const char *mapname = argv[2];
	int ticks = argc > 4 ? atoi(argv[4]) : 1200;
	out = fopen(argv[3], "w");
	if (!out) { perror(argv[3]); return 1; }

	shim_load(argv[1]);
	int nmodels = ws_num_inline_models();
	for (int i = 0; i < nmodels; i++) {
		float mn[3], mx[3];
		int headnode;
		ws_inline_model(i, mn, mx, &headnode);
		submodel_headnode.push_back(headnode);
	}

	PF_cvar("maxclients", "1", CVAR_SERVERINFO | CVAR_LATCH);
	PF_cvar("deathmatch", "0", CVAR_LATCH);
	PF_cvar("coop", "0", CVAR_LATCH);
	PF_cvar("skill", "1", CVAR_LATCH);
	for (int i = 5; i < argc; i++) {
		const char *eq = strchr(argv[i], '=');
		if (!eq) continue;
		PF_cvar_set(std::string(argv[i], eq - argv[i]).c_str(), eq + 1);
	}

	gi.tick_rate = 40;
	gi.frame_time_s = 1.f / gi.tick_rate;
	gi.frame_time_ms = 1000 / gi.tick_rate;
	gi.Broadcast_Print = PF_Broadcast_Print;
	gi.Com_Print = PF_Com_Print;
	gi.Client_Print = PF_Client_Print;
	gi.Center_Print = PF_Center_Print;
	gi.sound = PF_sound;
	gi.positioned_sound = PF_positioned_sound;
	gi.local_sound = PF_local_sound;
	gi.configstring = PF_configstring;
	gi.get_configstring = PF_get_configstring;
	gi.Com_Error = PF_Com_Error;
	gi.modelindex = PF_modelindex;
	gi.soundindex = PF_soundindex;
	gi.imageindex = PF_imageindex;
	gi.setmodel = PF_setmodel;
	gi.trace = PF_trace;
	gi.clip = PF_clip;
	gi.pointcontents = PF_pointcontents;
	gi.inPVS = PF_inPVS;
	gi.inPHS = PF_inPHS;
	gi.SetAreaPortalState = PF_SetAreaPortalState;
	gi.AreasConnected = PF_AreasConnected;
	gi.linkentity = PF_linkentity;
	gi.unlinkentity = PF_unlinkentity;
	gi.BoxEdicts = PF_BoxEdicts;
	gi.multicast = PF_multicast;
	gi.unicast = PF_unicast;
	gi.WriteChar = PF_WriteInt;
	gi.WriteByte = PF_WriteInt;
	gi.WriteShort = PF_WriteInt;
	gi.WriteLong = PF_WriteInt;
	gi.WriteFloat = PF_WriteFloat;
	gi.WriteString = PF_WriteString;
	gi.WritePosition = PF_WriteVec;
	gi.WriteDir = PF_WriteVec;
	gi.WriteAngle = PF_WriteFloat;
	gi.WriteEntity = PF_WriteEntity;
	gi.TagMalloc = PF_TagMalloc;
	gi.TagFree = PF_TagFree;
	gi.FreeTags = PF_FreeTags;
	gi.cvar = PF_cvar;
	gi.cvar_set = PF_cvar_set;
	gi.cvar_forceset = PF_cvar_set;
	gi.argc = PF_argc;
	gi.argv = PF_argv;
	gi.args = PF_args;
	gi.AddCommandString = PF_AddCommandString;
	gi.DebugGraph = PF_DebugGraph;
	gi.GetExtension = PF_GetExtension;
	gi.Bot_RegisterEdict = PF_Bot_Edict;
	gi.Bot_UnRegisterEdict = PF_Bot_Edict;
	gi.Bot_MoveToPoint = PF_Bot_MoveToPoint;
	gi.Bot_FollowActor = PF_Bot_FollowActor;
	gi.GetPathToGoal = PF_GetPathToGoal;
	gi.Loc_Print = PF_Loc_Print;
	gi.Draw_Line = PF_Draw_Line;
	gi.Draw_Point = PF_Draw_Point;
	gi.Draw_Circle = PF_Draw_Circle;
	gi.Draw_Bounds = PF_Draw_Bounds;
	gi.Draw_Sphere = PF_Draw_Circle;
	gi.Draw_OrientedWorldText = PF_Draw_OrientedWorldText;
	gi.Draw_StaticWorldText = PF_Draw_StaticWorldText;
	gi.Draw_Cylinder = PF_Draw_Cylinder;
	gi.Draw_Ray = PF_Draw_Ray;
	gi.Draw_Arrow = PF_Draw_Arrow;
	gi.ReportMatchDetails_Multicast = PF_ReportMatchDetails;
	gi.ServerFrame = PF_ServerFrame;
	gi.SendToClipBoard = PF_SendToClipBoard;
	gi.Info_ValueForKey = PF_Info_ValueForKey;
	gi.Info_RemoveKey = PF_Info_RemoveKey;
	gi.Info_SetValueForKey = PF_Info_SetValueForKey;

	ge = GetGameAPI(&gi);
	ge->PreInit();
	ge->Init();
	mt_rand.seed(5489u);

	// SV_SpawnServer: the world and its submodels are the first models, then the entities
	configstrings[CS_NAME] = mapname;
	configstrings[CS_MODELS + 1] = std::string("maps/") + mapname + ".bsp";
	for (int i = 1; i < nmodels; i++) configstrings[CS_MODELS + 1 + i] = "*" + std::to_string(i);
	clear_world();
	ge->SpawnEntities(mapname, ws_entity_string(), "");
	// run two frames to allow everything to settle
	ge->RunFrame(false);
	server_frame++;
	ge->RunFrame(false);
	server_frame++;

	// the player connects and begins (edict 1, maxclients 1)
	edict_t *player = EDICT(1);
	char userinfo[MAX_INFO_STRING] = "\\name\\player\\skin\\male/grunt\\hand\\0\\fov\\90";
	if (!ge->ClientConnect(player, userinfo, "", false)) {
		fprintf(stderr, "ClientConnect refused\n");
		return 2;
	}
	ge->ClientBegin(player);
	dump_configstrings();

	for (int tick = 0; tick < ticks; tick++) {
		usercmd_t cmd;
		script(cmd, tick);
		if (tick % 320 == 240) { // weapnext as phase 6 starts
			tokenize("weapnext");
			ge->ClientCommand(player);
		}
		ge->ClientThink(player, &cmd);
		ge->RunFrame(true);
		server_frame++;
		dump(tick, cmd);
		ge->PrepFrame();
	}
	fclose(out);
	return 0;
}
