/**
 * The original game's limits and flags (game/q_shared.h, client/client.h, client/ref.h of id's
 * Quake 2 3.21), which protocols 31 to 34 use. The rerelease renumbered the configstrings and raised
 * the limits; `@quake2ts/shared`'s CS_* are the rerelease's, so a 3.x demo read with them finds its
 * model names in the wrong places.
 */
export const MAX_EDICTS = 1024;
export const MAX_MODELS = 256;
export const MAX_SOUNDS = 256;
export const MAX_IMAGES = 256;
export const MAX_LIGHTSTYLES = 256;
export const MAX_ITEMS = 256;
export const MAX_CLIENTS = 256;
export const MAX_GENERAL = MAX_CLIENTS * 2;
export const MAX_STATS = 32;
export const MAX_QPATH = 64;

export const CS_NAME = 0;
export const CS_CDTRACK = 1;
export const CS_SKY = 2;
export const CS_SKYAXIS = 3;
export const CS_SKYROTATE = 4;
export const CS_STATUSBAR = 5;
export const CS_AIRACCEL = 29;
export const CS_MAXCLIENTS = 30;
export const CS_MAPCHECKSUM = 31;
export const CS_MODELS = 32;
export const CS_SOUNDS = CS_MODELS + MAX_MODELS;
export const CS_IMAGES = CS_SOUNDS + MAX_SOUNDS;
export const CS_LIGHTS = CS_IMAGES + MAX_IMAGES;
export const CS_ITEMS = CS_LIGHTS + MAX_LIGHTSTYLES;
export const CS_PLAYERSKINS = CS_ITEMS + MAX_ITEMS;
export const CS_GENERAL = CS_PLAYERSKINS + MAX_CLIENTS;
export const MAX_CONFIGSTRINGS = CS_GENERAL + MAX_GENERAL;

export const UPDATE_BACKUP = 16;
export const UPDATE_MASK = UPDATE_BACKUP - 1;
export const CMD_BACKUP = 64;
export const MAX_PARSE_ENTITIES = 1024;
export const MAX_ENTITIES = 128;
export const MAX_DLIGHTS = 32;
export const MAX_PARTICLES = 4096;
export const MAX_CLIENTWEAPONMODELS = 20;

export const PM_NORMAL = 0;
export const PM_SPECTATOR = 1;
export const PM_DEAD = 2;
export const PM_GIB = 3;
export const PM_FREEZE = 4;

export const PMF_DUCKED = 1;
export const PMF_JUMP_HELD = 2;
export const PMF_ON_GROUND = 4;
export const PMF_TIME_WATERJUMP = 8;
export const PMF_TIME_LAND = 16;
export const PMF_TIME_TELEPORT = 32;
export const PMF_NO_PREDICTION = 64;

export const EF_ROTATE = 0x00000001;
export const EF_GIB = 0x00000002;
export const EF_BLASTER = 0x00000008;
export const EF_ROCKET = 0x00000010;
export const EF_GRENADE = 0x00000020;
export const EF_HYPERBLASTER = 0x00000040;
export const EF_BFG = 0x00000080;
export const EF_COLOR_SHELL = 0x00000100;
export const EF_POWERSCREEN = 0x00000200;
export const EF_ANIM01 = 0x00000400;
export const EF_ANIM23 = 0x00000800;
export const EF_ANIM_ALL = 0x00001000;
export const EF_ANIM_ALLFAST = 0x00002000;
export const EF_FLIES = 0x00004000;
export const EF_QUAD = 0x00008000;
export const EF_PENT = 0x00010000;
export const EF_TELEPORTER = 0x00020000;
export const EF_FLAG1 = 0x00040000;
export const EF_FLAG2 = 0x00080000;
export const EF_IONRIPPER = 0x00100000;
export const EF_GREENGIB = 0x00200000;
export const EF_BLUEHYPERBLASTER = 0x00400000;
export const EF_SPINNINGLIGHTS = 0x00800000;
export const EF_PLASMA = 0x01000000;
export const EF_TRAP = 0x02000000;
export const EF_TRACKER = 0x04000000;
export const EF_DOUBLE = 0x08000000;
export const EF_SPHERETRANS = 0x10000000;
export const EF_TAGTRAIL = 0x20000000;
export const EF_HALF_DAMAGE = 0x40000000;
export const EF_TRACKERTRAIL = 0x80000000;

export const RF_MINLIGHT = 1;
export const RF_VIEWERMODEL = 2;
export const RF_WEAPONMODEL = 4;
export const RF_FULLBRIGHT = 8;
export const RF_DEPTHHACK = 16;
export const RF_TRANSLUCENT = 32;
export const RF_FRAMELERP = 64;
export const RF_BEAM = 128;
export const RF_CUSTOMSKIN = 256;
export const RF_GLOW = 512;
export const RF_SHELL_RED = 1024;
export const RF_SHELL_GREEN = 2048;
export const RF_SHELL_BLUE = 4096;
export const RF_IR_VISIBLE = 0x00008000;
export const RF_SHELL_DOUBLE = 0x00010000;
export const RF_SHELL_HALF_DAM = 0x00020000;
export const RF_USE_DISGUISE = 0x00040000;

export const EV_NONE = 0;
export const EV_ITEM_RESPAWN = 1;
export const EV_FOOTSTEP = 2;
export const EV_FALLSHORT = 3;
export const EV_FALL = 4;
export const EV_FALLFAR = 5;
export const EV_PLAYER_TELEPORT = 6;
export const EV_OTHER_TELEPORT = 7;

// entity_state_t delta bits (qcommon.h)
export const U_ORIGIN1 = 1 << 0;
export const U_ORIGIN2 = 1 << 1;
export const U_ANGLE2 = 1 << 2;
export const U_ANGLE3 = 1 << 3;
export const U_FRAME8 = 1 << 4;
export const U_EVENT = 1 << 5;
export const U_REMOVE = 1 << 6;
export const U_MOREBITS1 = 1 << 7;
export const U_NUMBER16 = 1 << 8;
export const U_ORIGIN3 = 1 << 9;
export const U_ANGLE1 = 1 << 10;
export const U_MODEL = 1 << 11;
export const U_RENDERFX8 = 1 << 12;
export const U_EFFECTS8 = 1 << 14;
export const U_MOREBITS2 = 1 << 15;
export const U_SKIN8 = 1 << 16;
export const U_FRAME16 = 1 << 17;
export const U_RENDERFX16 = 1 << 18;
export const U_EFFECTS16 = 1 << 19;
export const U_MODEL2 = 1 << 20;
export const U_MODEL3 = 1 << 21;
export const U_MODEL4 = 1 << 22;
export const U_MOREBITS3 = 1 << 23;
export const U_OLDORIGIN = 1 << 24;
export const U_SKIN16 = 1 << 25;
export const U_SOUND = 1 << 26;
export const U_SOLID = 1 << 27;

// svc_sound's flags (q_shared.h / qcommon.h) and their defaults
export const SND_VOLUME = 1 << 0;
export const SND_ATTENUATION = 1 << 1;
export const SND_POS = 1 << 2;
export const SND_ENT = 1 << 3;
export const SND_OFFSET = 1 << 4;
export const DEFAULT_SOUND_PACKET_VOLUME = 1.0;
export const DEFAULT_SOUND_PACKET_ATTENUATION = 1.0;

/** svc_print's chat level, which beeps (q_shared.h). */
export const PRINT_CHAT = 3;
