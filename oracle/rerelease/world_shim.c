/*
 * Plain-C view of id's 3.21 cmodel.c for the rerelease game host (host.cpp), whose own types
 * (trace_t, cplane_t, edict_t) are the rerelease's and cannot share a translation unit with
 * qcommon.h. Everything here is a thin call into cmodel.c.
 */
#include <string.h>
#include "full/qcommon/qcommon.h"
#include "cm_shim.h"
#include "world_shim.h"

/* cmodel.c's box hull; its cbrush_t and cleaf_t are private to it, but both start with contents. */
typedef struct { int contents; } contents_first_t;
extern contents_first_t *box_brush, *box_leaf;

static void put(shim_trace_t *out, trace_t t) {
	out->fraction = t.fraction;
	for (int i = 0; i < 3; i++) { out->endpos[i] = t.endpos[i]; out->normal[i] = t.plane.normal[i]; }
	out->dist = t.plane.dist;
	out->type = t.plane.type;
	out->signbits = t.plane.signbits;
	out->contents = t.contents;
	out->surfaceFlags = t.surface ? t.surface->flags : 0;
	out->surfaceValue = t.surface ? t.surface->value : 0;
	out->startsolid = t.startsolid;
	out->allsolid = t.allsolid;
}

static void v3(vec3_t out, const float *in) {
	if (in) { out[0] = in[0]; out[1] = in[1]; out[2] = in[2]; }
	else { out[0] = out[1] = out[2] = 0; }
}

const char *ws_entity_string(void) { return CM_EntityString(); }
int ws_num_inline_models(void) { return CM_NumInlineModels(); }

void ws_inline_model(int n, float *mins, float *maxs, int *headnode) {
	extern cmodel_t map_cmodels[];
	cmodel_t *m = &map_cmodels[n]; /* CM_InlineModel refuses *0, the world */
	for (int i = 0; i < 3; i++) { mins[i] = m->mins[i]; maxs[i] = m->maxs[i]; }
	*headnode = m->headnode;
}

int ws_headnode_for_box(const float *mins, const float *maxs, int contents) {
	vec3_t a, b;
	v3(a, mins); v3(b, maxs);
	int h = CM_HeadnodeForBox(a, b);
	box_brush->contents = contents;
	box_leaf->contents = contents;
	return h;
}

int ws_point_contents(const float *p, int headnode, const float *origin, const float *angles) {
	vec3_t vp, o, a;
	v3(vp, p); v3(o, origin); v3(a, angles);
	if (!origin) return CM_PointContents(vp, headnode);
	return CM_TransformedPointContents(vp, headnode, o, a);
}

void ws_trace(const float *s, const float *e, const float *mins, const float *maxs, int headnode, int mask,
	const float *origin, const float *angles, shim_trace_t *out) {
	vec3_t vs, ve, mn, mx, o, a;
	v3(vs, s); v3(ve, e); v3(mn, mins); v3(mx, maxs); v3(o, origin); v3(a, angles);
	if (!origin) put(out, CM_BoxTrace(vs, ve, mn, mx, headnode, mask));
	else put(out, CM_TransformedBoxTrace(vs, ve, mn, mx, headnode, mask, o, a));
}

int ws_box_leafnums(const float *mins, const float *maxs, int *list, int size, int *topnode) {
	vec3_t a, b;
	v3(a, mins); v3(b, maxs);
	return CM_BoxLeafnums(a, b, list, size, topnode);
}
int ws_leaf_cluster(int leaf) { return CM_LeafCluster(leaf); }
int ws_leaf_area(int leaf) { return CM_LeafArea(leaf); }

/* PF_inPVS and PF_inPHS (sv_game.c); the area check is the rerelease's `portals` argument. */
static int in_set(const float *p1, const float *p2, int portals, int phs) {
	vec3_t a, b;
	v3(a, p1); v3(b, p2);
	int leaf = CM_PointLeafnum(a);
	int cluster = CM_LeafCluster(leaf);
	int area1 = CM_LeafArea(leaf);
	byte *mask = phs ? CM_ClusterPHS(cluster) : CM_ClusterPVS(cluster);
	leaf = CM_PointLeafnum(b);
	cluster = CM_LeafCluster(leaf);
	int area2 = CM_LeafArea(leaf);
	if (mask && !(mask[cluster >> 3] & (1 << (cluster & 7)))) return 0;
	if (portals && !CM_AreasConnected(area1, area2)) return 0;
	return 1;
}
int ws_in_pvs(const float *p1, const float *p2, int portals) { return in_set(p1, p2, portals, 0); }
int ws_in_phs(const float *p1, const float *p2, int portals) { return in_set(p1, p2, portals, 1); }
void ws_set_area_portal(int portal, int open) { CM_SetAreaPortalState(portal, open); }
int ws_areas_connected(int a, int b) { return CM_AreasConnected(a, b); }
