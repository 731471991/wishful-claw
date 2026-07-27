import * as https from 'https'
import { request, BASE_URL } from './feishu-http'
import { FeishuBitableApi } from './feishu-bitable-api'
import { FeishuMediaApi } from './feishu-media-api'

// ── Feishu Open API Client ──

export class FeishuApi {
  private accessToken = ''
  private tokenExpiresAt = 0
  private _bitable: FeishuBitableApi | null = null
  private _media: FeishuMediaApi | null = null

  constructor(
    private appId: string,
    private appSecret: string
  ) {}

  /** Get or refresh tenant access token */
  async ensureToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken
    }

    const res = await request(
      'POST',
      '/open-apis/auth/v3/tenant_access_token/internal',
      {},
      JSON.stringify({ app_id: this.appId, app_secret: this.appSecret })
    )

    const data = JSON.parse(res.body)
    if (data.code !== 0) {
      throw new Error(`Feishu auth failed: ${data.msg}`)
    }

    this.accessToken = data.tenant_access_token
    // Token expires in `expire` seconds, refresh 60s early
    this.tokenExpiresAt = Date.now() + (data.expire - 60) * 1000
    return this.accessToken
  }

  private async authHeaders(): Promise<Record<string, string>> {
    const token = await this.ensureToken()
    return { Authorization: `Bearer ${token}` }
  }

  /** Bitable (多维表格) API — lazily initialized */
  get bitable(): FeishuBitableApi {
    if (!this._bitable) {
      this._bitable = new FeishuBitableApi(() => this.authHeaders())
    }
    return this._bitable
  }

  /** Media (image/file) API — lazily initialized */
  get media(): FeishuMediaApi {
    if (!this._media) {
      this._media = new FeishuMediaApi(
        () => this.authHeaders(),
        () => this.ensureToken()
      )
    }
    return this._media
  }

  /** Get the bot's own identity (open_id, app_name) */
  async getBotInfo(): Promise<{ openId: string; appName: string }> {
    const headers = await this.authHeaders()
    const res = await request('GET', '/open-apis/bot/v3/info', headers)
    const data = JSON.parse(res.body)
    if (data.code !== 0) {
      throw new Error(`Feishu getBotInfo failed: ${data.msg}`)
    }
    return {
      openId: data.bot?.open_id ?? '',
      appName: data.bot?.app_name ?? ''
    }
  }

  /** Send a message to a chat */
  async sendMessage(
    chatId: string,
    content: string,
    msgType = 'text'
  ): Promise<{ messageId: string }> {
    const headers = await this.authHeaders()
    const body = JSON.stringify({
      receive_id: chatId,
      msg_type: msgType,
      content: msgType === 'text' ? JSON.stringify({ text: content }) : content
    })

    const res = await request(
      'POST',
      `/open-apis/im/v1/messages?receive_id_type=chat_id`,
      headers,
      body
    )

    const data = JSON.parse(res.body)
    if (data.code !== 0) {
      throw new Error(`Feishu sendMessage failed: ${data.msg}`)
    }
    return { messageId: data.data?.message_id ?? '' }
  }

  /** Reply to a specific message */
  async replyMessage(messageId: string, content: string): Promise<{ messageId: string }> {
    const headers = await this.authHeaders()
    const body = JSON.stringify({
      msg_type: 'text',
      content: JSON.stringify({ text: content })
    })

    const res = await request('POST', `/open-apis/im/v1/messages/${messageId}/reply`, headers, body)

    const data = JSON.parse(res.body)
    if (data.code !== 0) {
      throw new Error(`Feishu replyMessage failed: ${data.msg}`)
    }
    return { messageId: data.data?.message_id ?? '' }
  }

  /** Get chat info by chat_id — returns chat name, type, etc. */
  async getChatInfo(chatId: string): Promise<{ name: string; chatType: string } | null> {
    try {
      const headers = await this.authHeaders()
      const res = await request('GET', `/open-apis/im/v1/chats/${chatId}`, headers)
      const data = JSON.parse(res.body)
      if (data.code !== 0) return null
      return {
        name: data.data?.name ?? '',
        chatType: data.data?.chat_type ?? ''
      }
    } catch {
      return null
    }
  }

  /** Get user profile info (name) by ID */
  async getUserProfile(
    userId: string,
    idType: 'open_id' | 'user_id' | 'union_id' = 'open_id'
  ): Promise<{ name: string } | null> {
    if (!userId) return null
    try {
      const headers = await this.authHeaders()
      const encodedId = encodeURIComponent(userId)
      const res = await request(
        'GET',
        `/open-apis/contact/v3/users/${encodedId}?user_id_type=${idType}`,
        headers
      )
      const data = JSON.parse(res.body)
      if (data.code !== 0) return null
      return {
        name: data.data?.user?.name ?? ''
      }
    } catch {
      return null
    }
  }

  /** List chats/groups the bot is in */
  async listChats(): Promise<
    Array<{ chat_id: string; name: string; member_count?: number; raw: unknown }>
  > {
    const headers = await this.authHeaders()
    const res = await request('GET', '/open-apis/im/v1/chats?page_size=50', headers)

    const data = JSON.parse(res.body)
    if (data.code !== 0) {
      throw new Error(`Feishu listChats failed: ${data.msg}`)
    }

    return (data.data?.items ?? []).map(
      (item: { chat_id: string; name: string; member_count?: number }) => ({
        chat_id: item.chat_id,
        name: item.name,
        member_count: item.member_count,
        raw: item
      })
    )
  }

  /** List members in a chat (group) */
  async listChatMembers(args: {
    chatId: string
    pageToken?: string
    pageSize?: number
    memberIdType?: 'open_id' | 'user_id' | 'union_id'
  }): Promise<{ items: unknown[]; page_token?: string; has_more?: boolean }> {
    const headers = await this.authHeaders()
    const pageSize = Math.min(Math.max(args.pageSize ?? 50, 1), 50)
    const memberIdType = args.memberIdType ?? 'open_id'
    const tokenParam = args.pageToken ? `&page_token=${encodeURIComponent(args.pageToken)}` : ''
    const encodedChatId = encodeURIComponent(args.chatId)
    const res = await request(
      'GET',
      `/open-apis/im/v1/chats/${encodedChatId}/members?member_id_type=${memberIdType}&page_size=${pageSize}${tokenParam}`,
      headers
    )

    const data = JSON.parse(res.body)
    if (data.code !== 0) {
      throw new Error(`Feishu listChatMembers failed: ${data.msg}`)
    }
    return {
      items: data.data?.items ?? [],
      page_token: data.data?.page_token,
      has_more: data.data?.has_more
    }
  }

  // ── CardKit API — Streaming Card Support ──

  /** Create a card entity for streaming updates */
  async createCard(initialContent: string, title = 'AI Assistant'): Promise<{ cardId: string }> {
    const headers = await this.authHeaders()
    const cardData = {
      schema: '2.0',
      config: { update_multi: true, streaming_mode: true },
      header: { title: { tag: 'plain_text', content: title } },
      body: { elements: [{ tag: 'markdown', content: initialContent }] }
    }

    const res = await request(
      'POST',
      '/open-apis/cardkit/v1/cards',
      headers,
      JSON.stringify({ type: 'card_json', data: JSON.stringify(cardData) })
    )

    const data = JSON.parse(res.body)
    if (data.code !== 0) {
      throw new Error(`Feishu createCard failed: ${data.msg}`)
    }
    return { cardId: data.data?.card_id ?? '' }
  }

  /** Update a card entity content (sequence must be strictly incrementing) */
  async updateCard(
    cardId: string,
    content: string,
    sequence: number,
    title = 'AI Assistant'
  ): Promise<boolean> {
    const headers = await this.authHeaders()
    const cardData = {
      schema: '2.0',
      config: { update_multi: true, streaming_mode: true },
      header: { title: { tag: 'plain_text', content: title } },
      body: { elements: [{ tag: 'markdown', content }] }
    }

    const res = await request(
      'PUT',
      `/open-apis/cardkit/v1/cards/${cardId}`,
      headers,
      JSON.stringify({ card: { type: 'card_json', data: JSON.stringify(cardData) }, sequence })
    )

    const data = JSON.parse(res.body)
    if (data.code !== 0) {
      console.warn(`[Feishu] updateCard failed (seq=${sequence}): ${data.msg}`)
      return false
    }
    return true
  }

  /** Send a card message to a chat using an existing card_id */
  async sendCardMessage(chatId: string, cardId: string): Promise<{ messageId: string }> {
    const headers = await this.authHeaders()
    const body = JSON.stringify({
      receive_id: chatId,
      msg_type: 'interactive',
      content: JSON.stringify({ type: 'card', data: { card_id: cardId } })
    })

    const res = await request(
      'POST',
      '/open-apis/im/v1/messages?receive_id_type=chat_id',
      headers,
      body
    )

    const data = JSON.parse(res.body)
    if (data.code !== 0) {
      throw new Error(`Feishu sendCardMessage failed: ${data.msg}`)
    }
    return { messageId: data.data?.message_id ?? '' }
  }

  /** Reply to a specific message with a card using an existing card_id */
  async replyCardMessage(replyMessageId: string, cardId: string): Promise<{ messageId: string }> {
    const headers = await this.authHeaders()
    const body = JSON.stringify({
      msg_type: 'interactive',
      content: JSON.stringify({ type: 'card', data: { card_id: cardId } })
    })

    const res = await request(
      'POST',
      `/open-apis/im/v1/messages/${replyMessageId}/reply`,
      headers,
      body
    )

    const data = JSON.parse(res.body)
    if (data.code !== 0) {
      throw new Error(`Feishu replyCardMessage failed: ${data.msg}`)
    }
    return { messageId: data.data?.message_id ?? '' }
  }

  /** Get messages from a chat */
  async getMessages(
    chatId: string,
    count = 20
  ): Promise<
    Array<{
      message_id: string
      sender_id: string
      sender_name: string
      content: string
      create_time: string
      raw: unknown
    }>
  > {
    const headers = await this.authHeaders()
    const res = await request(
      'GET',
      `/open-apis/im/v1/messages?container_id_type=chat&container_id=${chatId}&page_size=${count}`,
      headers
    )

    const data = JSON.parse(res.body)
    if (data.code !== 0) {
      throw new Error(`Feishu getMessages failed: ${data.msg}`)
    }

    return (data.data?.items ?? []).map(
      (item: {
        message_id: string
        sender: { sender_id: string; sender_type: string; tenant_key: string }
        body: { content: string }
        create_time: string
      }) => {
        let content = ''
        try {
          const parsed = JSON.parse(item.body?.content ?? '{}')
          content = parsed.text ?? item.body?.content ?? ''
        } catch {
          content = item.body?.content ?? ''
        }
        return {
          message_id: item.message_id,
          sender_id: item.sender?.sender_id ?? '',
          sender_name: '',
          content,
          create_time: item.create_time,
          raw: item
        }
      }
    )
  }
}

// Re-export for backward compatibility
export { FeishuBitableApi } from './feishu-bitable-api'
export { FeishuMediaApi } from './feishu-media-api'
export { request, BASE_URL } from './feishu-http'
