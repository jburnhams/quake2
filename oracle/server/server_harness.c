/*
 * q2server: id's Quake 2 (3.21, unmodified, from .id-source/full) server and game built whole and
 * headless, with one scripted player connected over the loopback. The server runs the map the way
 * `map <name>` does in the original game; the player is this file: it connects as id's client does
 * (getchallenge, connect, new, configstrings, baselines, begin) and then sends a clc_move every
 * frame with usercmds from a fixed script. Time is virtual: every Qcommon_Frame is the same number
 * of milliseconds, so a run is the same on every machine.
 *
 * What a TypeScript server needs to be held to it is what crossed the wire, so the run writes, in
 * <out>/server.jsonl, one JSON object per line in the order things happened:
 *   {"t":"tick"}  the start of a Qcommon_Frame: its number, msec and the clock
 *   {"t":"cl"}    every packet the player sent the server (hex, as NET_SendPacket was given it)
 *   {"t":"sv"}    every packet the server sent the player
 *   {"t":"cmd"}   every usercmd the server ran (SV_ClientThink), for reading a difference
 *   {"t":"ents"}  after each game frame: every edict in use, its entity_state and, for the
 *                 player, its player_state, for reading a difference the wire only hints at
 * Replaying the "cl" packets into another server at the same ticks must give the same "sv" packets.
 *
 * Usage: q2server <basedir> <out> [msec=25] [ticks=2400] [quake args...]
 *   basedir holds baseq2/pak0.pak; the args default to "+map demo1".
 *
 * Linked as the original Linux dedicated server was, from id's files unchanged: qcommon, server,
 * the game (game/*.c, hard-linked rather than loaded as gamei386.so), null/cl_null.c for the client
 * and linux/net_udp.c for the loopback. The server and the game each draw from rand(); build.sh gives
 * each a stream of its own (the MSVC runtime's generator, seeded 1), so the TS server can match them.
 */

#include "../../.id-source/full/server/server.h"
#include <sys/stat.h>

/* ---------------------------------------------------------------------- virtual clock */

int curtime;
unsigned sys_frame_time;
static int vclock;

int Sys_Milliseconds(void) {
	curtime = vclock;
	return curtime;
}

/* ---------------------------------------------------------------------- rand streams */

static unsigned int server_holdrand = 1, game_holdrand = 1;
int q2_server_rand(void) {
	server_holdrand = server_holdrand * 214013u + 2531011u;
	return (server_holdrand >> 16) & 0x7fff;
}
int q2_game_rand(void) {
	game_holdrand = game_holdrand * 214013u + 2531011u;
	return (game_holdrand >> 16) & 0x7fff;
}

/* ---------------------------------------------------------------------- output */

static FILE *out_json;
static int tick_no;

