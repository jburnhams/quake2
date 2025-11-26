import { NetDriver, UserCommand, PlayerState, EntityState } from '@quake2ts/shared';
import { Entity } from '@quake2ts/game';

export enum ClientState {
  Free,
  Connected, // Connection established, waiting for challenge/info
  Primed,    // Sent info, waiting for gamestate
  Active    // In game
}

export interface Client {
  index: number; // Client index (0 to maxClients - 1)
  state: ClientState;
  net: NetDriver;
  name: string;
  userInfo: string;

  // Game state
  edict: Entity | null; // The player entity
  lastCmd: UserCommand;
  ps: PlayerState; // Player state sent to client each frame

  // Network stats
  lastPacketTime: number;

  // For delta compression
  lastFrame: number;
  frame_entities: { [entityId: number]: EntityState };
}

import { createPlayerState } from '@quake2ts/shared';

export function createClient(index: number, net: NetDriver): Client {
    return {
        index,
        state: ClientState.Connected,
        net,
        name: `Player ${index}`,
        userInfo: '',
        edict: null,
        lastCmd: {
            msec: 0,
            buttons: 0,
            angles: { x: 0, y: 0, z: 0 },
            forwardmove: 0,
            sidemove: 0,
            upmove: 0
        },
        ps: createPlayerState(),
        lastPacketTime: Date.now(),
        lastFrame: 0,
        frame_entities: {}
    };
}
