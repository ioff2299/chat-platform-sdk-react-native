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
2. Включить 2FA один раз: Account → Two-Factor Authentication.
   ВАЖНО: с осени 2025 npm убрал TOTP (authenticator-приложения) для новых аккаунтов —
   доступен только **passkey / security key (WebAuthn)**. Физический USB-ключ покупать
   НЕ нужно, подойдёт любой из вариантов:
   - **Windows Hello** (PIN / отпечаток / лицо) — пункт «password/PIN as a security key».
     На системном окне выбрать «этот компьютер», НЕ «USB security key».
   - **Passkey на телефоне** — браузер покажет QR, сканируешь телефоном, подтверждаешь биометрией.
   - **Менеджер паролей** (1Password / Bitwarden / KeePassXC) — хранит passkey программно.

   2FA на уровне аккаунта обойти нельзя, но **вводить что-либо при каждой публикации
   не придётся** — публикация идёт через токен (см. ниже).
3. Создать **Granular Access Token** с обходом 2FA:
   Account → Access Tokens → Generate New Token → *Granular Access Token* →
   включить **«Bypass two-factor authentication»**, дать **Read and write** на пакеты,
   выбрать scope/пакет, задать срок (до 90 дней). Скопировать токен (показывается один раз).

> Scope `@<твой-логин>` создаётся автоматически — отдельную организацию заводить не нужно.

### Публикация без ввода 2FA-кода

Положить токен в `.npmrc` (НЕ коммитить — он уже под `*.tgz`/секреты; см. п.0 ниже),
тогда `npm publish` не будет спрашивать одноразовый код:

```powershell
# в корне репозитория, разово
"//registry.npmjs.org/:_authToken=ВАШ_ТОКЕН" | Out-File -FilePath .npmrc -Encoding utf8 -Append
```

Добавь `.npmrc` в `.gitignore`, чтобы токен не попал в git.

> Условие: на пакете не должна стоять политика «Require 2FA and disallow tokens».
> Для нового пакета она по умолчанию выключена — ничего делать не нужно.

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

С токеном из п.1 в `.npmrc` логиниться и вводить 2FA-код не нужно:

```powershell
npm publish --access public       # --access public обязателен для scoped-пакета
```

> Без токена альтернатива — `npm login`, но тогда npm попросит одноразовый 2FA-код.

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