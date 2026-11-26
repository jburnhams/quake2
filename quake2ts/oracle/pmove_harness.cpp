/*
 * C reference oracle for the TypeScript player movement (packages/shared/src/pmove).
 *
 * Links the rerelease's p_move.cpp (GPL, fetched into ../.id-source/rerelease) unchanged, the
 * source the TS port follows, with id's cmodel.c (through cm_shim) answering its traces
 * against a map's world. Each `move` runs one Pmove frame and prints the result as JSON.
 *
 * Usage: q2pmove <path-to.bsp>
 * stdin, one command per line:
 *   config airaccel n64
 *   state pm_type ox oy oz vx vy vz pm_flags pm_time gravity dax day daz
 *   move msec buttons ax ay az forwardmove sidemove snapinitial
 * The state persists between moves (as pm->s does between a client's frames), so a
 * sequence of `move`s is a trajectory; `state` resets it.
 */
#include "rerelease/q_std.h"
#define GAME_INCLUDE
#include "rerelease/bg_local.h"
#include "cm_shim.h"
#include <map>

static char world_handle[64];
static edict_t *const WORLD = reinterpret_cast<edict_t *>(world_handle);
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

static trace_t world_trace(const vec3_t &start, const vec3_t *mins, const vec3_t *maxs, const vec3_t &end, contents_t mask) {
	shim_trace_t st;
	float s[3] = {start[0], start[1], start[2]}, e[3] = {end[0], end[1], end[2]};
	float mn[3] = {0, 0, 0}, mx[3] = {0, 0, 0};
	if (mins) { mn[0] = (*mins)[0]; mn[1] = (*mins)[1]; mn[2] = (*mins)[2]; }
	if (maxs) { mx[0] = (*maxs)[0]; mx[1] = (*maxs)[1]; mx[2] = (*maxs)[2]; }
	shim_trace(s, e, mn, mx, (int)mask, &st);
	if (getenv("Q2PMOVE_LOG"))
		fprintf(stderr, "trace %.6f %.6f %.6f -> %.6f %.6f %.6f [%g %g %g / %g %g %g] m%d = f%.6f end %.6f %.6f %.6f n %g %g %g ss%d as%d\n",
			s[0], s[1], s[2], e[0], e[1], e[2], mn[0], mn[1], mn[2], mx[0], mx[1], mx[2], (int)mask, st.fraction,
			st.endpos[0], st.endpos[1], st.endpos[2], st.normal[0], st.normal[1], st.normal[2], st.startsolid, st.allsolid);
	trace_t t {};
	t.fraction = st.fraction;
	t.endpos = { st.endpos[0], st.endpos[1], st.endpos[2] };
	t.plane.normal = { st.normal[0], st.normal[1], st.normal[2] };
	t.plane.dist = st.dist;
	t.plane.type = (byte)st.type;
	t.plane.signbits = (byte)st.signbits;
	t.contents = (contents_t)st.contents;
	t.surface = surface_for(st.surfaceFlags, st.surfaceValue);
	t.startsolid = st.startsolid != 0;
	t.allsolid = st.allsolid != 0;
	t.ent = WORLD; // SV_Trace sets the world as the default entity
	return t;
}

static trace_t pm_trace_cb(gvec3_cref_t start, gvec3_cptr_t mins, gvec3_cptr_t maxs, gvec3_cref_t end, const edict_t *, contents_t mask) {
	return world_trace(start, mins, maxs, end, mask);
}
static trace_t pm_clip_cb(gvec3_cref_t start, gvec3_cptr_t mins, gvec3_cptr_t maxs, gvec3_cref_t end, contents_t mask) {
	return world_trace(start, mins, maxs, end, mask);
}
static contents_t pm_contents_cb(gvec3_cref_t p) {
	float v[3] = {p[0], p[1], p[2]};
	return (contents_t)shim_contents(v);
}

#define V(v) (double)(v)[0], (double)(v)[1], (double)(v)[2]

int main(int argc, char **argv) {
	if (argc < 2) { fprintf(stderr, "usage: q2pmove map.bsp\n"); return 1; }
	shim_load(argv[1]);
	printf("{\"ready\":true}\n");
	fflush(stdout);

	pmove_state_t s {};
	char op[32];
	while (scanf("%31s", op) == 1) {
		if (!strcmp(op, "config")) {
			int airaccel, n64;
			if (scanf("%d %d", &airaccel, &n64) != 2) break;
			pm_config.airaccel = airaccel;
			pm_config.n64_physics = n64 != 0;
			printf("{\"ok\":true}\n");
		} else if (!strcmp(op, "state")) {
			int type, flags, time, gravity;
			float o[3], v[3], d[3];
			if (scanf("%d %f %f %f %f %f %f %d %d %d %f %f %f", &type, &o[0], &o[1], &o[2], &v[0], &v[1], &v[2],
				&flags, &time, &gravity, &d[0], &d[1], &d[2]) != 13) break;
			s = {};
			s.pm_type = (pmtype_t)type;
			s.origin = { o[0], o[1], o[2] };
			s.velocity = { v[0], v[1], v[2] };
			s.pm_flags = (pmflags_t)flags;
			s.pm_time = (uint16_t)time;
			s.gravity = (int16_t)gravity;
			s.delta_angles = { d[0], d[1], d[2] };
			printf("{\"ok\":true}\n");
		} else if (!strcmp(op, "move")) {
			int msec, buttons, snap;
			float a[3], fwd, side;
			if (scanf("%d %d %f %f %f %f %f %d", &msec, &buttons, &a[0], &a[1], &a[2], &fwd, &side, &snap) != 8) break;
			pmove_t pm {};
			pm.s = s;
			pm.cmd.msec = (byte)msec;
			pm.cmd.buttons = (button_t)buttons;
			pm.cmd.angles = { a[0], a[1], a[2] };
			pm.cmd.forwardmove = fwd;
			pm.cmd.sidemove = side;
			pm.snapinitial = snap != 0;
			pm.player = WORLD;
			pm.trace = pm_trace_cb;
			pm.clip = pm_clip_cb;
			pm.pointcontents = pm_contents_cb;
			Pmove(&pm);
			s = pm.s;
			printf("{\"origin\":[%.9g,%.9g,%.9g],\"velocity\":[%.9g,%.9g,%.9g],\"pmFlags\":%d,\"pmTime\":%d,"
				"\"viewheight\":%d,\"viewangles\":[%.9g,%.9g,%.9g],\"mins\":[%.9g,%.9g,%.9g],\"maxs\":[%.9g,%.9g,%.9g],"
				"\"onGround\":%s,\"groundNormal\":[%.9g,%.9g,%.9g],\"watertype\":%d,\"waterlevel\":%d,"
				"\"jumpSound\":%s,\"stepClip\":%s,\"impactDelta\":%.9g,\"touch\":%d,\"rdflags\":%d}\n",
				V(pm.s.origin), V(pm.s.velocity), (int)pm.s.pm_flags, (int)pm.s.pm_time, (int)pm.s.viewheight,
				V(pm.viewangles), V(pm.mins), V(pm.maxs), pm.groundentity ? "true" : "false", V(pm.groundplane.normal),
				(int)pm.watertype, (int)pm.waterlevel, pm.jump_sound ? "true" : "false", pm.step_clip ? "true" : "false",
				(double)pm.impact_delta, (int)pm.touch.num, (int)pm.rdflags);
		} else {
			printf("{\"error\":\"unknown op %s\"}\n", op);
		}
		fflush(stdout);
	}
	return 0;
}
