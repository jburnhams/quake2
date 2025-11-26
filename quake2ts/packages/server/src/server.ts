// See rerelease/server/server.h

import { CollisionModel } from "@quake2ts/shared";
import { Client } from "./client";

/**
 * ServerStatic holds the state that is constant across server restarts.
 * Corresponds to server_static_t in the original source.
 */
export interface ServerStatic {
  clients: (Client | null)[];
}

/**
 * Server holds the state for the current running server instance.
 * Corresponds to server_t in the original source.
 */
export interface Server {
  // Time
  startTime: number;
  time: number;
  frame: number;

  // Map
  mapName: string;
  collisionModel: CollisionModel | null;
}
