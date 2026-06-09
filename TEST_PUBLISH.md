# Тестовая публикация SDK в npm

Этот репозиторий — самостоятельная копия `packages/chat-sdk-rn` для **тестового**
прогона публикации под личным npm-аккаунтом (без организации). Прод-конфиг живёт в
монорепо и не затронут.

## 0. Заполнить плейсхолдеры

В `package.json` нужно заменить два плейсхолдера на свои значения:

| Плейсхолдер             | Где                              | На что заменить                          |
|-------------------------|----------------------------------|------------------------------------------|
| `YOUR_NPM_USERNAME`     | поле `name`                      | твой npm-логин (после регистрации)       |
| `YOUR_GITHUB_USERNAME`  | `repository`, `homepage`, `bugs` | твой GitHub-логин                        |

Имя пакета станет `@<твой-npm-логин>/sdk-react-native` — scoped под личный аккаунт.

## 1. Регистрация и токен (ручные шаги, нужен браузер)

1. Зарегистрироваться на https://www.npmjs.com/signup
2. Включить 2FA: Account → Two-Factor Authentication (требуется для publish).
3. (Опционально, для CI) создать **Automation** access token:
   Account → Access Tokens → Generate New Token → *Automation*.

> Scope `@<твой-логин>` создаётся автоматически — отдельную организацию заводить не нужно.

## 2. Тестовый GitHub-репозиторий (ручной шаг)

Создать **пустой** репозиторий (без README/.gitignore/LICENSE), например
`chat-platform-sdk-rn-test`, и подключить как remote:

```powershell
git remote add origin https://github.com/<твой-github-логин>/chat-platform-sdk-rn-test.git
git push -u origin main
```

## 3. Проверка перед публикацией

```powershell
npm install --legacy-peer-deps   # legacy-peer-deps: @types/react-native@0.72 устарел, конфликтует с peer RN
npm run typecheck                 # типы без ошибок
npm run build                     # собирает lib/ (commonjs + module + typescript)
npm pack --dry-run                # проверить содержимое архива (есть lib/, android/, ios/, .podspec)
```

## 4. Публикация

```powershell
npm login                         # ввести логин/пароль/2FA
npm publish --access public       # --access public обязателен для scoped-пакета
```

После публикации проверить страницу на npmjs и установку в чистый RN-проект:

```powershell
npm i @<твой-npm-логин>/sdk-react-native
```

Дальнейшие релизы:

```powershell
npm version patch        # поднимает версию + git tag
git push --follow-tags
npm publish
```

## 5. Переключение на ПРОД позже

Тест отличается от прода только метаданными. Чтобы выпустить прод-версию:

1. `name` → `@chat-platform/sdk-react-native` (требуется npm-организация `chat-platform`).
2. `repository` / `homepage` / `bugs` → на реальный приватный репозиторий
   (`robotmia/chat-platform-sdk-react-native`).
3. (Опционально) `license` → реальная лицензия + файл `LICENSE`, если код открывается.
4. Подключить GitHub Actions для авто-публикации по git-тегу (Фаза 7 плана).

Сборка, exports и структура пакета у теста и прода идентичны — менять их не нужно.

## Примечание про iOS podspec

`ChatPlatformSdk.podspec` содержит `homepage`/`source` со ссылкой на исходный репо.
Для пакета, установленного из npm, эти поля косметические (CocoaPods берёт файлы
локально из `node_modules`), на работу `pod install` не влияют.