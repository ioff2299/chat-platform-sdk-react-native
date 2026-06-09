# @chat-platform/sdk-react-native

React Native SDK для встройки чата в мобильное приложение.

**Версия:** 0.1.0-beta.1
**JS-требования:** React Native ≥ 0.72, React ≥ 18.2
**Нативные минимумы:** iOS 13.4, Android API 24 (Android 7.0)

Пикер файлов и скачивание вложений работают «из коробки» — никаких дополнительных
нативных модулей (`expo-*`, `@react-native-documents/*` и т.п.) ставить **не нужно**.

---

## Установка

```bash
# npm
npm install @chat-platform/sdk-react-native

# yarn
yarn add @chat-platform/sdk-react-native
```

После установки:

**iOS**
```bash
cd ios && pod install
```

**Android** — пересборка через Android Studio или `./gradlew assembleDebug`.
Никаких правок в `MainApplication.kt` / `AppDelegate.mm` не требуется — модуль
подключается через autolinking (см. `react-native.config.js` в пакете).

---

## Быстрый старт

### 1. Инициализация (один раз при старте приложения)

```tsx
// App.tsx
import { ChatSDK } from '@chat-platform/sdk-react-native'

ChatSDK.init({
  token:  'ВАШ_ТОКЕН_ИЗ_ЧП',  // универсальный токен (содержит widget token + baseUrl)
  locale: 'ru',                // 'ru' | 'en' (опционально)
})
```

Токен из настроек виджета в ЧП — это base64-JSON вида `{"token":"...","baseUrl":"..."}`.
SDK сам распакует его и подставит нужный `baseUrl`. Передавать `baseUrl` отдельно
не нужно.

### 2. Логин после авторизации пользователя

```tsx
await ChatSDK.login(
  {
    userId:  user.id,         // обязательно — id из вашей системы
    name:    user.firstName,
    surname: user.lastName,
    email:   user.email,
    phone:   user.phone,
  },
  {
    platform:   'ios',        // 'ios' | 'android' | 'other'
    appVersion: '1.0.0',
    bundleId:   'com.yourapp',
  },
)
```

### 3. Открыть чат

```tsx
import { ChatScreen } from '@chat-platform/sdk-react-native'

// В стеке навигации
<Stack.Screen name="Chat" component={ChatScreen} />

// или как компонент с onClose
<ChatScreen onClose={() => navigation.goBack()} />
```

### 4. Логаут

```tsx
await ChatSDK.logout()
```

---

## Что включено по умолчанию

| Возможность                              | Android                                  | iOS                                  |
|------------------------------------------|------------------------------------------|--------------------------------------|
| Выбор файлов из системного пикера        | SAF `OpenDocument` (множественный выбор) | `UIDocumentPickerViewController`     |
| Скачивание вложений в системные «Файлы»  | `MediaStore.Downloads` (API 29+)         | `UIActivityViewController` (share-sheet) |
| Прогресс скачивания                      | Через `NativeEventEmitter`               | Через `NativeEventEmitter`           |
| Notification «Загрузка завершена»        | Да, тап открывает файл                   | Native share-sheet после загрузки    |
| Realtime (Laravel Reverb / Pusher)       | Да                                       | Да                                   |
| Поддержка кнопок ботов в сообщениях      | Да                                       | Да                                   |
| CSI-опрос после закрытия диалога         | Да                                       | Да                                   |
| Галерея вложений (изображения + документы) | Да                                     | Да                                   |

Никаких runtime-permissions для скачивания на Android 10+ запрашивать не нужно.

---

## Компонент `<ChatScreen />`

| Prop                    | Тип                                          | Назначение                                              |
|-------------------------|----------------------------------------------|---------------------------------------------------------|
| `onClose`               | `() => void`                                 | Колбэк для кнопки «назад» в хедере                      |
| `theme`                 | `Partial<ChatTheme>`                         | Переопределение цветов поверх темы из ЧП                |
| `strings`               | `ChatStrings`                                | Кастомные тексты (см. ниже)                             |
| `onPickFiles`           | `() => Promise<AttachmentInput[] \| null>`   | Escape-hatch: своя реализация пикера                    |
| `onDownloadAttachment`  | `(a: GalleryAttachment) => Promise<void>`    | Escape-hatch: своя реализация скачивания                |

`onPickFiles` и `onDownloadAttachment` нужны **только** если вы хотите перебить
встроенное поведение (например, открывать кастомный пикер). Во всех остальных
случаях оставляйте их `undefined` — SDK использует свои нативные модули.

### Кастомные тексты

```tsx
<ChatScreen
  strings={{
    headerTitle:      'Поддержка',
    emptyStateText:   'Опишите проблему — мы ответим в течение минуты',
    inputPlaceholder: 'Ваше сообщение…',
    errorRetry:       'Повторить',
    galleryDownload:  'Сохранить',
    surveyTitle:      'Оцените работу оператора',
    surveySubmit:     'Отправить',
    surveySkip:       'Пропустить',
    surveyClose:      'Закрыть',
    sendingText:      'Отправка…',
  }}
/>
```

Все поля опциональны — непереданные значения берутся из встроенных дефолтов на
русском.

### Тема

```tsx
<ChatScreen
  theme={{
    primaryColor:  '#7c3aed',
    headerBg:      '#7c3aed',
    outboundBg:    '#7c3aed',
    background:    '#fafafa',
  }}
/>
```

