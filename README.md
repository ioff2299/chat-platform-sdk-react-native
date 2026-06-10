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

В фоне/закрытом приложении WebSocket гасит ОС — события туда не приходят
(это ограничение iOS и Android, см. «Поведение в фоне»). Единственный
кроссплатформенный способ доставить уведомление о сообщении оператора —
**push (FCM / APNs)**. Есть два варианта интеграции.

### Вариант A — `registerPushToken` (рекомендуется)

Хост-приложение получает **нативный** push-токен своим способом (под свой стек)
и отдаёт его SDK. ЧП сам шлёт FCM/APNs на зарегистрированные токены контакта —
свой backend не нужен. SDK **не зависит** от конкретного push-провайдера.

```ts
await ChatSDK.login(/* ... */)
await ChatSDK.registerPushToken(deviceToken, platform) // platform: 'fcm' | 'apns'
```

`platform`:
- `'fcm'` — FCM registration token (Android всегда; iOS — если используете Firebase и на iOS);
- `'apns'` — «сырой» APNs device-token (iOS без Firebase).

Токен снимается автоматически в `logout()` (или вручную `unregisterPushToken()`).

**Где взять токен — примеры под разные стеки:**

```ts
// Expo — getDevicePushTokenAsync() отдаёт НАТИВНЫЙ FCM/APNs токен
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

await Notifications.requestPermissionsAsync()
const { data } = await Notifications.getDevicePushTokenAsync()
await ChatSDK.registerPushToken(String(data), Platform.OS === 'ios' ? 'apns' : 'fcm')
```

```ts
// Голый React Native — @react-native-firebase/messaging
import messaging from '@react-native-firebase/messaging'

await messaging().requestPermission()
const fcmToken = await messaging().getToken()
await ChatSDK.registerPushToken(fcmToken, 'fcm')
```

> Нативные SDK (iOS/Android без RN) регистрируют токен тем же эндпоинтом —
> `registerPushToken` лишь обёртка над `POST /api/mobile/{token}/contact/{contactId}/push-token`.

### Вариант B — webhook на свой backend

Если вы хотите управлять доставкой сами, ЧП может слать webhook
`message.created` на ваш backend, а push вы шлёте уже своей инфраструктурой.

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

### Приём push и открытие чата

Сам push принимает **хост-приложение** (SDK не перехватывает уведомления).
Распознать «наш» push и открыть чат на тап:

```tsx
import { ChatSDK } from '@chat-platform/sdk-react-native'

// В обработчике тапа по нотификации
ChatSDK.handleNotification({
  token:     data.cp_token,
  contactId: data.cp_contact_id,
})
navigation.navigate('Chat')
```

В data-payload push'а ЧП кладёт ключи `cp_token` и `cp_contact_id`.

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

Завершает сессию, отключает realtime, снимает зарегистрированный push-токен.

### `ChatSDK.registerPushToken(deviceToken, platform?)`

Регистрирует push-токен устройства для фоновых уведомлений. Требует `login()`.
`platform`: `'fcm'` (по умолчанию) или `'apns'`. Токен запоминается и снимается
в `logout()`.

### `ChatSDK.unregisterPushToken(deviceToken?)`

Снимает регистрацию push-токена (по умолчанию — последнего зарегистрированного).

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
- [ ] Push: получить нативный токен и вызвать `ChatSDK.registerPushToken(token, platform)` после `login()`
      (либо webhook на свой backend — вариант B)
- [ ] `ChatSDK.handleNotification(...)` в обработчике тапа по push (`cp_token`, `cp_contact_id` в data payload)

---

## Лицензия

UNLICENSED. Внутренний пакет — для использования только в рамках проектов ЧП.
