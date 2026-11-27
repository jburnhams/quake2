/*
 * q2demo: id's Quake 2 (3.21, unmodified, from .id-source/full) built whole and headless, playing a
 * demo the way `map <name>.dm2` does in the original game: the server reads the demo and sends it to
 * the client over the loopback, the client parses it, builds the refresh, ref_gl draws it into an
 * OSMesa buffer, and snd_dma mixes the sound into a buffer nobody plays. Time is virtual: every
 * Qcommon_Frame is the same number of milliseconds, so a run is the same on every machine.
 *
 * This file is the platform layer the original ports each wrote (sys_*, snddma_*, glimp_*), plus
 * what the run writes out, in <out>/:
 *   demo.jsonl  one JSON object per line, in the order things happened:
 *     {"t":"msg"}    every server message the client parsed (its bytes, after the netchan header)
 *     {"t":"snd"}    every S_StartSound / S_StartLocalSound call
 *     {"t":"ref"}    every refdef handed to re.RenderFrame: the view, the entity list, dlights,
 *                    particles, and lightstyles when they change
 *     {"t":"draw"}   the 2D calls of the frame (HUD, centerprint, console): pic, char, fill...
 *     {"t":"chan"}   the mixer's channels after S_Update spatialised them
 *     {"t":"frame"}  the end of a CL_Frame: cl.time, lerpfrac, cl.frame and its entities, and the
 *                    range of PCM painted so far
 *   pcm.raw     the mixed sound, signed 16-bit little-endian stereo at 22050 Hz, from sample 0
 *   shots/      every Nth frame's 3D view (before the 2D) and final frame, as binary PPM
 *
 * Usage: q2demo <basedir> <out> [msec=25] [shot_every=0] [max_frames=0] [quake args...]
 *   basedir holds baseq2/pak0.pak; the demo is demos/q2demo1.dm2 unless the args say otherwise.
 *
 * Only the files the original Linux build used are linked, unchanged, except for the platform
 * layer: null/vid_null.c, null/in_null.c and null/cd_null.c from id's own null port, linux/net_udp.c
 * and linux/qgl_linux.c (GL called directly, here OSMesa's). The game is a stub: a demo server never
 * runs it, but SV_InitGame wants one.
 */

#include "../../.id-source/full/client/client.h"
#include "../../.id-source/full/client/snd_loc.h"
#include "../../.id-source/full/game/game.h"
#include <GL/osmesa.h>

#define TAG_GAME 765  /* g_local.h: freed when the game unloads */
/* gl_local.h's rserr_t, which GLimp_SetMode returns */
enum { rserr_ok, rserr_invalid_fullscreen, rserr_invalid_mode, rserr_unknown };
#include <errno.h>
#include <sys/stat.h>
#include <ctype.h>

/* ---------------------------------------------------------------------- virtual clock */

int curtime;
unsigned sys_frame_time;
static int vclock;

int Sys_Milliseconds(void) {
	curtime = vclock;
	return curtime;
}

/* ---------------------------------------------------------------------- the client's rand */

/* build.sh compiles client/cl_*.c and common.c with -Drand=q2_client_rand: the MSVC runtime's
 * generator (the original Windows builds' rand), seeded 1 as an unseeded program is, so the TS
 * client can draw the same numbers in the same order. */
static unsigned int client_holdrand = 1;
int q2_client_rand(void) {
	client_holdrand = client_holdrand * 214013u + 2531011u;
	return (client_holdrand >> 16) & 0x7fff;
}

/* ---------------------------------------------------------------------- output */

static FILE *out_json;
static FILE *out_pcm;
static char out_dir[1024];
static int frame_no;        /* CL_Frame calls that ran */
static int frame_msec;
static int shot_every;
static int pcm_written;     /* sample pairs written to pcm.raw */

static void jfloat(FILE *f, float v) {
	/* %.9g round-trips a float32 */
	if (v != v) { fputs("null", f); return; }
	fprintf(f, "%.9g", v);
}

