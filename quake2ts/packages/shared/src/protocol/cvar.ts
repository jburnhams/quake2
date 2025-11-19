export const enum CvarFlags {
  None = 0,
  Archive = 1 << 0,
  UserInfo = 1 << 1,
  ServerInfo = 1 << 2,
  Latch = 1 << 3,
  Cheat = 1 << 4,
}

export interface CvarDefinition {
  readonly name: string;
  readonly defaultValue: string;
  readonly description?: string;
  readonly flags?: CvarFlags;
}
