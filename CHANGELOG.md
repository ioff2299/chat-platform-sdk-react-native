# Changelog

Все заметные изменения в пакете документируются в этом файле.
Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.0.0/),
проект следует [семантическому версионированию](https://semver.org/lang/ru/).

## [Unreleased]

## [0.1.0-beta.12]

### Fixed
- Отправка файлов больше не падает с `Unsupported FormDataPart implementation`
  в приложениях, где глобальный `fetch` — это `expo/fetch`. Раньше вложение
  клалось в `FormData` только в RN-формате `{uri, name, type}`, который
  понимает нативный `fetch` RN, но не `expo/fetch` (ему нужен веб-стандартный
  `Blob`). Теперь `sendMessage` сначала пробует RN-формат (дёшево, без
  регрессии для нативного `fetch`), а при ошибке `FormDataPart` пересобирает
  тело, читая файл как настоящий `Blob` через `XMLHttpRequest`, и повторяет
  запрос. Также `uri` без схемы нормализуется в `file://`, вложения без `uri`
  пропускаются.

## [0.1.0-beta.11]

### Fixed
- iOS-сборка SDK больше не падает на компиляции Swift-модулей. В
  `ios/ChatSdkFilePicker.swift` и `ios/ChatSdkPushToken.swift` отсутствовал
  `import React`, из-за чего типы `RCTPromiseResolveBlock` /
  `RCTPromiseRejectBlock` не находились в scope (ошибки
  `cannot find type ... in scope`, `'@escaping' only applies to function types`,
  `'nil' requires a contextual type`). Импорт добавлен; потребителям больше не
  нужен `patch-package` как временный обход.

## [0.1.0-beta.10]

### Fixed
- Голосовые `.webm` (например, `voice_*.webm`) теперь отображаются плеером, а не
  обычным файлом. Расширение `.webm` перенесено из видео в аудио при определении
  типа вложения (`resolveAttachmentType`); явный `video/webm` MIME по-прежнему
  распознаётся как видео, так как проверяется раньше расширения.

### Changed
- Аудио/голосовые вложения больше не попадают в галерею-просмотрщик вложений —
  туда добавляются только картинки, документы и файлы. Аудио воспроизводится
  встроенным плеером в самом сообщении.

## [0.1.0-beta.9]

### Fixed
- Входящие аудио/голосовые сообщения снова отображаются плеером, а не обычным
  файлом. Тип вложения для входящих сообщений брался как есть из ответа сервера,
  где аудио классифицируется как `document`. Теперь тип вычисляется на клиенте:
  сначала по MIME, при неинформативном MIME — по расширению файла
  (`.mp3/.m4a/.ogg/.opus/.wav/...`), и только в крайнем случае берётся
  серверный `type`.

## [0.1.0-beta.8]

### Added
- `ChatSDK.registerPushToken()` теперь можно вызывать **без аргументов** — SDK
  сам достаёт нативный push-токен устройства, приложению больше не нужны
  `expo-notifications` / `@react-native-firebase/messaging`:
  - Android — FCM-токен через встроенный `firebase-messaging` (нужен только
    `google-services.json` в приложении);
  - iOS — «сырой» APNs device-token без Firebase и подов; токен перехватывается
    через swizzling `AppDelegate`, править `AppDelegate` приложению не нужно.
- Нативный модуль `ChatSdkPushToken` (Android Kotlin / iOS Swift) + JS-мост.

### Changed
- Сигнатура `registerPushToken(deviceToken?, platform?)` — оба аргумента стали
  опциональными; при ручной передаче `platform` по умолчанию выводится из ОС
  (`apns` на iOS, `fcm` на Android). Обратная совместимость сохранена.

## [0.1.0-beta.7]

### Added
- Регистрация push-токена устройства для фоновых уведомлений:
  `ChatSDK.registerPushToken(deviceToken, platform?)` и
  `ChatSDK.unregisterPushToken(deviceToken?)`. Токен снимается автоматически
  в `logout()`. WebSocket в фоне ОС гасит — события о новых сообщениях
  оператора при свёрнутом/закрытом приложении доставляются через FCM/APNs:
  ЧП шлёт push на зарегистрированные токены контакта (свой backend не нужен).
  SDK провайдер-агностик: хост-приложение приносит нативный токен под свой стек.

## [0.1.0-beta.6]

### Added
- Аудио-вложения (голосовые сообщения) теперь проигрываются прямо в чате:
  встроенный плеер с кнопкой play/pause, прогресс-баром и перемоткой по тапу.
  Раньше аудио показывалось как обычный файл (`.webm`) только для скачивания.
- Собственный нативный модуль воспроизведения `ChatSdkAudioPlayer`
  (Android `MediaPlayer`, iOS `AVPlayer`) — без сторонних JS-зависимостей.
  Если модуль не собран, аудио откатывается на обычный файловый блок.

### Notes
- iOS (`AVPlayer`) не декодирует контейнер WebM/Opus: голосовые, записанные
  в браузере как `audio/webm`, на iOS воспроизвести нельзя — их нужно
  транскодировать на бэкенде (например, в `m4a`/`aac`). Android их играет.

## [0.1.0-beta.5]

### Changed
- Кнопка прикрепления файла: простая иконка `+` (без внешних зависимостей).

### Removed
- Убрана peer-зависимость `react-native-svg` (добавлялась в beta.4) — потребителям
  SDK она больше не нужна.

## [0.1.0-beta.4]

### Changed
- Галерея вложений: на Android крестик закрытия больше не уходит под статус-бар
  (добавлен отступ на высоту статус-бара) — теперь кликается и расположен ниже.
- Кнопка прикрепления файла: иконка `⊕` заменена на векторную иконку-скрепку.

### Added
- Новая peer-зависимость **`react-native-svg`** (`>=13.0.0`) — нужна для иконки в инпуте.
  Потребителям SDK необходимо установить её в приложение.

## [0.1.0-beta.3]

### Fixed
- Android: совместимость `ChatSdkFilePickerModule` с React Native 0.83 (Kotlin-база):
  `currentActivity` → `getCurrentActivity()`, параметр `onActivityResult(activity:)`
  сделан non-null. Раньше не компилировалось против RN 0.83.

## [0.1.0-beta.2]

### Changed
- Убраны поля `repository`/`homepage`/`bugs` из `package.json` (тестовая публикация без GitHub-репо).

## [0.1.0-beta.1]

### Added
- Первая бета-версия React Native SDK для Chat Platform.
- `ChatSDK.init()` с авторизацией по токену.
- Компонент `ChatScreen` и хук `useChat`.
- Поддержка вложений, кнопок в сообщениях, CSI-опросов.
- Нативные модули file-picker и downloader (Android/iOS).
- Сборка пакета через `react-native-builder-bob` (commonjs + module + typescript).