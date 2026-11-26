/*
 * C reference oracle for the TypeScript collision code.
 *
 * Links id Software's GPL cmodel.c (full/qcommon) unchanged and answers
 * queries as JSON lines, so tests can run the same inputs through the C
 * original and the TS port and compare the answers.
 *
 * Usage: q2oracle <path-to.bsp>
 * stdin, one query per line (whitespace-separated, no JSON parsing needed):
 *   trace sx sy sz ex ey ez minx miny minz maxx maxy maxz mask headnode
 *   contents px py pz headnode
 * stdout, one JSON object per query.
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdarg.h>
#include "../../full/qcommon/qcommon.h"

extern char *bsp_path;

/* ---- query loop ---- */

static void print_trace(trace_t *t) {
	printf("{\"fraction\":%.9g,\"endpos\":[%.9g,%.9g,%.9g],\"normal\":[%.9g,%.9g,%.9g],\"dist\":%.9g,"
		"\"contents\":%d,\"surfaceFlags\":%d,\"startsolid\":%s,\"allsolid\":%s}\n",
		t->fraction, t->endpos[0], t->endpos[1], t->endpos[2],
		t->plane.normal[0], t->plane.normal[1], t->plane.normal[2], t->plane.dist,
		t->contents, t->surface ? t->surface->flags : 0,
		t->startsolid ? "true" : "false", t->allsolid ? "true" : "false");
}

int main(int argc, char **argv) {
	if (argc < 2) { fprintf(stderr, "usage: q2oracle map.bsp\n"); return 1; }
	bsp_path = argv[1];
	Swap_Init();
	unsigned checksum;
	CM_LoadMap("oracle.bsp", false, &checksum);
	printf("{\"ready\":true,\"inlineModels\":%d,\"clusters\":%d}\n", CM_NumInlineModels(), CM_NumClusters());
	fflush(stdout);

	char op[32];
	while (scanf("%31s", op) == 1) {
		if (!strcmp(op, "trace")) {
			vec3_t s, e, mins, maxs; int mask, headnode;
			if (scanf("%f %f %f %f %f %f %f %f %f %f %f %f %d %d", &s[0], &s[1], &s[2], &e[0], &e[1], &e[2],
				&mins[0], &mins[1], &mins[2], &maxs[0], &maxs[1], &maxs[2], &mask, &headnode) != 14) break;
			trace_t t = CM_BoxTrace(s, e, mins, maxs, headnode, mask);
			print_trace(&t);
		} else if (!strcmp(op, "ttrace") || !strcmp(op, "btrace")) {
			/* ttrace: a submodel (headnode) moved to origin and turned by angles.
			   btrace: a box hull of bmins/bmaxs moved to origin (boxes never rotate). */
			int box = !strcmp(op, "btrace");
			vec3_t s, e, mins, maxs, bmins, bmaxs, o, a = {0, 0, 0}; int mask, headnode = 0;
			if (scanf("%f %f %f %f %f %f %f %f %f %f %f %f %d", &s[0], &s[1], &s[2], &e[0], &e[1], &e[2],
				&mins[0], &mins[1], &mins[2], &maxs[0], &maxs[1], &maxs[2], &mask) != 13) break;
			if (box) {
				if (scanf("%f %f %f %f %f %f %f %f %f", &bmins[0], &bmins[1], &bmins[2], &bmaxs[0], &bmaxs[1], &bmaxs[2],
					&o[0], &o[1], &o[2]) != 9) break;
				headnode = CM_HeadnodeForBox(bmins, bmaxs);
			} else if (scanf("%d %f %f %f %f %f %f", &headnode, &o[0], &o[1], &o[2], &a[0], &a[1], &a[2]) != 7) break;
			trace_t t = CM_TransformedBoxTrace(s, e, mins, maxs, headnode, mask, o, a);
			print_trace(&t);
		} else if (!strcmp(op, "tcontents")) {
			vec3_t p, o, a; int headnode;
			if (scanf("%f %f %f %d %f %f %f %f %f %f", &p[0], &p[1], &p[2], &headnode, &o[0], &o[1], &o[2], &a[0], &a[1], &a[2]) != 10) break;
			printf("{\"contents\":%d}\n", CM_TransformedPointContents(p, headnode, o, a));
		} else if (!strcmp(op, "contents")) {
			vec3_t p; int headnode;
			if (scanf("%f %f %f %d", &p[0], &p[1], &p[2], &headnode) != 4) break;
			printf("{\"contents\":%d}\n", CM_PointContents(p, headnode));
		} else if (!strcmp(op, "model")) {
			int i; if (scanf("%d", &i) != 1) break;
			char name[16]; snprintf(name, sizeof name, "*%d", i);
			cmodel_t *m = CM_InlineModel(name);
			printf("{\"headnode\":%d,\"mins\":[%.9g,%.9g,%.9g],\"maxs\":[%.9g,%.9g,%.9g]}\n", m->headnode,
				m->mins[0], m->mins[1], m->mins[2], m->maxs[0], m->maxs[1], m->maxs[2]);
		} else {
			printf("{\"error\":\"unknown op %s\"}\n", op);
		}
		fflush(stdout);
	}
	return 0;
}
