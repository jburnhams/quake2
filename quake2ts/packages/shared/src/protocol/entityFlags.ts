
// flags for delta encoding
export const U_NUMBER = 1 << 0;
export const U_MODEL = 1 << 1;
export const U_SOUND = 1 << 2;
export const U_ORIGIN1 = 1 << 3;
export const U_ORIGIN2 = 1 << 4;
export const U_ORIGIN3 = 1 << 5;
export const U_ANGLE1 = 1 << 6;
export const U_ANGLE2 = 1 << 7;
export const U_ANGLE3 = 1 << 8;
export const U_FRAME = 1 << 9;
export const U_SKIN = 1 << 10;
export const U_EFFECTS = 1 << 11;
export const U_RENDERFX = 1 << 12;
export const U_SOLID = 1 << 13;
export const U_EVENT = 1 << 14;
export const U_MOREBITS = 1 << 15;

// bits in U_MOREBITS
export const U_MODEL2 = 1 << 0;
export const U_MODEL3 = 1 << 1;
export const U_MODEL4 = 1 << 2;

// a sound without a message is a logical error

// special value for entity removal
export const U_REMOVE = 0x8000;