Полный список полей — в `ChatTheme` (см. `src/theme.ts`).

---

## События

После `ChatSDK.login()` SDK поднимает фоновую сессию (WebSocket + polling fallback)
и держит её живой до `logout()`. Поэтому события ниже **работают независимо от того,
открыт ли `<ChatScreen />`** — пока приложение в foreground, подписчик будет получать
их даже при закрытом чате.

```tsx
const unsubState = ChatSDK.on('stateChange', (state) => {
  // 'idle' | 'initializing' | 'ready' | 'authenticated' | 'error'
})

const unsubOperator = ChatSDK.on('operatorChanged', (p) => {
  // p: { token, contactId, previousOperator, operator, occurredAt }
})

const unsubMessage = ChatSDK.on('newMessage', (p) => {
  // p: { token, contactId, message, operator, occurredAt }
  // Срабатывает только для сообщений от операторов (type === 'user').
})

const unsubMessagesUpdated = ChatSDK.on('messagesUpdated', (p) => {
  // p: { messages, operator } — полный текущий список после любого refresh
})

const unsubConnected = ChatSDK.on('connectedChange', (online) => {
  // true когда WS подключён, false при отвале (тогда работает polling)
})

const unsubError = ChatSDK.on('error', (err) => {
  // ошибка инициализации/сессии
})

// Снятие подписки
unsubState(); unsubOperator(); unsubMessage()
unsubMessagesUpdated(); unsubConnected(); unsubError()
```

Подписка на `newMessage` подходит для собственных in-app уведомлений (тосты,
бейджи в табах) — событие приходит даже если пользователь не открывал чат, пока
приложение в foreground. Для push-уведомлений в background используйте webhook
(см. ниже).

### Поведение в фоне

- При уходе в background polling приостанавливается (батарея).
- WebSocket OS-зависим: некоторые системы дают ему ещё минуту-две, потом гасят.
- При возврате в foreground SDK делает one-shot `refreshMessages` и при
  необходимости поднимает сокет.

---

## Push-уведомления

ЧП **не** шлёт FCM/APNs напрямую. Вместо этого ЧП отправляет webhook на ваш
backend при новом сообщении от оператора. Ваш backend сам решает, кому и как
доставить push.

### Webhook payload

```json
{
  "event":          "message.created",
  "version":        1,
  "token":          "widget_token",
  "contactId":      "user_123",
  "conversationId": 456,
  "messageId":      789,
  "senderType":     "user",
  "preview":        "Здравствуйте!",
  "hasAttachments": false,
  "createdAt":      "2026-06-01T10:00:00Z"
}
```

Подпись: заголовок `X-Chat-Platform-Signature: sha256=HMAC_SHA256(body, webhook_secret)`.

### Открытие чата из тапа по push

```tsx
import { ChatSDK } from '@chat-platform/sdk-react-native'

// В обработчике нотификации
ChatSDK.handleNotification({
  token:     data.cp_token,
  contactId: data.cp_contact_id,
})
navigation.navigate('Chat')
```

Рекомендуемые data-ключи в payload FCM/APNs: `cp_token`, `cp_contact_id`.

---

## API

### `ChatSDK.init(config)`

| Поле     | Тип                | Обязательно |
|----------|--------------------|-------------|
| `token`  | `string`           | Да — универсальный токен из ЧП (base64-JSON с `token` + `baseUrl`) |
| `baseUrl`| `string`           | Нет — указывается только при ручной разработке против локального инстанса ЧП |
| `locale` | `'ru' \| 'en'`     | Нет         |

### `ChatSDK.login(user, device?)`

| Поле       | Тип       | Обязательно |
|------------|-----------|-------------|
| `userId`   | `string`  | Да          |
| `name`     | `string`  | Нет         |
| `surname`  | `string`  | Нет         |
| `email`    | `string`  | Нет         |
| `phone`    | `string`  | Нет         |

`device` (опционально): `{ platform, appVersion, bundleId }`.

### `ChatSDK.logout()`

Завершает сессию, отключает realtime.

### `ChatSDK.handleNotification(payload)`

Помечает push как относящийся к нашему виджету (по `token`). Навигацию на
`ChatScreen` запускает host-приложение.

### `ChatSDK.getState() / isAuthenticated() / getUser()`

Геттеры текущего состояния SDK.

### `ChatSDK.on(event, handler)`

Подписка на события — см. раздел «События» выше. Возвращает функцию отписки.

---

## Чеклист интеграции

- [ ] Получить `widget_token` и `baseUrl` от ЧП
- [ ] `npm install @chat-platform/sdk-react-native` + `pod install` для iOS
- [ ] Пересобрать нативную часть (Xcode / Android Studio)
- [ ] `ChatSDK.init(...)` в точке входа приложения
- [ ] `ChatSDK.login(...)` после авторизации пользователя
- [ ] `<ChatScreen />` в навигаторе
- [ ] Webhook URL в настройках виджета в ЧП
- [ ] FCM/APNs: данные `cp_token`, `cp_contact_id` в data payload
- [ ] `ChatSDK.handleNotification(...)` в обработчике push на стороне приложения

---

## Лицензия

UNLICENSED. Внутренний пакет — для использования только в рамках проектов ЧП.
