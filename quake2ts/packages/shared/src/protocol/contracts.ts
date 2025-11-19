export interface ContractValidationResult {
  missing: string[];
  nonFunctions: string[];
  extras: string[];
}

export interface ContractValidationOptions {
  readonly name?: string;
  readonly allowExtra?: boolean;
}

export type ContractFunctionMap<Keys extends readonly string[]> = Record<Keys[number], (...args: unknown[]) => unknown>;

function normalize(object: Record<string, unknown> | undefined): Record<string, unknown> {
  return object ?? {};
}

export function validateContract<Keys extends readonly string[]>(
  table: Record<string, unknown> | undefined,
  requiredKeys: Keys,
  options: ContractValidationOptions = {},
): ContractValidationResult {
  const normalized = normalize(table);
  const missing: string[] = [];
  const nonFunctions: string[] = [];

  for (const key of requiredKeys) {
    if (!(key in normalized)) {
      missing.push(key);
      continue;
    }

    if (typeof normalized[key] !== 'function') {
      nonFunctions.push(key);
    }
  }

  const extras = options.allowExtra === false ? Object.keys(normalized).filter((key) => !requiredKeys.includes(key)) : [];

  return { missing, nonFunctions, extras } satisfies ContractValidationResult;
}

export function assertContract<Keys extends readonly string[]>(
  table: Record<string, unknown> | undefined,
  requiredKeys: Keys,
  options: ContractValidationOptions = {},
): asserts table is ContractFunctionMap<Keys> {
  const { missing, nonFunctions, extras } = validateContract(table, requiredKeys, options);
  if (missing.length === 0 && nonFunctions.length === 0 && extras.length === 0) {
    return;
  }

  const pieces: string[] = [];
  if (missing.length > 0) {
    pieces.push(`missing: ${missing.join(', ')}`);
  }
  if (nonFunctions.length > 0) {
    pieces.push(`non-functions: ${nonFunctions.join(', ')}`);
  }
  if (extras.length > 0) {
    pieces.push(`extras: ${extras.join(', ')}`);
  }

  const label = options.name ?? 'contract';
  throw new Error(`${label} validation failed (${pieces.join('; ')})`);
}

export const GAME_IMPORT_KEYS = [
  'Broadcast_Print',
  'Com_Print',
  'Client_Print',
  'Center_Print',
  'sound',
  'positioned_sound',
  'local_sound',
  'configstring',
  'get_configstring',
  'Com_Error',
  'modelindex',
  'soundindex',
  'imageindex',
  'setmodel',
  'trace',
  'clip',
  'pointcontents',
  'inPVS',
  'inPHS',
  'SetAreaPortalState',
  'AreasConnected',
  'linkentity',
  'unlinkentity',
  'BoxEdicts',
  'multicast',
  'unicast',
] as const;

export const GAME_EXPORT_KEYS = [
  'PreInit',
  'Init',
  'Shutdown',
  'SpawnEntities',
  'WriteGameJson',
  'ReadGameJson',
  'WriteLevelJson',
  'ReadLevelJson',
  'CanSave',
  'ClientConnect',
  'ClientThink',
  'RunFrame',
  'Pmove',
] as const;

export const CGAME_IMPORT_KEYS = [
  'Com_Print',
  'get_configstring',
  'Com_Error',
  'TagMalloc',
  'TagFree',
  'AddCommandString',
  'CL_FrameValid',
  'CL_FrameTime',
  'CL_ClientTime',
  'CL_ServerFrame',
  'Draw_RegisterPic',
  'Draw_GetPicSize',
  'SCR_DrawChar',
  'SCR_DrawPic',
  'SCR_DrawColorPic',
] as const;

export const CGAME_EXPORT_KEYS = [
  'Init',
  'Shutdown',
  'DrawHUD',
  'TouchPics',
  'LayoutFlags',
  'GetActiveWeaponWheelWeapon',
  'GetOwnedWeaponWheelWeapons',
  'GetWeaponWheelAmmoCount',
  'GetPowerupWheelCount',
  'GetHitMarkerDamage',
  'Pmove',
  'ParseConfigString',
  'ParseCenterPrint',
  'ClearNotify',
  'ClearCenterprint',
  'NotifyMessage',
  'GetMonsterFlashOffset',
] as const;
