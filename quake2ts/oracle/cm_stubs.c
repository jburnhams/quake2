/*
 * Engine services cmodel.c calls, stubbed for the oracles, plus a plain-C
 * trace shim the C++ pmove oracle uses (its trace_t differs from cmodel.c's).
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdarg.h>
#include "full/qcommon/qcommon.h"
#include "cm_shim.h"

/* ---- stubs for the engine services cmodel.c calls ---- */

char *bsp_path;

void Com_Error(int code, char *fmt, ...) {
	va_list ap; va_start(ap, fmt);
	fprintf(stderr, "Com_Error: "); vfprintf(stderr, fmt, ap); fputc('\n', stderr);
	va_end(ap); exit(2);
}
void Com_Printf(char *fmt, ...) { (void)fmt; }
void Com_DPrintf(char *fmt, ...) { (void)fmt; }
void Sys_Error(char *fmt, ...) {
	va_list ap; va_start(ap, fmt); vfprintf(stderr, fmt, ap); va_end(ap); exit(2);
}
static cvar_t dummy_cvar;
cvar_t *Cvar_Get(char *name, char *value, int flags) { (void)name; (void)value; (void)flags; return &dummy_cvar; }
float Cvar_VariableValue(char *name) { (void)name; return 0; }
unsigned Com_BlockChecksum(void *buffer, int length) { (void)buffer; (void)length; return 0; }

int FS_LoadFile(char *path, void **buffer) {
	(void)path;
	FILE *f = fopen(bsp_path, "rb");
	if (!f) { *buffer = NULL; return -1; }
	fseek(f, 0, SEEK_END); long len = ftell(f); fseek(f, 0, SEEK_SET);
	*buffer = malloc(len);
	if (fread(*buffer, 1, len, f) != (size_t)len) { fclose(f); free(*buffer); *buffer = NULL; return -1; }
	fclose(f);
	return (int)len;
}
void FS_FreeFile(void *buffer) { free(buffer); }
void FS_Read(void *buffer, int len, FILE *f) { if (fread(buffer, 1, len, f) != (size_t)len) Com_Error(ERR_FATAL, "FS_Read"); }

/* ---- shim ---- */

void shim_load(const char *path) {
	bsp_path = (char *)path;
	Swap_Init();
	unsigned checksum;
	CM_LoadMap("oracle.bsp", false, &checksum);
}

void shim_trace(const float *s, const float *e, const float *mins, const float *maxs, int mask, shim_trace_t *out) {
	vec3_t vs = {s[0], s[1], s[2]}, ve = {e[0], e[1], e[2]};
	vec3_t vmins = {0, 0, 0}, vmaxs = {0, 0, 0};
	if (mins) { vmins[0] = mins[0]; vmins[1] = mins[1]; vmins[2] = mins[2]; }
	if (maxs) { vmaxs[0] = maxs[0]; vmaxs[1] = maxs[1]; vmaxs[2] = maxs[2]; }
	trace_t t = CM_BoxTrace(vs, ve, vmins, vmaxs, 0, mask);
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

int shim_contents(const float *p) {
	vec3_t v = {p[0], p[1], p[2]};
	return CM_PointContents(v, 0);
}
