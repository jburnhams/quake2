
export enum ServerCommand {
  bad = 0,

  // these ops are known to the game dll
  muzzleflash = 1,
  muzzleflash2 = 2,
  temp_entity = 3,
  layout = 4,
  inventory = 5,

  // the rest are private to the client and server
  nop = 6,
  disconnect = 7,
  reconnect = 8,
  sound = 9,            // <see code>
  print = 10,           // [byte] id [string] null terminated string
  stufftext = 11,       // [string] stuffed into client's console buffer, should be \n terminated
  serverdata = 12,      // [long] protocol ...
  configstring = 13,    // [short] [string]
  spawnbaseline = 14,
  centerprint = 15,     // [string] to put in center of the screen
  download = 16,        // [short] size [size bytes]
  playerinfo = 17,      // variable
  packetentities = 18,  // [...]
  deltapacketentities = 19, // [...]
  frame = 20
}

export enum ClientCommand {
  bad = 0,
  nop = 1,
  move = 2,             // [[usercmd_t]
  userinfo = 3,         // [[userinfo string]
  stringcmd = 4         // [string] message
}
