// Faithful ports of id's 3.21 C, in its 32-bit floats, held to the C by the oracles (oracle/):
// q_shared.c's vector helpers and qcommon/pmove.c. The client port (@quake2ts/client's
// OriginalClient) and the server port use them, so client and server move a player identically,
// as id's did by linking the same pmove.c into both.
export * from './qmath.js';
export * from './pmove.js';
