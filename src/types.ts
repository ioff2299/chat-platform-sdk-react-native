// Конфигурация при инициализации SDK.
// token может быть либо plain-строкой (тогда baseUrl обязателен),
// либо base64-закодированным JSON вида {"token":"...","baseUrl":"..."}.
export interface ChatSDKConfig {
  token: string
  baseUrl?: string
  locale?: 'ru' | 'en'
}

// Данные пользователя при логине
export interface ChatSDKUser {
  userId: string
  name?: string
  surname?: string
  email?: string
  phone?: string
}

// Данные устройства (опционально)
export interface ChatSDKDevice {
  platform?: 'ios' | 'android' | 'other'
  appVersion?: string
  bundleId?: string
}

// Тема виджета из ЧП
export interface ChatSDKTheme {
  widgetTitle: string
  colorType: 'single' | 'gradient'
  themeColor: string
  colorStart: string | null
  colorEnd: string | null
  imageLogo: string | null
}

// Параметры Reverb из ответа /session
export interface ReverbConfig {
  key: string
  host: string
  port: number
  scheme: 'http' | 'https'
}

// Полный конфиг из /session или /config
export interface MobileConfig extends ChatSDKTheme {
  apiBaseUrl: string
  reverb: ReverbConfig
  broadcastAuthEndpoint: string
}

// Ответ POST /session
export interface SessionResponse {
  sessionToken: string
  expiresAt: string
  contactId: string
  config: MobileConfig
}

// Одно сообщение в чате
export interface ChatMessage {
  id: string
  type: 'contact' | 'user' | 'system' | 'event'
  text: string | null
  time: string
  createdAt: number
  sender?: { name: string } | null
  attachments?: ChatAttachment[]
  buttons?: ChatButton[] | null
  serverMessageId?: number | null
}

// Вложение
export interface ChatAttachment {
  id: number
  url: string
  filename: string
  mime: string
  size: number
  type: 'image' | 'video' | 'audio' | 'document'
}

// Файл для отправки из SDK (используется хост-приложением)
export interface AttachmentInput {
  uri: string
  name: string
  type: string
  size?: number
}

// Вложение с контекстом сообщения (для галереи)
export interface GalleryAttachment extends ChatAttachment {
  messageTime: string
}

// Кнопка бота
export interface ChatButton {
  text: string
  callback_data: string
}

// Ответ GET /messages
export interface MessagesResponse {
  operator: { id: number; name: string } | null
  messages: ChatMessage[]
}

export interface ChatOperator {
  id: number
  name: string
}

// Payload для handleNotification (из push)
export interface NotificationPayload {
  token: string
  contactId: string
  conversationId?: string
  messageId?: string
}

export interface OperatorChangedEventPayload {
  token: string
  contactId: string
  previousOperator: ChatOperator | null
  operator: ChatOperator | null
  occurredAt: string
}

export interface NewMessageEventPayload {
  token: string
  contactId: string
  message: ChatMessage
  operator: ChatOperator | null
  occurredAt: string
}

export interface MessagesUpdatedEventPayload {
  messages: ChatMessage[]
  operator: ChatOperator | null
}

export type ChatSDKEventName =
  | 'stateChange'
  | 'error'
  | 'operatorChanged'
  | 'newMessage'
  | 'messagesUpdated'
  | 'connectedChange'

// Конфиг CSI-опроса с сервера
export interface SurveyConfig {
  visible: true
  title: string
  description: string
  range: [number, number]
  badRange: [number, number]
  badMessage: string
  goodMessage: string
  afterCommentMessage: string
  commentEnabled: boolean
  badRangeEnabled: boolean
  commentRequired: boolean
}

export type SurveyConfigResponse = SurveyConfig | { visible: false }

// Внутреннее состояние SDK
export type SDKState =
  | 'idle'
  | 'initializing'
  | 'ready'
  | 'authenticated'
  | 'error'

/**
 * Кастомные тексты для <ChatScreen />.
 * Все поля опциональны — непереданные значения берутся из встроенного дефолта.
 */
export interface ChatStrings {
  /** Заголовок хедера. По умолчанию: widgetTitle из конфига → 'Чат' */
  headerTitle?: string
  /** Текст пустого экрана чата */
  emptyStateText?: string
  /** Placeholder в поле ввода */
  inputPlaceholder?: string
  /** Текст кнопки/индикатора отправки */
  sendingText?: string
  /** Текст кнопки повтора при ошибке */
  errorRetry?: string
  /** Заголовок оверлея CSI-опроса (если не задан сервером) */
  surveyTitle?: string
  /** Текст кнопки отправки оценки в опросе */
  surveySubmit?: string
  /** Текст кнопки пропуска опроса */
  surveySkip?: string
  /** Текст кнопки закрытия результата опроса */
  surveyClose?: string
  /** Текст кнопки скачивания в галерее */
  galleryDownload?: string
}