static void jvec(FILE *f, const float *v) {
	fputc('[', f); jfloat(f, v[0]); fputc(',', f); jfloat(f, v[1]); fputc(',', f); jfloat(f, v[2]); fputc(']', f);
}

static void jstr(FILE *f, const char *s) {
	if (!s) { fputs("null", f); return; }
	fputc('"', f);
	for (; *s; s++) {
		unsigned char c = (unsigned char)*s;
		if (c == '"' || c == '\\') { fputc('\\', f); fputc(c, f); }
		else if (c < 0x20 || c >= 0x7f) fprintf(f, "\\u%04x", c);
		else fputc(c, f);
	}
	fputc('"', f);
}

/* ---------------------------------------------------------------------- system */

void Sys_Error(char *error, ...) {
	va_list argptr;
	fprintf(stderr, "Sys_Error: ");
	va_start(argptr, error);
	vfprintf(stderr, error, argptr);
	va_end(argptr);
	fprintf(stderr, "\n");
	exit(1);
}

static void finish(void);

void Sys_Quit(void) {
	finish();
	exit(0);
}

void Sys_UnloadGame(void) {}
char *Sys_ConsoleInput(void) { return NULL; }
void Sys_ConsoleOutput(char *string) {
	if (getenv("Q2DEMO_LOG")) fputs(string, stderr);
}
void Sys_SendKeyEvents(void) { sys_frame_time = Sys_Milliseconds(); }
void Sys_AppActivate(void) {}
void Sys_CopyProtect(void) {}
char *Sys_GetClipboardData(void) { return NULL; }
void Sys_Mkdir(char *path) { mkdir(path, 0777); }
char *Sys_FindFirst(char *path, unsigned musthave, unsigned canthave) { return NULL; }
char *Sys_FindNext(unsigned musthave, unsigned canthave) { return NULL; }
void Sys_FindClose(void) {}
void Sys_Init(void) {}

/* what sys_linux.c, in_linux.c and q_shlinux.c also define */
qboolean stdin_active = false;
cvar_t *in_joystick;
char *strlwr(char *s) {
	char *p;
	for (p = s; *p; p++) *p = tolower((unsigned char)*p);
	return s;
}

/* Hunks: one block each, as q_shlinux.c's mmap does, aligned to 32 bytes */
static byte *hunk_base;
static int hunk_max, hunk_cur;
#define HUNK_HEADER 32

void *Hunk_Begin(int maxsize) {
	hunk_max = maxsize;
	hunk_cur = 0;
	hunk_base = calloc(1, maxsize + HUNK_HEADER);
	if (!hunk_base) Sys_Error("Hunk_Begin: out of memory (%d)", maxsize);
	return hunk_base + HUNK_HEADER;
}

void *Hunk_Alloc(int size) {
	byte *buf;
	size = (size + 31) & ~31;
	if (hunk_cur + size > hunk_max) Sys_Error("Hunk_Alloc overflow");
	buf = hunk_base + HUNK_HEADER + hunk_cur;
	hunk_cur += size;
	return buf;
}

int Hunk_End(void) { return hunk_cur; }

void Hunk_Free(void *base) {
	if (base) free((byte *)base - HUNK_HEADER);
}

/* ---------------------------------------------------------------------- the game: a stub */

static game_import_t gi;
static game_export_t globals;
static edict_t *stub_edicts;
static gclient_t *stub_clients;

