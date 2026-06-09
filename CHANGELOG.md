# Changelog

Все заметные изменения в пакете документируются в этом файле.
Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.0.0/),
проект следует [семантическому версионированию](https://semver.org/lang/ru/).

## [Unreleased]

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