import WebSocket from 'ws'
import { markQqWakeupSent, resolveQqWakeupEligibility } from '../../../db/qq-wakeup-dao'
import type {
  ChannelEvent,
  ChannelGroup,
  ChannelInstance,
  ChannelMessage,
  MessagingChannelService
} from '../../channel-types'
import { QQApi, parseQQChatId } from './qq-api'
import { decodeQQReplyReference, parseQQWsMessage } from './parse-ws-message'
import { clearSession, loadSession, saveSession } from './session-store'

interface QQGatewayPayload {
  op?: number
  d?: unknown
  s?: number
  t?: string
}

const INTENTS = {
  GUILD_MEMBERS: 1 << 1,
  DIRECT_MESSAGE: 1 << 12,
  GROUP_AND_C2C: 1 << 25,
  PUBLIC_GUILD_MESSAGES: 1 << 30
}

const INTENT_LEVELS = [
  {
    name: 'full',
    intents: INTENTS.PUBLIC_GUILD_MESSAGES | INTENTS.DIRECT_MESSAGE | INTENTS.GROUP_AND_C2C,
    description: 'Group + C2C + Channel DM + Channel Messages'
  },
  {
    name: 'group-channel',
    intents: INTENTS.PUBLIC_GUILD_MESSAGES | INTENTS.GROUP_AND_C2C,
    description: 'Group + C2C + Channel Messages'
  },
  {
    name: 'channel-only',
    intents: INTENTS.PUBLIC_GUILD_MESSAGES | INTENTS.GUILD_MEMBERS,
    description: 'Channel Messages Only'
  }
] as const

const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000]
const INVALID_SESSION_RECONNECT_DELAY = 3000

function parseBooleanConfig(value: string | undefined): boolean {
  return /^(1|true|yes|on)$/i.test((value ?? '').trim())
}