static void G_Init(void) {
	int i, maxclients = (int)gi.cvar("maxclients", "4", CVAR_SERVERINFO | CVAR_LATCH)->value;
	globals.max_edicts = MAX_EDICTS;
	stub_edicts = gi.TagMalloc(globals.max_edicts * sizeof(edict_t), TAG_GAME);
	stub_clients = gi.TagMalloc(maxclients * sizeof(gclient_t), TAG_GAME);
	for (i = 0; i < maxclients; i++) stub_edicts[i + 1].client = stub_clients + i;
	globals.edicts = stub_edicts;
	globals.num_edicts = maxclients + 1;
}
static void G_Shutdown(void) { gi.FreeTags(TAG_GAME); }
static void G_SpawnEntities(char *mapname, char *entities, char *spawnpoint) {}
static void G_WriteGame(char *filename, qboolean autosave) {}
static void G_ReadGame(char *filename) {}
static void G_WriteLevel(char *filename) {}
static void G_ReadLevel(char *filename) {}
static qboolean G_ClientConnect(edict_t *ent, char *userinfo) { return true; }
static void G_ClientBegin(edict_t *ent) {}
static void G_ClientUserinfoChanged(edict_t *ent, char *userinfo) {}
static void G_ClientDisconnect(edict_t *ent) {}
static void G_ClientCommand(edict_t *ent) {}
static void G_ClientThink(edict_t *ent, usercmd_t *cmd) {}
static void G_RunFrame(void) {}
static void G_ServerCommand(void) {}

void *Sys_GetGameAPI(void *parms) {
	gi = *(game_import_t *)parms;
	globals.apiversion = GAME_API_VERSION;
	globals.Init = G_Init;
	globals.Shutdown = G_Shutdown;
	globals.SpawnEntities = G_SpawnEntities;
	globals.WriteGame = G_WriteGame;
	globals.ReadGame = G_ReadGame;
	globals.WriteLevel = G_WriteLevel;
	globals.ReadLevel = G_ReadLevel;
	globals.ClientThink = G_ClientThink;
	globals.ClientConnect = G_ClientConnect;
	globals.ClientUserinfoChanged = G_ClientUserinfoChanged;
	globals.ClientDisconnect = G_ClientDisconnect;
	globals.ClientBegin = G_ClientBegin;
	globals.ClientCommand = G_ClientCommand;
	globals.RunFrame = G_RunFrame;
	globals.ServerCommand = G_ServerCommand;
	globals.edict_size = sizeof(edict_t);
	return &globals;
}

/* ---------------------------------------------------------------------- sound DMA: a buffer nobody plays */

#define DMA_SAMPLES 65536  /* mono samples: 32768 stereo pairs, 1.5 s at 22050 Hz */

qboolean SNDDMA_Init(void) {
	dma.channels = 2;
	dma.samplebits = 16;
	dma.speed = 22050;
	dma.samples = DMA_SAMPLES;
	dma.submission_chunk = 1;
	dma.samplepos = 0;
	dma.buffer = calloc(1, DMA_SAMPLES * 2);
	return true;
}

int SNDDMA_GetDMAPos(void) {
	/* the "hardware" has played up to the virtual clock */
	long long pairs = (long long)vclock * dma.speed / 1000;
	dma.samplepos = (int)((pairs * dma.channels) % dma.samples);
	return dma.samplepos;
}

void SNDDMA_Shutdown(void) {}
void SNDDMA_BeginPainting(void) {}
void SNDDMA_Submit(void) {}

/* Writes the samples painted since the last call (snd_mix.c's S_TransferStereo16 layout). */
static void flush_pcm(void) {
	extern int paintedtime;
	short *buf = (short *)dma.buffer;
	int mask = (dma.samples >> 1) - 1;
	if (!out_pcm || !buf) return;
	if (pcm_written == 0 && paintedtime > 0 && pcm_written < paintedtime) {
		/* nothing painted before sound started: zeros up to its first sample time */
	}
	while (pcm_written < paintedtime) {
		int pos = pcm_written & mask;
		fwrite(buf + pos * 2, sizeof(short), 2, out_pcm);
		pcm_written++;
	}
}

/* ---------------------------------------------------------------------- GL on OSMesa */

static OSMesaContext osmesa;
static unsigned char *gl_buffer;
static int gl_width, gl_height;

int GLimp_Init(void *hinstance, void *hWnd) { return true; }

