import type { ChannelManager } from './channel-manager'

/** Register lazy factories without parsing optional provider SDKs on every app startup. */
export function registerBuiltInChannelProviders(channelManager: ChannelManager): void {
  channelManager.registerFactory('feishu-bot', async (instance, notify) => {
    const { createFeishuService } = await import('./providers/feishu/feishu-service')
    return createFeishuService(instance, notify)
  })

  channelManager.registerFactory('dingtalk-bot', async (instance, notify) => {
    const { createDingTalkService } = await import('./providers/dingtalk/dingtalk-service')
    return createDingTalkService(instance, notify)
  })

  channelManager.registerFactory('telegram-bot', async (instance, notify) => {
    const [{ createTelegramService }, { parseTelegramWsMessage }] = await Promise.all([
      import('./providers/telegram/telegram-service'),
      import('./providers/telegram/parse-ws-message')
    ])
    channelManager.registerParser('telegram-bot', parseTelegramWsMessage)
    return createTelegramService(instance, notify)
  })

  channelManager.registerFactory('discord-bot', async (instance, notify) => {
    const [{ createDiscordService }, { parseDiscordWsMessage }] = await Promise.all([
      import('./providers/discord/discord-service'),
      import('./providers/discord/parse-ws-message')
    ])
    channelManager.registerParser('discord-bot', parseDiscordWsMessage)
    return createDiscordService(instance, notify)
  })

  channelManager.registerFactory('whatsapp-bot', async (instance, notify) => {
    const [{ createWhatsAppService }, { parseWhatsAppWsMessage }] = await Promise.all([
      import('./providers/whatsapp/whatsapp-service'),
      import('./providers/whatsapp/parse-ws-message')
    ])
    channelManager.registerParser('whatsapp-bot', parseWhatsAppWsMessage)
    return createWhatsAppService(instance, notify)
  })

  channelManager.registerFactory('wecom-bot', async (instance, notify) => {
    const [{ createWeComService }, { parseWeComWsMessage }] = await Promise.all([
      import('./providers/wecom/wecom-service'),
      import('./providers/wecom/parse-ws-message')
    ])
    channelManager.registerParser('wecom-bot', parseWeComWsMessage)
    return createWeComService(instance, notify)
  })

  channelManager.registerFactory('qq-bot', async (instance, notify) => {
    const [{ createQQService }, { parseQQWsMessage }] = await Promise.all([
      import('./providers/qq/qq-service'),
      import('./providers/qq/parse-ws-message')
    ])
    channelManager.registerParser('qq-bot', parseQQWsMessage)
    return createQQService(instance, notify)
  })

  channelManager.registerFactory('weixin-official', async (instance, notify) => {
    const { createWeixinService } = await import('./providers/weixin/weixin-service')
    return createWeixinService(instance, notify)
  })
}
