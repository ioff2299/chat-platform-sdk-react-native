# Changelog

Все заметные изменения в пакете документируются в этом файле.
Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.0.0/),
проект следует [семантическому версионированию](https://semver.org/lang/ru/).

## [Unreleased]

## [0.1.0-beta.1]

### Added
- Первая бета-версия React Native SDK для Chat Platform.
- `ChatSDK.init()` с авторизацией по токену.
- Компонент `ChatScreen` и хук `useChat`.
- Поддержка вложений, кнопок в сообщениях, CSI-опросов.
- Нативные модули file-picker и downloader (Android/iOS).
- Сборка пакета через `react-native-builder-bob` (commonjs + module + typescript).