int GLimp_SetMode(int *pwidth, int *pheight, int mode, qboolean fullscreen) {
	int width, height;
	if (!VID_GetModeInfo(&width, &height, mode)) return rserr_invalid_mode;
	if (!osmesa) osmesa = OSMesaCreateContextExt(OSMESA_RGBA, 24, 8, 0, NULL);
	if (!osmesa) Sys_Error("OSMesaCreateContextExt failed");
	free(gl_buffer);
	gl_buffer = calloc(1, width * height * 4);
	if (!OSMesaMakeCurrent(osmesa, gl_buffer, GL_UNSIGNED_BYTE, width, height)) Sys_Error("OSMesaMakeCurrent failed");
	gl_width = *pwidth = width;
	gl_height = *pheight = height;
	VID_NewWindow(width, height);
	return rserr_ok;
}

void GLimp_Shutdown(void) {}
void GLimp_BeginFrame(float camera_separation) {}
void GLimp_AppActivate(qboolean active) {}

static void write_ppm(const char *suffix) {
	char name[1200];
	FILE *f;
	int y, x;
	glFinish();
	snprintf(name, sizeof(name), "%s/shots/f%05d%s.ppm", out_dir, frame_no, suffix);
	f = fopen(name, "wb");
	if (!f) return;
	fprintf(f, "P6\n%d %d\n255\n", gl_width, gl_height);
	/* OSMesa's rows are bottom up, as glReadPixels' */
	for (y = gl_height - 1; y >= 0; y--) {
		unsigned char *row = gl_buffer + y * gl_width * 4;
		for (x = 0; x < gl_width; x++) fwrite(row + x * 4, 1, 3, f);
	}
	fclose(f);
}

static int shot_this_frame(void) { return shot_every > 0 && frame_no % shot_every == 0; }

void GLimp_EndFrame(void) {
	if (shot_this_frame() && cls.state == ca_active) write_ppm("");
}

/* ---------------------------------------------------------------------- the refresh, watched */

refexport_t __real_GetRefAPI(refimport_t rimp);
static refexport_t real_re;
static lightstyle_t last_styles[MAX_LIGHTSTYLES];
static int styles_sent;
static int drew_3d;

int harness_inline_model(const void *m);
static const char *model_name(struct model_s *m) {
	static char inline_name[16];
	int i;
	if (!m) return NULL;
	i = harness_inline_model(m);
	if (i >= 0) { snprintf(inline_name, sizeof(inline_name), "*%d", i); return inline_name; }
	return (const char *)m; /* model_t.name is first */
}
static const char *image_name(struct image_s *i) { return i ? (const char *)i : NULL; /* image_t.name is first */ }

