/*
 * C reference oracle for the TypeScript port of id's 3.21 player movement
 * (packages/shared/src/original/pmove.ts): qcommon/pmove.c, linked unchanged, with cmodel.c's
 * CM_BoxTrace answering its traces against a map's world, as the client's prediction does.
 *
 * Usage: q2pmove321 <path-to.bsp>
 * stdin, one command per line:
 *   state pm_type ox oy oz vx vy vz pm_flags pm_time gravity dax day daz   (shorts, as on the wire)
 *   move msec buttons ax ay az forwardmove sidemove upmove snapinitial entmode
 * entmode 0 is the client's CL_PMTrace (the world is hit only when fraction < 1), 1 the server's
 * SV_Trace (the world always). The state persists between moves; `state` resets it.
 */
#include "full/qcommon/qcommon.h"

static int entmode;
static char world_handle[64];

static trace_t pm_trace(vec3_t start, vec3_t mins, vec3_t maxs, vec3_t end) {
	trace_t t = CM_BoxTrace(start, end, mins, maxs, 0, MASK_PLAYERSOLID);
	if (entmode || t.fraction < 1.0) t.ent = (struct edict_s *)world_handle;
	if (getenv("Q2PMOVE_LOG"))
		fprintf(stderr, "trace %.9g %.9g %.9g -> %.9g %.9g %.9g f %.9g end %.9g %.9g %.9g n %g %g %g ss %d as %d\n", start[0], start[1], start[2], end[0], end[1], end[2],
			t.fraction, t.endpos[0], t.endpos[1], t.endpos[2], t.plane.normal[0], t.plane.normal[1], t.plane.normal[2], t.startsolid, t.allsolid);
	return t;
}
static int pm_contents(vec3_t p) { return CM_PointContents(p, 0); }

void shim_load(const char *path);

#define V(v) (double)(v)[0], (double)(v)[1], (double)(v)[2]

int main(int argc, char **argv) {
	pmove_state_t s;
	char op[32];
	if (argc < 2) { fprintf(stderr, "usage: q2pmove321 map.bsp\n"); return 1; }
	shim_load(argv[1]);
	memset(&s, 0, sizeof(s));
	printf("{\"ready\":true}\n");
	fflush(stdout);
	while (scanf("%31s", op) == 1) {
		if (!strcmp(op, "state")) {
			int type, o[3], v[3], flags, time, gravity, d[3];
			if (scanf("%d %d %d %d %d %d %d %d %d %d %d %d %d", &type, &o[0], &o[1], &o[2], &v[0], &v[1], &v[2],
				&flags, &time, &gravity, &d[0], &d[1], &d[2]) != 13) break;
			memset(&s, 0, sizeof(s));
			s.pm_type = type;
			s.origin[0] = o[0]; s.origin[1] = o[1]; s.origin[2] = o[2];
			s.velocity[0] = v[0]; s.velocity[1] = v[1]; s.velocity[2] = v[2];
			s.pm_flags = flags; s.pm_time = time; s.gravity = gravity;
			s.delta_angles[0] = d[0]; s.delta_angles[1] = d[1]; s.delta_angles[2] = d[2];
			printf("{\"ok\":true}\n");
		} else if (!strcmp(op, "move")) {
			int msec, buttons, a[3], fwd, side, up, snap;
			pmove_t pm;
			if (scanf("%d %d %d %d %d %d %d %d %d %d", &msec, &buttons, &a[0], &a[1], &a[2], &fwd, &side, &up, &snap, &entmode) != 10) break;
			memset(&pm, 0, sizeof(pm));
			pm.s = s;
			pm.cmd.msec = msec;
			pm.cmd.buttons = buttons;
			pm.cmd.angles[0] = a[0]; pm.cmd.angles[1] = a[1]; pm.cmd.angles[2] = a[2];
			pm.cmd.forwardmove = fwd; pm.cmd.sidemove = side; pm.cmd.upmove = up;
			pm.snapinitial = snap;
			pm.trace = pm_trace;
			pm.pointcontents = pm_contents;
			Pmove(&pm);
			s = pm.s;
			printf("{\"origin\":[%d,%d,%d],\"velocity\":[%d,%d,%d],\"pm_flags\":%d,\"pm_time\":%d,\"viewheight\":%.9g,"
				"\"viewangles\":[%.9g,%.9g,%.9g],\"mins\":[%.9g,%.9g,%.9g],\"maxs\":[%.9g,%.9g,%.9g],"
				"\"ground\":%s,\"watertype\":%d,\"waterlevel\":%d,\"numtouch\":%d}\n",
				s.origin[0], s.origin[1], s.origin[2], s.velocity[0], s.velocity[1], s.velocity[2], s.pm_flags, s.pm_time,
				(double)pm.viewheight, V(pm.viewangles), V(pm.mins), V(pm.maxs), pm.groundentity ? "true" : "false",
				pm.watertype, pm.waterlevel, pm.numtouch);
		} else {
			printf("{\"error\":\"unknown op %s\"}\n", op);
		}
		fflush(stdout);
	}
	return 0;
}
