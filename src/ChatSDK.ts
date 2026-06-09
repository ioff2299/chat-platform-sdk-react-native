import { MobileApiClient } from './api'
import { ChatSDKSession } from './session'
import type {
  ChatMessage,
  ChatOperator,
  ChatSDKConfig,
  ChatSDKDevice,
  ChatSDKUser,
  MessagesUpdatedEventPayload,
  MobileConfig,
  NewMessageEventPayload,
  NotificationPayload,
  OperatorChangedEventPayload,
  SDKState,
} from './types'

type SDKEventMap = {
  stateChange: SDKState
  error: unknown
  operatorChanged: OperatorChangedEventPayload
  newMessage: NewMessageEventPayload
  messagesUpdated: MessagesUpdatedEventPayload
  connectedChange: boolean
}

type EventName = keyof SDKEventMap
type EventHandler<K extends EventName = EventName> = (data: SDKEventMap[K]) => void

class ChatSDKSingleton {
  private config: ChatSDKConfig | null = null
  private api: MobileApiClient | null = null
  private sdkConfig: MobileConfig | null = null
  private session: ChatSDKSession | null = null
  private state: SDKState = 'idle'
  private lastError: string | null = null
  private currentUser: ChatSDKUser | null = null
  private listeners: Map<EventName, Set<EventHandler>> = new Map()

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  init(raw: ChatSDKConfig): void {
    // После hot reload в Expo состояние может остаться error — разрешаем переинициализацию
    if (this.state !== 'idle' && this.state !== 'error') {
      console.warn('ChatSDK: already initialized')
      return
    }

    const config = ChatSDKSingleton.resolveConfig(raw)
    this.config = config
    this.api = new MobileApiClient(config.baseUrl!, config.token)
    this.lastError = null
    this.setState('ready')

    // Конфиг для темы подгружаем в фоне; полный config всё равно приходит из POST /session при login
    void this.api
      .getConfig()
      .then((cfg) => {
        this.sdkConfig = cfg
        if (this.state === 'ready') {
          this.emit('stateChange', 'ready')
        }
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn('ChatSDK: getConfig failed (non-fatal):', msg)
      })
  }

  getLastError(): string | null {
    return this.lastError
  }

  async login(user: ChatSDKUser, device?: ChatSDKDevice): Promise<void> {
    this.assertInitialized()
    const api = this.api!

    try {
      const result = await api.createSession(
        user.userId,
        {
          name: user.name,
          surname: user.surname,
          email: user.email,
          phone: user.phone,
        },
        device ?? {},
      )

      api.setSession(result.sessionToken, result.contactId)
      api.setUserProfile({
        name:    user.name,
        surname: user.surname,
        email:   user.email,
        phone:   user.phone,
      })
      this.sdkConfig = result.config
      this.currentUser = user
      this.lastError = null

      this.startSession()
      this.setState('authenticated')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.lastError = msg
      this.setState('error')
      this.emit('error', err)
      throw err
    }
  }

  async logout(): Promise<void> {
    this.currentUser = null
    this.session?.destroy()
    this.session = null
    this.api?.clearSession()
    this.setState(this.sdkConfig ? 'ready' : 'idle')
  }

  // ─── Push ─────────────────────────────────────────────────────────────────

  handleNotification(_payload: NotificationPayload): void {
    // Навигация обрабатывается в host app через onNotification callback.
    // SDK только проверяет, что payload относится к нашему токену.
    if (_payload.token !== this.config?.token) return
    // В будущем: открыть ChatScreen если приложение foreground
  }

  // ─── Getters ──────────────────────────────────────────────────────────────

  getApi(): MobileApiClient {
    this.assertInitialized()
    return this.api!
  }

  getSDKConfig(): MobileConfig | null {
    return this.sdkConfig
  }

  getBaseUrl(): string {
    return this.config?.baseUrl ?? ''
  }

  getState(): SDKState {
    return this.state
  }

  isAuthenticated(): boolean {
    return this.state === 'authenticated'
  }

  getUser(): ChatSDKUser | null {
    return this.currentUser
  }

  /** Кэш последнего ответа /messages. Пустой массив до первой загрузки. */
  getMessages(): ChatMessage[] {
    return this.session?.getMessages() ?? []
  }

  getOperator(): ChatOperator | null {
    return this.session?.getOperator() ?? null
  }

  isRealtimeConnected(): boolean {
    return this.session?.isConnected() ?? false
  }

  /** Принудительный refresh с сервера. Не бросает при сетевых ошибках после первой загрузки. */
  refreshMessages(): Promise<void> {
    return this.session?.refreshMessages() ?? Promise.resolve()
  }

  // ─── Events ───────────────────────────────────────────────────────────────

  on<K extends EventName>(event: K, handler: EventHandler<K>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    const handlers = this.listeners.get(event)!
    handlers.add(handler as EventHandler)
    return () => handlers.delete(handler as EventHandler)
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private startSession(): void {
    if (!this.sdkConfig || !this.api || !this.config) return
    this.session?.destroy()
    this.session = new ChatSDKSession(
      this.api,
      this.sdkConfig,
      this.config.token,
      this.config.baseUrl ?? this.sdkConfig.apiBaseUrl,
      {
        emitMessagesUpdated: (messages, operator) =>
          this.emit('messagesUpdated', { messages, operator }),
        emitConnectedChange: (connected) => this.emit('connectedChange', connected),
        emitOperatorChanged: (payload) => this.emit('operatorChanged', payload),
        emitNewMessage:      (payload) => this.emit('newMessage', payload),
      },
    )
    this.session.start()
  }

  private setState(next: SDKState): void {
    this.state = next
    this.emit('stateChange', next)
  }

  private emit<K extends EventName>(event: K, data: SDKEventMap[K]): void {
    this.listeners.get(event)?.forEach((h) => (h as EventHandler<K>)(data))
  }

  private assertInitialized(): void {
    if (!this.api || !this.config) {
      throw new Error('ChatSDK: call init() before login()')
    }
  }

  /** Если token — base64-JSON с полями token+baseUrl, распаковывает его. */
  private static resolveConfig(raw: ChatSDKConfig): ChatSDKConfig & { baseUrl: string } {
    if (!raw.baseUrl) {
      try {
        const decoded = JSON.parse(atob(raw.token)) as { token?: string; baseUrl?: string }
        if (decoded.token && decoded.baseUrl) {
          return { ...raw, token: decoded.token, baseUrl: decoded.baseUrl }
        }
      } catch {
        // не base64 — падём ниже с понятной ошибкой
      }
      throw new Error('ChatSDK: baseUrl is required (or pass a base64-encoded config token)')
    }
    return raw as ChatSDKConfig & { baseUrl: string }
  }
}

export const ChatSDK = new ChatSDKSingleton()