static void watch_RenderFrame(refdef_t *fd) {
	FILE *f = out_json;
	int i;
	fprintf(f, "{\"t\":\"ref\",\"f\":%d,\"x\":%d,\"y\":%d,\"w\":%d,\"h\":%d,\"fov\":[", frame_no, fd->x, fd->y, fd->width, fd->height);
	jfloat(f, fd->fov_x); fputc(',', f); jfloat(f, fd->fov_y);
	fputs("],\"org\":", f); jvec(f, fd->vieworg);
	fputs(",\"ang\":", f); jvec(f, fd->viewangles);
	fputs(",\"blend\":[", f);
	for (i = 0; i < 4; i++) { if (i) fputc(',', f); jfloat(f, fd->blend[i]); }
	fputs("],\"time\":", f); jfloat(f, fd->time);
	fprintf(f, ",\"rdflags\":%d", fd->rdflags);
	if (fd->areabits) {
		fputs(",\"areas\":\"", f);
		for (i = 0; i < MAX_MAP_AREAS / 8; i++) fprintf(f, "%02x", fd->areabits[i]);
		fputc('"', f);
	}
	if (!styles_sent || memcmp(last_styles, fd->lightstyles, sizeof(last_styles))) {
		fputs(",\"styles\":[", f);
		for (i = 0; i < MAX_LIGHTSTYLES; i++) {
			if (i) fputc(',', f);
			jvec(f, fd->lightstyles[i].rgb);
		}
		fputc(']', f);
		memcpy(last_styles, fd->lightstyles, sizeof(last_styles));
		styles_sent = 1;
	}
	fputs(",\"ents\":[", f);
	for (i = 0; i < fd->num_entities; i++) {
		entity_t *e = &fd->entities[i];
		if (i) fputc(',', f);
		fputs("{\"model\":", f); jstr(f, (e->flags & RF_BEAM) ? NULL : model_name(e->model));
		fprintf(f, ",\"frame\":%d,\"oldframe\":%d,\"backlerp\":", e->frame, e->oldframe); jfloat(f, e->backlerp);
		fputs(",\"origin\":", f); jvec(f, e->origin);
		fputs(",\"oldorigin\":", f); jvec(f, e->oldorigin);
		fputs(",\"angles\":", f); jvec(f, e->angles);
		fprintf(f, ",\"skinnum\":%d,\"skin\":", e->skinnum); jstr(f, image_name(e->skin));
		fprintf(f, ",\"flags\":%d,\"lightstyle\":%d,\"alpha\":", e->flags, e->lightstyle); jfloat(f, e->alpha);
		fputc('}', f);
	}
	fputs("],\"dlights\":[", f);
	for (i = 0; i < fd->num_dlights; i++) {
		dlight_t *d = &fd->dlights[i];
		if (i) fputc(',', f);
		fputs("{\"origin\":", f); jvec(f, d->origin);
		fputs(",\"color\":", f); jvec(f, d->color);
		fputs(",\"intensity\":", f); jfloat(f, d->intensity);
		fputc('}', f);
	}
	fputs("],\"particles\":[", f);
	for (i = 0; i < fd->num_particles; i++) {
		particle_t *p = &fd->particles[i];
		if (i) fputc(',', f);
		fputc('[', f); jfloat(f, p->origin[0]); fputc(',', f); jfloat(f, p->origin[1]); fputc(',', f); jfloat(f, p->origin[2]);
		fprintf(f, ",%d,", p->color); jfloat(f, p->alpha); fputc(']', f);
	}
	fputs("]}\n", f);

	real_re.RenderFrame(fd);
	drew_3d = 1;
	if (shot_this_frame()) write_ppm("-3d");
}

/* 2D calls, in order, for the frame's "draw" line */
static char draw_buf[1 << 20];
static int draw_len;

static void draw_add(const char *fmt, ...) {
	va_list ap;
	if (draw_len > (int)sizeof(draw_buf) - 512) return;
	if (draw_len) draw_buf[draw_len++] = ',';
	va_start(ap, fmt);
	draw_len += vsnprintf(draw_buf + draw_len, sizeof(draw_buf) - draw_len, fmt, ap);
	va_end(ap);
}

static void watch_DrawPic(int x, int y, char *name) { draw_add("[\"pic\",%d,%d,\"%s\"]", x, y, name); real_re.DrawPic(x, y, name); }
static void watch_DrawStretchPic(int x, int y, int w, int h, char *name) { draw_add("[\"stretch\",%d,%d,%d,%d,\"%s\"]", x, y, w, h, name); real_re.DrawStretchPic(x, y, w, h, name); }
static void watch_DrawChar(int x, int y, int c) { draw_add("[\"char\",%d,%d,%d]", x, y, c); real_re.DrawChar(x, y, c); }
static void watch_DrawTileClear(int x, int y, int w, int h, char *name) { draw_add("[\"tile\",%d,%d,%d,%d,\"%s\"]", x, y, w, h, name); real_re.DrawTileClear(x, y, w, h, name); }
static void watch_DrawFill(int x, int y, int w, int h, int c) { draw_add("[\"fill\",%d,%d,%d,%d,%d]", x, y, w, h, c); real_re.DrawFill(x, y, w, h, c); }
static void watch_DrawFadeScreen(void) { draw_add("[\"fade\"]"); real_re.DrawFadeScreen(); }

