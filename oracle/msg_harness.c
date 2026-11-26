/*
 * C reference oracle for message encoding: links id Software's qcommon/common.c and
 * crc.c unchanged (only the MSG_*, SZ_* and checksum functions are reached; the linker
 * drops the rest with --gc-sections) and answers on stdin, one JSON line each:
 *   coord f | angle f | angle16 f | dir x y z    -> {"hex":...} bytes MSG_Write* puts out
 *   readdir b                                    -> {"dir":[x,y,z]} from MSG_ReadDir
 *   crc n hex                                    -> {"crc":...} CRC_Block of the bytes
 *   seqcrc sequence n hex                        -> {"crc":...} COM_BlockSequenceCRCByte
 *   cmd <from: msec buttons a0 a1 a2 fwd side up impulse light> <to: same>
 *                                                -> {"hex":...} MSG_WriteDeltaUsercmd
 *   ent <from: 21 numbers> <to: 21 numbers> force newentity
 *                                                -> {"hex":...} MSG_WriteDeltaEntity
 *   parse n hex                                  -> the entity CL_ParseEntityBits and
 *                                                   CL_ParseDelta (client/cl_ents.c) read from
 *                                                   the bytes onto a null baseline
 * Entity numbers, in order: number origin[3] angles[3] old_origin[3] modelindex modelindex2
 * modelindex3 modelindex4 frame skinnum effects renderfx solid sound event.
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdarg.h>
#include "full/qcommon/qcommon.h"

/* client/cl_ents.c, linked for its delta reader. */
int CL_ParseEntityBits(unsigned *bits);
void CL_ParseDelta(entity_state_t *from, entity_state_t *to, int number, int bits);
sizebuf_t net_message; /* net_chan.c's, which is not linked */

/* Whatever the reached code still names, stubbed (Com_Error, via SZ_GetSpace and MSG_WriteDeltaEntity). */
void Sys_Error(char *fmt, ...) { va_list ap; va_start(ap, fmt); vfprintf(stderr, fmt, ap); va_end(ap); exit(2); }
void CL_Drop(void) {}
void CL_Shutdown(void) {}
void SV_Shutdown(char *finalmsg, qboolean reconnect) { (void)finalmsg; (void)reconnect; }
void Con_Print(char *txt) { (void)txt; }
void Sys_ConsoleOutput(char *s) { (void)s; }
int Sys_Milliseconds(void) { return 0; }
char *FS_Gamedir(void) { return "."; }

static void hex_out(sizebuf_t *b) {
	printf("{\"hex\":\"");
	for (int i = 0; i < b->cursize; i++) printf("%02x", b->data[i]);
	printf("\"}\n");
}

static int read_hex(byte *out, int n) {
	char h[3] = {0};
	for (int i = 0; i < n; i++) {
		if (scanf(" %2c", h) != 1) return 0;
		out[i] = (byte)strtol(h, NULL, 16);
	}
	return 1;
}

static int read_cmd(usercmd_t *c) {
	int v[10];
	for (int i = 0; i < 10; i++) if (scanf("%d", &v[i]) != 1) return 0;
	c->msec = v[0]; c->buttons = v[1];
	c->angles[0] = v[2]; c->angles[1] = v[3]; c->angles[2] = v[4];
	c->forwardmove = v[5]; c->sidemove = v[6]; c->upmove = v[7];
	c->impulse = v[8]; c->lightlevel = v[9];
	return 1;
}

static int read_ent(entity_state_t *e) {
	float f[9]; int v[11];
	if (scanf("%d", &e->number) != 1) return 0;
	for (int i = 0; i < 9; i++) if (scanf("%f", &f[i]) != 1) return 0;
	for (int i = 0; i < 11; i++) if (scanf("%d", &v[i]) != 1) return 0;
	for (int i = 0; i < 3; i++) { e->origin[i] = f[i]; e->angles[i] = f[3 + i]; e->old_origin[i] = f[6 + i]; }
	e->modelindex = v[0]; e->modelindex2 = v[1]; e->modelindex3 = v[2]; e->modelindex4 = v[3];
	e->frame = v[4]; e->skinnum = v[5]; e->effects = (unsigned)v[6]; e->renderfx = v[7];
	e->solid = v[8]; e->sound = v[9]; e->event = v[10];
	return 1;
}

