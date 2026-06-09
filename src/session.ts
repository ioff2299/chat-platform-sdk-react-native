import { AppState, type NativeEventSubscription } from 'react-native'
import type { MobileApiClient } from './api'
import { RealtimeClient } from './realtime'
import type {
  ChatMessage,
  ChatOperator,
  MobileConfig,
  NewMessageEventPayload,
  OperatorChangedEventPayload,
} from './types'

const POLL_INTERVAL_MS = 5000

export interface SessionEmitters {
  emitMessagesUpdated: (messages: ChatMessage[], operator: ChatOperator | null) => void
  emitConnectedChange: (connected: boolean) => void
  emitOperatorChanged: (payload: OperatorChangedEventPayload) => void
  emitNewMessage: (payload: NewMessageEventPayload) => void
}

/**
 * Время жизни — от ChatSDK.login() до ChatSDK.logout().
 * Один источник правды для realtime + polling + кэша сообщений/оператора.
 * События проксируются в ChatSDK через emitters.
 */
export class ChatSDKSession {
  private realtime: RealtimeClient | null = null
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private appStateSub: NativeEventSubscription | null = null
  private destroyed = false
  private refreshing = false

  private messages: ChatMessage[] = []
  private operator: ChatOperator | null = null
  private knownMessageIds: Set<string> = new Set()
  private initialLoaded = false
  private connected = false

  constructor(
    private readonly api: MobileApiClient,
    private readonly sdkConfig: MobileConfig,
    private readonly widgetToken: string,
    private readonly baseUrl: string,
    private readonly emitters: SessionEmitters,
  ) {}

  start(): void {
    this.openRealtime()
    this.appStateSub = AppState.addEventListener('change', this.handleAppStateChange)
    void this.refreshMessages()
  }

  destroy(): void {
    this.destroyed = true
    this.realtime?.disconnect()
    this.realtime = null
    this.stopPolling()
    this.appStateSub?.remove()
    this.appStateSub = null
    this.messages = []
    this.operator = null
    this.knownMessageIds.clear()
    this.initialLoaded = false
    if (this.connected) {
      this.connected = false
      this.emitters.emitConnectedChange(false)
    }
  }

  getMessages(): ChatMessage[] {
    return this.messages
  }

  getOperator(): ChatOperator | null {
    return this.operator
  }

  isConnected(): boolean {
    return this.connected
  }

  async refreshMessages(): Promise<void> {
    if (this.destroyed || this.refreshing) return
    this.refreshing = true
    try {
      const data = await this.api.getMessages()
      if (this.destroyed) return
      const incoming = data.messages ?? []
      const nextOperator = data.operator ?? null

      if (this.initialLoaded) {
        this.detectOperatorChange(nextOperator)
        this.detectNewMessages(incoming, nextOperator)
      }

      this.messages = incoming
      this.operator = nextOperator
      this.knownMessageIds = new Set(incoming.map((m) => m.id))
      this.initialLoaded = true

      this.emitters.emitMessagesUpdated(incoming, nextOperator)
    } catch (e) {
      // Тихо — UI-слой (useChat) сам показывает ошибки своих явных действий.
      // Фоновый refresh не должен ронять чат, если на короткое время пропала сеть.
      if (this.initialLoaded) return
      throw e
    } finally {
      this.refreshing = false
    }
  }

  private detectOperatorChange(nextOperator: ChatOperator | null): void {
    const prevId = this.operator?.id ?? null
    const nextId = nextOperator?.id ?? null
    if (prevId === nextId) return
    const contactId = this.api.getContactId()
    if (!contactId) return
    this.emitters.emitOperatorChanged({
      token:            this.widgetToken,
      contactId,
      previousOperator: this.operator,
      operator:         nextOperator,
      occurredAt:       new Date().toISOString(),
    })
  }

  private detectNewMessages(incoming: ChatMessage[], nextOperator: ChatOperator | null): void {
    const contactId = this.api.getContactId()
    if (!contactId) return
    for (const message of incoming) {
      if (this.knownMessageIds.has(message.id)) continue
      if (message.type !== 'user') continue
      this.emitters.emitNewMessage({
        token:      this.widgetToken,
        contactId,
        message,
        operator:   nextOperator,
        occurredAt: new Date().toISOString(),
      })
    }
  }

  private openRealtime(): void {
    const contactId = this.api.getContactId()
    if (!contactId) return

    const rt = new RealtimeClient()
    this.realtime = rt

    rt.on('connected', () => this.setConnected(true))
    rt.on('disconnected', () => this.setConnected(false))
    rt.on('messages_updated', () => void this.refreshMessages())

    rt.connect(
      this.sdkConfig.reverb,
      this.widgetToken,
      contactId,
      this.api.getBroadcastAuthEndpoint(),
      this.api.getAuthHeaders(),
      this.baseUrl || this.sdkConfig.apiBaseUrl,
    )
  }

  private setConnected(value: boolean): void {
    if (this.connected === value) return
    this.connected = value
    this.emitters.emitConnectedChange(value)
    if (value) {
      this.stopPolling()
    } else {
      this.startPolling()
    }
  }

  private startPolling(): void {
    if (this.pollTimer || this.destroyed) return
    if (AppState.currentState !== 'active') return
    this.pollTimer = setInterval(() => void this.refreshMessages(), POLL_INTERVAL_MS)
  }

  private stopPolling(): void {
    if (!this.pollTimer) return
    clearInterval(this.pollTimer)
    this.pollTimer = null
  }

  private handleAppStateChange = (next: string): void => {
    if (this.destroyed) return
    if (next === 'active') {
      void this.refreshMessages()
      if (!this.connected) this.startPolling()
    } else {
      this.stopPolling()
    }
  }
}