refexport_t __wrap_GetRefAPI(refimport_t rimp) {
	refexport_t re_out;
	/* vid_null.c predates refimport_t.Vid_MenuInit and leaves it as stack garbage */
	rimp.Vid_MenuInit = VID_MenuInit;
	real_re = __real_GetRefAPI(rimp);
	re_out = real_re;
	re_out.RenderFrame = watch_RenderFrame;
	re_out.DrawPic = watch_DrawPic;
	re_out.DrawStretchPic = watch_DrawStretchPic;
	re_out.DrawChar = watch_DrawChar;
	re_out.DrawTileClear = watch_DrawTileClear;
	re_out.DrawFill = watch_DrawFill;
	re_out.DrawFadeScreen = watch_DrawFadeScreen;
	vidref_val = VIDREF_GL;
	return re_out;
}

/* ---------------------------------------------------------------------- the client, watched */

void __real_CL_ParseServerMessage(void);
void __wrap_CL_ParseServerMessage(void) {
	int i;
	fprintf(out_json, "{\"t\":\"msg\",\"f\":%d,\"ack\":%d,\"hex\":\"", frame_no, cls.netchan.incoming_acknowledged);
	for (i = net_message.readcount; i < net_message.cursize; i++) fprintf(out_json, "%02x", net_message.data[i]);
	fputs("\"}\n", out_json);
	__real_CL_ParseServerMessage();
}

void __real_S_StartSound(vec3_t origin, int entnum, int entchannel, sfx_t *sfx, float fvol, float attenuation, float timeofs);
void __wrap_S_StartSound(vec3_t origin, int entnum, int entchannel, sfx_t *sfx, float fvol, float attenuation, float timeofs) {
	FILE *f = out_json;
	fprintf(f, "{\"t\":\"snd\",\"f\":%d,\"ent\":%d,\"ch\":%d,\"sfx\":", frame_no, entnum, entchannel);
	jstr(f, sfx ? sfx->name : NULL);
	fputs(",\"vol\":", f); jfloat(f, fvol);
	fputs(",\"attn\":", f); jfloat(f, attenuation);
	fputs(",\"ofs\":", f); jfloat(f, timeofs);
	fputs(",\"org\":", f);
	if (origin) jvec(f, origin); else fputs("null", f);
	fputs("}\n", f);
	__real_S_StartSound(origin, entnum, entchannel, sfx, fvol, attenuation, timeofs);
}

void __real_S_StartLocalSound(char *sound);
void __wrap_S_StartLocalSound(char *sound) {
	fprintf(out_json, "{\"t\":\"snd\",\"f\":%d,\"local\":", frame_no);
	jstr(out_json, sound);
	fputs("}\n", out_json);
	__real_S_StartLocalSound(sound);
}

void __real_S_Update(vec3_t origin, vec3_t forward, vec3_t right, vec3_t up);
void __wrap_S_Update(vec3_t origin, vec3_t forward, vec3_t right, vec3_t up) {
	extern int paintedtime, soundtime;
	FILE *f = out_json;
	int i, first = 1;
	__real_S_Update(origin, forward, right, up);
	if (cls.state != ca_active) return;
	fprintf(f, "{\"t\":\"chan\",\"f\":%d,\"soundtime\":%d,\"painted\":%d,\"listener\":[", frame_no, soundtime, paintedtime);
	jvec(f, origin); fputc(',', f); jvec(f, forward); fputc(',', f); jvec(f, right); fputc(',', f); jvec(f, up);
	fputs("],\"c\":[", f);
	for (i = 0; i < MAX_CHANNELS; i++) {
		channel_t *ch = &channels[i];
		if (!ch->sfx) continue;
		if (!first) fputc(',', f);
		first = 0;
		fprintf(f, "{\"i\":%d,\"sfx\":", i); jstr(f, ch->sfx->name);
		fprintf(f, ",\"left\":%d,\"right\":%d,\"end\":%d,\"pos\":%d,\"ent\":%d,\"ch\":%d,\"master\":%d,\"fixed\":%d,\"auto\":%d,\"dist\":",
			ch->leftvol, ch->rightvol, ch->end, ch->pos, ch->entnum, ch->entchannel, ch->master_vol, ch->fixed_origin, ch->autosound);
		jfloat(f, ch->dist_mult);
		fputs(",\"origin\":", f); jvec(f, ch->origin);
		fputc('}', f);
	}
	fputs("]}\n", f);
	flush_pcm();
}

