/* Plain-C view of cmodel.c's world trace, for callers with their own trace_t (the rerelease's). */
#ifndef CM_SHIM_H
#define CM_SHIM_H
#ifdef __cplusplus
extern "C" {
#endif
typedef struct {
	float fraction;
	float endpos[3];
	float normal[3];
	float dist;
	int type, signbits;
	int contents;
	int surfaceFlags, surfaceValue;
	int startsolid, allsolid;
} shim_trace_t;

void shim_load(const char *path);
/* CM_BoxTrace against the world (headnode 0); mins/maxs may be NULL for a point. */
void shim_trace(const float *s, const float *e, const float *mins, const float *maxs, int mask, shim_trace_t *out);
int shim_contents(const float *p);
#ifdef __cplusplus
}
#endif
#endif
