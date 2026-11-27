/* world_shim.c: cmodel.c in plain C types, for host.cpp. A NULL origin means untransformed. */
#ifndef WORLD_SHIM_H
#define WORLD_SHIM_H
#include "cm_shim.h"
#ifdef __cplusplus
extern "C" {
#endif
const char *ws_entity_string(void);
int ws_num_inline_models(void);
void ws_inline_model(int n, float *mins, float *maxs, int *headnode);
int ws_headnode_for_box(const float *mins, const float *maxs, int contents);
int ws_point_contents(const float *p, int headnode, const float *origin, const float *angles);
void ws_trace(const float *s, const float *e, const float *mins, const float *maxs, int headnode, int mask,
	const float *origin, const float *angles, shim_trace_t *out);
int ws_box_leafnums(const float *mins, const float *maxs, int *list, int size, int *topnode);
int ws_leaf_cluster(int leaf);
int ws_leaf_area(int leaf);
int ws_in_pvs(const float *p1, const float *p2, int portals);
int ws_in_phs(const float *p1, const float *p2, int portals);
void ws_set_area_portal(int portal, int open);
int ws_areas_connected(int a, int b);
#ifdef __cplusplus
}
#endif
#endif