static void dump_state(FILE *f, entity_state_t *s) {
	fprintf(f, "{\"n\":%d,\"origin\":", s->number); jvec(f, s->origin);
	fputs(",\"angles\":", f); jvec(f, s->angles);
	fputs(",\"old_origin\":", f); jvec(f, s->old_origin);
	fprintf(f, ",\"model\":[%d,%d,%d,%d],\"frame\":%d,\"skin\":%d,\"effects\":%u,\"renderfx\":%d,\"solid\":%d,\"sound\":%d,\"event\":%d}",
		s->modelindex, s->modelindex2, s->modelindex3, s->modelindex4, s->frame, s->skinnum, s->effects, s->renderfx, s->solid, s->sound, s->event);
}

void __real_CL_Frame(int msec);
void __wrap_CL_Frame(int msec) {
	FILE *f = out_json;
	player_state_t *ps = &cl.frame.playerstate;
	int i;
	extern int paintedtime;
	draw_len = 0;
	drew_3d = 0;
	__real_CL_Frame(msec);
	if (cls.state == ca_active && draw_len) fprintf(f, "{\"t\":\"draw\",\"f\":%d,\"d\":[%.*s]}\n", frame_no, draw_len, draw_buf);
	if (cls.state == ca_active) {
		fprintf(f, "{\"t\":\"frame\",\"f\":%d,\"msec\":%d,\"clock\":%d,\"time\":%d,\"lerp\":", frame_no, msec, vclock, cl.time);
		jfloat(f, cl.lerpfrac);
		fprintf(f, ",\"drew\":%d,\"valid\":%d,\"serverframe\":%d,\"servertime\":%d,\"deltaframe\":%d,\"painted\":%d",
			drew_3d, cl.frame.valid, cl.frame.serverframe, cl.frame.servertime, cl.frame.deltaframe, paintedtime);
		/* what the network did, which the client's prediction reads: the sequence it has sent and
		   the newest the server acknowledged, and the client's clocks */
		fprintf(f, ",\"ack\":%d,\"seq\":%d,\"realtime\":%d,\"frametime\":", cls.netchan.incoming_acknowledged, cls.netchan.outgoing_sequence, cls.realtime);
		jfloat(f, cls.frametime);
		fputs(",\"pred\":{\"origin\":", f); jvec(f, cl.predicted_origin);
		fputs(",\"angles\":", f); jvec(f, cl.predicted_angles);
		fputs(",\"error\":", f); jvec(f, cl.prediction_error);
		fputs(",\"step\":", f); jfloat(f, cl.predicted_step);
		fprintf(f, ",\"steptime\":%u}", cl.predicted_step_time);
		fputs(",\"ps\":{\"pm_type\":", f);
		fprintf(f, "%d,\"origin\":[%d,%d,%d],\"velocity\":[%d,%d,%d],\"pm_flags\":%d,\"pm_time\":%d,\"gravity\":%d,\"delta_angles\":[%d,%d,%d]",
			ps->pmove.pm_type, ps->pmove.origin[0], ps->pmove.origin[1], ps->pmove.origin[2],
			ps->pmove.velocity[0], ps->pmove.velocity[1], ps->pmove.velocity[2], ps->pmove.pm_flags, ps->pmove.pm_time,
			ps->pmove.gravity, ps->pmove.delta_angles[0], ps->pmove.delta_angles[1], ps->pmove.delta_angles[2]);
		fputs(",\"viewangles\":", f); jvec(f, ps->viewangles);
		fputs(",\"viewoffset\":", f); jvec(f, ps->viewoffset);
		fputs(",\"kick_angles\":", f); jvec(f, ps->kick_angles);
		fputs(",\"gunangles\":", f); jvec(f, ps->gunangles);
		fputs(",\"gunoffset\":", f); jvec(f, ps->gunoffset);
		fprintf(f, ",\"gunindex\":%d,\"gunframe\":%d,\"blend\":[", ps->gunindex, ps->gunframe);
		for (i = 0; i < 4; i++) { if (i) fputc(',', f); jfloat(f, ps->blend[i]); }
		fputs("],\"fov\":", f); jfloat(f, ps->fov);
		fprintf(f, ",\"rdflags\":%d,\"stats\":[", ps->rdflags);
		for (i = 0; i < MAX_STATS; i++) fprintf(f, i ? ",%d" : "%d", ps->stats[i]);
		fputs("]},\"ents\":[", f);
		for (i = 0; i < cl.frame.num_entities; i++) {
			if (i) fputc(',', f);
			dump_state(f, &cl_parse_entities[(cl.frame.parse_entities + i) & (MAX_PARSE_ENTITIES - 1)]);
		}
		fputs("]}\n", f);
	}
	frame_no++;
}

