// The light styles: how bright each of a map's 256 lights is, as a string of letters played at
// ten a second. The game sends them to clients as CS_LIGHTS configstrings (SP_worldspawn, from
// g_spawn.cpp), and the client turns the letter for the current tenth into a brightness that
// scales the lightmap made for that style (CL_SetLightstyle and CL_RunLightStyles, cl_fx.c).
// qrad3 bakes a separate lightmap for each style a face is lit by (up to four), so a flickering
// torch costs nothing at run time: the renderer only changes the weight of its layer.

/**
 * The game's table, set by SP_worldspawn. "Setup light animation tables. 'a' is total darkness,
 * 'z' is doublebright." 12 to 14 are the rerelease's ([Paril-KEX], from the N64 port); styles
 * 32 to 62 are given by qrad3 to switchable lights, and set by SP_light.
 */
export const DEFAULT_LIGHT_STYLES: ReadonlyMap<number, { readonly name: string; readonly pattern: string }> = new Map([
  [0, { name: 'Normal', pattern: 'm' }],
  [1, { name: 'Flicker (first variety)', pattern: 'mmnmmommommnonmmonqnmmo' }],
  [2, { name: 'Slow strong pulse', pattern: 'abcdefghijklmnopqrstuvwxyzyxwvutsrqponmlkjihgfedcba' }],
  [3, { name: 'Candle (first variety)', pattern: 'mmmmmaaaaammmmmaaaaaabcdefgabcdefg' }],
  [4, { name: 'Fast strobe', pattern: 'mamamamamama' }],
  [5, { name: 'Gentle pulse 1', pattern: 'jklmnopqrstuvwxyzyxwvutsrqponmlkj' }],
  [6, { name: 'Flicker (second variety)', pattern: 'nmonqnmomnmomomno' }],
  [7, { name: 'Candle (second variety)', pattern: 'mmmaaaabcdefgmmmmaaaammmaamm' }],
  [8, { name: 'Candle (third variety)', pattern: 'mmmaaammmaaammmabcdefaaaammmmabcdefmmmaaaa' }],
  [9, { name: 'Slow strobe (fourth variety)', pattern: 'aaaaaaaazzzzzzzz' }],
  [10, { name: 'Fluorescent flicker', pattern: 'mmamammmmammamamaaamammma' }],
  [11, { name: 'Slow pulse not fade to black', pattern: 'abcdefghijklmnopqrrqponmlkjihgfedcba' }],
  [12, { name: "N64's 2 (fast strobe)", pattern: 'zzazazzzzazzazazaaazazzza' }],
  [13, { name: "N64's 3 (half of strong pulse)", pattern: 'abcdefghijklmnopqrstuvwxyz' }],
  [14, { name: "N64's 4 (fast strobe)", pattern: 'abcdefghijklmnopqrstuvwxyzyxwvutsrqponmlkjihgfedcba' }],
  [63, { name: 'Testing', pattern: 'a' }],
]);

/** The first style qrad3 gives a switchable light (a targeted `light`). */
export const FIRST_SWITCHABLE_LIGHT_STYLE = 32;