static void jfloat(FILE *f, float v) {
	if (v != v) { fputs("null", f); return; }
	fprintf(f, "%.9g", v);
}
static void jvec(FILE *f, const float *v) {
	fputc('[', f); jfloat(f, v[0]); fputc(',', f); jfloat(f, v[1]); fputc(',', f); jfloat(f, v[2]); fputc(']', f);
}
static void jhex(FILE *f, const byte *data, int len) {
	int i;
	fputc('"', f);
	for (i = 0; i < len; i++) fprintf(f, "%02x", data[i]);
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
void Sys_Quit(void) {
	if (out_json) fclose(out_json);
	exit(0);
}
void Sys_UnloadGame(void) {}
char *Sys_ConsoleInput(void) { return NULL; }
void Sys_ConsoleOutput(char *string) {
	if (getenv("Q2SERVER_LOG")) fputs(string, stderr);
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
/* what files.c and net_udp.c want from the parts of the client and sys_linux.c left out */
void CDAudio_Stop(void) {}
qboolean stdin_active = false;

/* ---------------------------------------------------------------------- what crossed the wire */

void __real_NET_SendPacket(netsrc_t sock, int length, void *data, netadr_t to);
void __wrap_NET_SendPacket(netsrc_t sock, int length, void *data, netadr_t to) {
	if (out_json) {
		fprintf(out_json, "{\"t\":\"%s\",\"f\":%d,\"data\":", sock == NS_CLIENT ? "cl" : "sv", tick_no);
		jhex(out_json, data, length);
		fputs("}\n", out_json);
	}
	__real_NET_SendPacket(sock, length, data, to);
}

/* every usercmd the game ran: ge->ClientThink, which SV_ClientThink calls for each of a move's commands */
static void (*game_client_think)(edict_t *ent, usercmd_t *cmd);
static void log_client_think(edict_t *ent, usercmd_t *cmd) {
	fprintf(out_json, "{\"t\":\"cmd\",\"f\":%d,\"msec\":%d,\"buttons\":%d,\"angles\":[%d,%d,%d],\"move\":[%d,%d,%d],\"impulse\":%d,\"light\":%d}\n",
		tick_no, cmd->msec, cmd->buttons, cmd->angles[0], cmd->angles[1], cmd->angles[2],
		cmd->forwardmove, cmd->sidemove, cmd->upmove, cmd->impulse, cmd->lightlevel);
	game_client_think(ent, cmd);
}

/* the game, hard-linked: game/g_main.c's GetGameAPI */
game_export_t *GetGameAPI(game_import_t *import);
void *Sys_GetGameAPI(void *parms) {
	game_export_t *g = GetGameAPI(parms);
	game_client_think = g->ClientThink;
	g->ClientThink = log_client_think;
	return g;
}

/* The server's stufftexts are commands for the client: "cmd configstrings ...", "precache ...".
 * The scripted player acts on them as id's client would, so catch them as the server writes them. */
#define MAX_STUFF 16
static char stuffed[MAX_STUFF][256];
static int nstuffed;
void __real_MSG_WriteString(sizebuf_t *sb, char *s);
void __wrap_MSG_WriteString(sizebuf_t *sb, char *s) {
	if (s && sb->cursize > 0 && sb->data[sb->cursize - 1] == svc_stufftext && nstuffed < MAX_STUFF
	    && sv.state == ss_game && sb == &svs.clients[0].netchan.message) {
		strncpy(stuffed[nstuffed], s, sizeof(stuffed[0]) - 1);
		nstuffed++;
	}
	__real_MSG_WriteString(sb, s);
}

/* the last frame the server wrote the player, which its next clc_move acknowledges */
static int last_frame = -1;
void __real_SV_WriteFrameToClient(client_t *client, sizebuf_t *msg);
void __wrap_SV_WriteFrameToClient(client_t *client, sizebuf_t *msg) {
	__real_SV_WriteFrameToClient(client, msg);
	if (client == svs.clients) last_frame = sv.framenum;
}

/* After each game frame, as SV_Frame goes on to send it: every edict in use. */
void __real_SV_SendClientMessages(void);
void __wrap_SV_SendClientMessages(void) {
	int i;
	if (ge && sv.state == ss_game) {
	fprintf(out_json, "{\"t\":\"ents\",\"f\":%d,\"framenum\":%d,\"time\":", tick_no, sv.framenum);
	jfloat(out_json, sv.time);
	fputs(",\"e\":[", out_json);
	for (i = 0; i < ge->num_edicts; i++) {
		edict_t *e = EDICT_NUM(i);
		entity_state_t *s = &e->s;
		if (!e->inuse) continue;
		fprintf(out_json, "%s{\"n\":%d,\"origin\":", i ? "," : "", s->number);
		jvec(out_json, s->origin);
		fputs(",\"angles\":", out_json); jvec(out_json, s->angles);
		fputs(",\"old_origin\":", out_json); jvec(out_json, s->old_origin);
		fprintf(out_json, ",\"model\":[%d,%d,%d,%d],\"frame\":%d,\"skin\":%d,\"effects\":%u,\"renderfx\":%d,\"solid\":%d,\"sound\":%d,\"event\":%d,\"svflags\":%d,\"mins\":",
			s->modelindex, s->modelindex2, s->modelindex3, s->modelindex4, s->frame, s->skinnum, s->effects, s->renderfx, s->solid, s->sound, s->event, e->svflags);
		jvec(out_json, e->mins);
		fputs(",\"maxs\":", out_json); jvec(out_json, e->maxs);
		if (e->client) {
			player_state_t *ps = &e->client->ps;
			fprintf(out_json, ",\"ps\":{\"pm_type\":%d,\"origin\":[%d,%d,%d],\"velocity\":[%d,%d,%d],\"pm_flags\":%d,\"pm_time\":%d,\"gravity\":%d,\"delta\":[%d,%d,%d],\"viewangles\":",
				ps->pmove.pm_type, ps->pmove.origin[0], ps->pmove.origin[1], ps->pmove.origin[2],
				ps->pmove.velocity[0], ps->pmove.velocity[1], ps->pmove.velocity[2], ps->pmove.pm_flags, ps->pmove.pm_time, ps->pmove.gravity,
				ps->pmove.delta_angles[0], ps->pmove.delta_angles[1], ps->pmove.delta_angles[2]);
			jvec(out_json, ps->viewangles);
			fputs(",\"viewoffset\":", out_json); jvec(out_json, ps->viewoffset);
			fputs(",\"kick\":", out_json); jvec(out_json, ps->kick_angles);
			fputs(",\"gunangles\":", out_json); jvec(out_json, ps->gunangles);
			fputs(",\"gunoffset\":", out_json); jvec(out_json, ps->gunoffset);
			fprintf(out_json, ",\"gunindex\":%d,\"gunframe\":%d,\"blend\":", ps->gunindex, ps->gunframe);
			fputc('[', out_json);
			jfloat(out_json, ps->blend[0]); fputc(',', out_json); jfloat(out_json, ps->blend[1]); fputc(',', out_json);
			jfloat(out_json, ps->blend[2]); fputc(',', out_json); jfloat(out_json, ps->blend[3]); fputc(']', out_json);
			fputs(",\"fov\":", out_json); jfloat(out_json, ps->fov);
			fprintf(out_json, ",\"rdflags\":%d,\"stats\":[", ps->rdflags);
			{
				int k;
				for (k = 0; k < MAX_STATS; k++) fprintf(out_json, "%s%d", k ? "," : "", ps->stats[k]);
			}
			fputs("]}", out_json);
		}
		fputc('}', out_json);
	}
	fputs("]}\n", out_json);
	}
	__real_SV_SendClientMessages();
}

/* ---------------------------------------------------------------------- the scripted player */

static netadr_t server_adr;
static netchan_t chan;
static enum { P_IDLE, P_CHALLENGE, P_CONNECTING, P_CONNECTED, P_SPAWNED } player = P_IDLE;
#define CMD_BACKUP 64
static usercmd_t cmds[CMD_BACKUP];
static int spawned_tick;

/* The player's input on a tick after it spawned: walk, turn, strafe, jump, crouch, fire, and
 * change weapon, in a fixed pattern, so the run covers movement, weapons and the HUD. */
static void script(usercmd_t *cmd, int t, int msec) {
	int phase = (t / 40) % 8;
	memset(cmd, 0, sizeof(*cmd));
	cmd->msec = msec;
	cmd->lightlevel = 128;
	cmd->angles[YAW] = ANGLE2SHORT((t * 3) % 360);
	cmd->angles[PITCH] = ANGLE2SHORT((t % 60) < 30 ? 10 : -10);
	switch (phase) {
	case 0: cmd->forwardmove = 400; break;
	case 1: cmd->forwardmove = 200; cmd->sidemove = 200; break;
	case 2: cmd->forwardmove = 400; if (t % 20 == 0) cmd->upmove = 200; break;
	case 3: cmd->sidemove = -400; cmd->buttons = (t % 8) < 4 ? BUTTON_ATTACK : 0; break;
	case 4: cmd->forwardmove = -200; cmd->upmove = -200; break;
	case 5: cmd->forwardmove = 400; cmd->buttons = BUTTON_ATTACK; break;
	case 6: cmd->forwardmove = 300; break; /* and a weapnext as it starts (send_move) */
	case 7: cmd->forwardmove = 400; cmd->sidemove = (t % 16) < 8 ? 300 : -300; break;
	}
}

static void send_string(char *s) {
	MSG_WriteByte(&chan.message, clc_stringcmd);
	MSG_WriteString(&chan.message, s);
}

/* CL_SendCmd's clc_move: the last three usercmds, delta-coded, with the sequence checksum */
static void send_move(int msec) {
	sizebuf_t buf;
	byte data[128];
	usercmd_t nullcmd, *oldcmd, *cmd;
	int checksumIndex, i;

	int t = tick_no - spawned_tick;

	/* 3.21's ClientThink ignores impulses: a weapon change is the weapnext command (ClientCommand) */
	if (t % 320 == 240) send_string("weapnext");
	script(&cmds[chan.outgoing_sequence & (CMD_BACKUP - 1)], t, msec);
	SZ_Init(&buf, data, sizeof(data));
	MSG_WriteByte(&buf, clc_move);
	checksumIndex = buf.cursize;
	MSG_WriteByte(&buf, 0);
	MSG_WriteLong(&buf, last_frame);
	memset(&nullcmd, 0, sizeof(nullcmd));
	i = (chan.outgoing_sequence - 2) & (CMD_BACKUP - 1);
	cmd = &cmds[i];
	MSG_WriteDeltaUsercmd(&buf, &nullcmd, cmd);
	oldcmd = cmd;
	i = (chan.outgoing_sequence - 1) & (CMD_BACKUP - 1);
	cmd = &cmds[i];
	MSG_WriteDeltaUsercmd(&buf, oldcmd, cmd);
	oldcmd = cmd;
	i = chan.outgoing_sequence & (CMD_BACKUP - 1);
	cmd = &cmds[i];
	MSG_WriteDeltaUsercmd(&buf, oldcmd, cmd);
	buf.data[checksumIndex] = COM_BlockSequenceCRCByte(buf.data + checksumIndex + 1, buf.cursize - checksumIndex - 1, chan.outgoing_sequence);
	Netchan_Transmit(&chan, buf.cursize, buf.data);
}

/* One step of the player after the server's frame: read what came back, then send. */
static void player_frame(int msec) {
	netadr_t from;
	sizebuf_t msg;
	static byte msg_buf[MAX_MSGLEN];
	int i, n;

	SZ_Init(&msg, msg_buf, sizeof(msg_buf));
	while (NET_GetPacket(NS_CLIENT, &from, &msg)) {
		if (*(int *)msg.data == -1) {
			char *s;
			MSG_BeginReading(&msg);
			MSG_ReadLong(&msg);
			s = MSG_ReadStringLine(&msg);
			Cmd_TokenizeString(s, false);
			if (!strcmp(Cmd_Argv(0), "challenge") && player == P_CHALLENGE) {
				Netchan_OutOfBandPrint(NS_CLIENT, server_adr, "connect %i %i %i \"%s\"\n", PROTOCOL_VERSION, (int)Cvar_VariableValue("qport"), atoi(Cmd_Argv(1)),
					"\\name\\player\\skin\\male/grunt\\hand\\0\\rate\\25000\\msg\\1\\fov\\90");
				player = P_CONNECTING;
			} else if (!strcmp(Cmd_Argv(0), "client_connect") && player == P_CONNECTING) {
				Netchan_Setup(NS_CLIENT, &chan, server_adr, (int)Cvar_VariableValue("qport"));
				send_string("new");
				player = P_CONNECTED;
			}
		} else if (player >= P_CONNECTED) {
			Netchan_Process(&chan, &msg);
		}
		SZ_Init(&msg, msg_buf, sizeof(msg_buf));
	}

	/* the server's stufftexts, as CL_ParseServerMessage hands them to the command buffer */
	n = nstuffed;
	nstuffed = 0;
	for (i = 0; i < n; i++) {
		char line[256];
		strcpy(line, stuffed[i]);
		Cmd_TokenizeString(line, false);
		if (!strcmp(Cmd_Argv(0), "cmd")) send_string(Cmd_Args());
		else if (!strcmp(Cmd_Argv(0), "precache")) {
			send_string(va("begin %i\n", atoi(Cmd_Argv(1))));
			player = P_SPAWNED;
			spawned_tick = tick_no + 1;
		}
	}

	switch (player) {
	case P_IDLE:
		if (sv.state == ss_game) {
			NET_StringToAdr("localhost", &server_adr);
			Netchan_OutOfBandPrint(NS_CLIENT, server_adr, "getchallenge\n");
			player = P_CHALLENGE;
		}
		break;
	case P_CONNECTED:
		Netchan_Transmit(&chan, 0, NULL);
		break;
	case P_SPAWNED:
		send_move(msec);
		break;
	default:
		break;
	}
}

/* ---------------------------------------------------------------------- main */

int main(int argc, char **argv) {
	char path[1200];
	char *args[64];
	int n = 0, i, msec, ticks;

	if (argc < 3) {
		fprintf(stderr, "usage: q2server <basedir> <out> [msec=25] [ticks=2400] [quake args...]\n");
		return 2;
	}
	msec = argc > 3 ? atoi(argv[3]) : 25;
	ticks = argc > 4 ? atoi(argv[4]) : 2400;
	mkdir(argv[2], 0777);
	snprintf(path, sizeof(path), "%s/server.jsonl", argv[2]);
	out_json = fopen(path, "w");
	if (!out_json) Sys_Error("cannot write to %s", argv[2]);

	args[n++] = "q2server";
	args[n++] = "+set"; args[n++] = "basedir"; args[n++] = argv[1];
	args[n++] = "+set"; args[n++] = "dedicated"; args[n++] = "0";
	args[n++] = "+set"; args[n++] = "qport"; args[n++] = "1234";
	for (i = 5; i < argc && n < 60; i++) args[n++] = argv[i];
	if (argc <= 5) { args[n++] = "+map"; args[n++] = "demo1"; }
	args[n] = NULL;

	Qcommon_Init(n, args);
	for (tick_no = 0; tick_no < ticks; tick_no++) {
		vclock += msec;
		fprintf(out_json, "{\"t\":\"tick\",\"f\":%d,\"msec\":%d,\"clock\":%d}\n", tick_no, msec, vclock);
		Qcommon_Frame(msec);
		player_frame(msec);
	}
	fclose(out_json);
	return 0;
}