/* ---------------------------------------------------------------------- main */

static void finish(void) {
	flush_pcm();
	if (out_json) fflush(out_json);
	if (out_pcm) fflush(out_pcm);
}

int main(int argc, char **argv) {
	char path[1200];
	char *args[64];
	int n = 0, i, max_frames = 0, was_active = 0;

	if (argc < 3) {
		fprintf(stderr, "usage: q2demo <basedir> <out> [msec=25] [shot_every=0] [max_frames=0] [quake args...]\n");
		return 2;
	}
	snprintf(out_dir, sizeof(out_dir), "%s", argv[2]);
	frame_msec = argc > 3 ? atoi(argv[3]) : 25;
	shot_every = argc > 4 ? atoi(argv[4]) : 0;
	max_frames = argc > 5 ? atoi(argv[5]) : 0;
	mkdir(out_dir, 0777);
	snprintf(path, sizeof(path), "%s/shots", out_dir);
	if (shot_every) mkdir(path, 0777);
	snprintf(path, sizeof(path), "%s/demo.jsonl", out_dir);
	out_json = fopen(path, "w");
	snprintf(path, sizeof(path), "%s/pcm.raw", out_dir);
	out_pcm = fopen(path, "wb");
	if (!out_json || !out_pcm) Sys_Error("cannot write to %s", out_dir);

	args[n++] = "q2demo";
	args[n++] = "+set"; args[n++] = "basedir"; args[n++] = argv[1];
	args[n++] = "+set"; args[n++] = "dedicated"; args[n++] = "0";
	for (i = 6; i < argc && n < 60; i++) args[n++] = argv[i];
	if (argc <= 6) { args[n++] = "+map"; args[n++] = "q2demo1.dm2"; }
	args[n] = NULL;

	/* The extension string of a GL from this century overflows the 4096-byte buffers R_Init prints
	   it through; Mesa trims it to the extensions a game of the year would have known. */
	setenv("MESA_EXTENSION_MAX_YEAR", "1999", 0);
	Qcommon_Init(n, args);
	for (;;) {
		vclock += frame_msec;
		Qcommon_Frame(frame_msec);
		if (cls.state == ca_active) was_active = 1;
		else if (was_active) break;           /* the demo ended: SV_DemoCompleted, killserver */
		if (max_frames && frame_no >= max_frames) break;
		if (frame_no > 200000) Sys_Error("demo never ended");
	}
	finish();
	return 0;
}