int main(void) {
	static byte data[4096];
	sizebuf_t buf;
	char op[32];
	printf("{\"ready\":true}\n");
	fflush(stdout);
	while (scanf("%31s", op) == 1) {
		SZ_Init(&buf, data, sizeof data);
		if (!strcmp(op, "coord") || !strcmp(op, "angle") || !strcmp(op, "angle16")) {
			float f;
			if (scanf("%f", &f) != 1) break;
			if (op[0] == 'c') MSG_WriteCoord(&buf, f);
			else if (!strcmp(op, "angle")) MSG_WriteAngle(&buf, f);
			else MSG_WriteAngle16(&buf, f);
			hex_out(&buf);
		} else if (!strcmp(op, "dir")) {
			vec3_t d;
			if (scanf("%f %f %f", &d[0], &d[1], &d[2]) != 3) break;
			MSG_WriteDir(&buf, d);
			hex_out(&buf);
		} else if (!strcmp(op, "readdir")) {
			int b; vec3_t d;
			if (scanf("%d", &b) != 1) break;
			MSG_WriteByte(&buf, b);
			MSG_BeginReading(&buf);
			MSG_ReadDir(&buf, d);
			printf("{\"dir\":[%.9g,%.9g,%.9g]}\n", d[0], d[1], d[2]);
		} else if (!strcmp(op, "crc") || !strcmp(op, "seqcrc")) {
			int seq = 0, n;
			if (op[0] == 's' && scanf("%d", &seq) != 1) break;
			if (scanf("%d", &n) != 1 || n < 0 || n > 1024) break;
			byte bytes[1024];
			if (!read_hex(bytes, n)) break;
			if (op[0] == 's') printf("{\"crc\":%d}\n", COM_BlockSequenceCRCByte(bytes, n, seq));
			else printf("{\"crc\":%d}\n", CRC_Block(bytes, n));
		} else if (!strcmp(op, "cmd")) {
			usercmd_t from, to;
			if (!read_cmd(&from) || !read_cmd(&to)) break;
			MSG_WriteDeltaUsercmd(&buf, &from, &to);
			hex_out(&buf);
		} else if (!strcmp(op, "ent")) {
			entity_state_t from, to; int force, newent;
			if (!read_ent(&from) || !read_ent(&to) || scanf("%d %d", &force, &newent) != 2) break;
			MSG_WriteDeltaEntity(&from, &to, &buf, force, newent);
			hex_out(&buf);
		} else if (!strcmp(op, "parse")) {
			int n; static byte in[1024];
			if (scanf("%d", &n) != 1 || n < 0 || n > 1024 || !read_hex(in, n)) break;
			SZ_Init(&net_message, in, sizeof in);
			net_message.cursize = n;
			MSG_BeginReading(&net_message);
			unsigned bits; entity_state_t nul, e;
			memset(&nul, 0, sizeof nul);
			int number = CL_ParseEntityBits(&bits);
			CL_ParseDelta(&nul, &e, number, bits);
			printf("{\"bits\":%u,\"read\":%d,\"number\":%d,\"origin\":[%.9g,%.9g,%.9g],\"angles\":[%.9g,%.9g,%.9g],"
				"\"oldOrigin\":[%.9g,%.9g,%.9g],\"modelindex\":[%d,%d,%d,%d],\"frame\":%d,\"skinnum\":%d,\"effects\":%u,"
				"\"renderfx\":%d,\"solid\":%d,\"sound\":%d,\"event\":%d}\n",
				bits, net_message.readcount, e.number, e.origin[0], e.origin[1], e.origin[2], e.angles[0], e.angles[1], e.angles[2],
				e.old_origin[0], e.old_origin[1], e.old_origin[2], e.modelindex, e.modelindex2, e.modelindex3, e.modelindex4,
				e.frame, e.skinnum, e.effects, e.renderfx, e.solid, e.sound, e.event);
		} else {
			printf("{\"error\":\"unknown op %s\"}\n", op);
		}
		fflush(stdout);
	}
	return 0;
}
