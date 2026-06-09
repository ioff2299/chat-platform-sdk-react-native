/**
 * Минимальный Pusher-протокол поверх нативного WebSocket.
 *
 * Не требует pusher-js / @react-native-community/netinfo.
 * Работает в Expo Go, bare RN, любом JS-окружении с WebSocket.
 *
 * Поддерживает:
 *   - presence-channels (подписка с auth)
 *   - WidgetMessagesUpdated
 *   - heartbeat (pong на pusher:ping)
 *   - exponential reconnect
 */
import type { ReverbConfig } from './types'

export type RealtimeEvent =
  | 'messages_updated'
  | 'connected'
  | 'disconnected'

export type RealtimeHandler = (data?: unknown) => void

const PUSHER_PROTOCOL = 7
const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000]

const MESSAGE_UPDATE_EVENTS = new Set([
  'ChatSdkMessagesUpdated',
  '.ChatSdkMessagesUpdated',
  'App\\Events\\ChatSdk\\ChatSdkMessagesUpdated',
])

/** На эмуляторе API часто на 10.0.2.2, а Reverb host с сервера — localhost. */
export function resolveReverbConfig(
  reverb: ReverbConfig,
  apiBaseUrl: string,
): ReverbConfig {
  const host = reverb.host?.trim() ?? ''
  if (host === 'localhost' || host === '127.0.0.1') {
    try {
      const apiHost = new URL(apiBaseUrl).hostname
      if (apiHost && apiHost !== 'localhost' && apiHost !== '127.0.0.1') {
        return { ...reverb, host: apiHost }
      }
    } catch {
      // keep original host
    }
  }
  return reverb
}

export class RealtimeClient {
  private ws: WebSocket | null = null
  private socketId: string | null = null
  private channelName: string | null = null
  private handlers: Map<RealtimeEvent, Set<RealtimeHandler>> = new Map()
  private reconnectAttempt = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private destroyed = false

  private authEndpoint = ''
  private authHeaders: Record<string, string> = {}
  private wsUrl = ''

  // ─── Публичное API ─────────────────────────────────────────────────────────

  connect(
    config: ReverbConfig,
    widgetToken: string,
    contactId: string,
    authEndpoint: string,
    authHeaders: Record<string, string>,
    apiBaseUrl?: string,
  ): void {
    this.destroy()
    this.destroyed = false

    const resolved = apiBaseUrl ? resolveReverbConfig(config, apiBaseUrl) : config
    const secure = resolved.scheme === 'https'
    const wsScheme = secure ? 'wss' : 'ws'
    this.wsUrl = `${wsScheme}://${resolved.host}:${resolved.port}/app/${resolved.key}?protocol=${PUSHER_PROTOCOL}&client=js&version=8.4.0`
    this.channelName = `presence-chat_sdk.${widgetToken}.contact.${contactId}`
    this.authEndpoint = authEndpoint
    this.authHeaders = authHeaders

    this.openSocket()
  }

  disconnect(): void {
    this.destroy()
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && !!this.socketId
  }

  on(event: RealtimeEvent, handler: RealtimeHandler): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set())
    }
    this.handlers.get(event)!.add(handler)
    return () => this.handlers.get(event)?.delete(handler)
  }

  // ─── Внутренняя логика ─────────────────────────────────────────────────────

  private openSocket(): void {
    try {
      this.ws = new WebSocket(this.wsUrl)
    } catch (e) {
      this.scheduleReconnect()
      return
    }

    this.ws.onopen = () => {
      // Pusher пришлёт pusher:connection_established — ждём
    }

    this.ws.onmessage = (event) => {
      this.handleMessage(String(event.data))
    }

    this.ws.onerror = () => {
      // onclose вызовется следом
    }

    this.ws.onclose = () => {
      this.socketId = null
      this.emit('disconnected')
      if (!this.destroyed) {
        this.scheduleReconnect()
      }
    }
  }

  private handleMessage(raw: string): void {
    let msg: { event: string; data?: unknown; channel?: string }
    try {
      msg = JSON.parse(raw)
    } catch {
      return
    }

    const eventName = msg.event ?? ''

    switch (eventName) {
      case 'pusher:connection_established': {
        const data =
          typeof msg.data === 'string' ? JSON.parse(msg.data) : msg.data
        this.socketId = (data as { socket_id: string }).socket_id
        this.reconnectAttempt = 0
        void this.subscribe()
        break
      }

      case 'pusher:ping':
        this.send({ event: 'pusher:pong', data: {} })
        break

      case 'pusher:error': {
        const errData = this.parseData(msg.data)
        console.warn('ChatSDK realtime: pusher error', errData)
        break
      }

      case 'pusher_internal:subscription_succeeded':
        this.emit('connected')
        break

      case 'pusher:subscription_error': {
        const errData = this.parseData(msg.data)
        console.warn('ChatSDK realtime: subscription error', errData)
        this.emit('disconnected')
        break
      }

      default:
        if (MESSAGE_UPDATE_EVENTS.has(eventName)) {
          this.emit('messages_updated', this.parseData(msg.data))
        }
        break
    }
  }

  private async subscribe(): Promise<void> {
    if (!this.channelName || !this.socketId) return

    let auth = ''
    let channelData = ''
    try {
      const res = await fetch(this.authEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...this.authHeaders,
        },
        body: JSON.stringify({
          socket_id: this.socketId,
          channel_name: this.channelName,
        }),
      })
      if (res.ok) {
        const body = (await res.json()) as { auth?: string; channel_data?: string }
        auth = body.auth ?? ''
        channelData = body.channel_data ?? ''
      } else {
        const body = await res.text().catch(() => '')
        console.warn('ChatSDK realtime: auth HTTP', res.status, body)
      }
    } catch (e) {
      console.warn('ChatSDK realtime: auth request failed', e)
    }

    if (!auth) return
    if (this.ws?.readyState !== WebSocket.OPEN) return

    const payload: Record<string, string> = {
      channel: this.channelName,
      auth,
    }
    // Presence-канал требует channel_data — без него подписка не проходит
    if (channelData) {
      payload.channel_data = channelData
    }

    this.send({
      event: 'pusher:subscribe',
      data: payload,
    })
  }

  private send(payload: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload))
    }
  }

  private scheduleReconnect(): void {
    if (this.destroyed) return
    const delay =
      RECONNECT_DELAYS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS.length - 1)]
    this.reconnectAttempt++
    this.reconnectTimer = setTimeout(() => {
      if (!this.destroyed) this.openSocket()
    }, delay)
  }

  private destroy(): void {
    this.destroyed = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.onopen = null
      this.ws.onmessage = null
      this.ws.onerror = null
      this.ws.onclose = null
      this.ws.close()
      this.ws = null
    }
    this.socketId = null
  }

  private parseData(data: unknown): unknown {
    if (typeof data === 'string') {
      try {
        return JSON.parse(data)
      } catch {
        return data
      }
    }
    return data
  }

  private emit(event: RealtimeEvent, data?: unknown): void {
    this.handlers.get(event)?.forEach((h) => h(data))
  }
}
