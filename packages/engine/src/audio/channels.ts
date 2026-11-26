import { MAX_SOUND_CHANNELS, SoundChannel } from './constants.js';

const CHANNEL_MASK = 0x07;

export const baseChannel = (entchannel: number): number => entchannel & CHANNEL_MASK;

export interface ChannelState {
  entnum: number;
  entchannel: number;
  endTimeMs: number;
  isPlayer: boolean;
  active: boolean;
}

export interface ChannelPickContext {
  readonly nowMs: number;
  readonly playerEntity?: number;
}

export function createInitialChannels(playerEntity?: number): ChannelState[] {
  return Array.from({ length: MAX_SOUND_CHANNELS }, () => ({
    entnum: 0,
    entchannel: SoundChannel.Auto,
    endTimeMs: 0,
    isPlayer: false,
    active: false,
  } satisfies ChannelState)).map((channel) => ({ ...channel, isPlayer: channel.entnum === playerEntity }));
}

export function pickChannel(
  channels: ChannelState[],
  entnum: number,
  entchannel: number,
  context: ChannelPickContext,
): number | undefined {
  if (entchannel < 0) {
    throw new Error('pickChannel: entchannel must be non-negative');
  }

  const normalizedEntchannel = baseChannel(entchannel);
  let firstToDie = -1;
  let lifeLeft = Number.POSITIVE_INFINITY;

  for (let i = 0; i < channels.length; i += 1) {
    const channel = channels[i];
    const channelBase = baseChannel(channel.entchannel);

    if (
      normalizedEntchannel !== SoundChannel.Auto &&
      channel.entnum === entnum &&
      channelBase === normalizedEntchannel
    ) {
      firstToDie = i;
      break;
    }

    if (channel.active && channel.entnum === context.playerEntity && entnum !== context.playerEntity) {
      continue;
    }

    const remainingLife = channel.endTimeMs - context.nowMs;
    if (firstToDie === -1 || remainingLife < lifeLeft) {
      lifeLeft = remainingLife;
      firstToDie = i;
    }
  }

  return firstToDie === -1 ? undefined : firstToDie;
}
