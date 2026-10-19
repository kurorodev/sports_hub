# ДВИЖ · frontend

Реализованы P0 shell/session, каталог, S1 (личная встреча со своим видом спорта) и S3 (OPEN-запись и участники). React 19 + TypeScript strict + Vite 7; точные версии закреплены `package-lock.json`.

Работа на сетевых моках. **Java не интегрирован.** DTO временные: общего OpenAPI в текущем checkout пока нет. Условия подключения и ограничения описаны в [API_REVIEW.md](docs/API_REVIEW.md).

## Быстрый запуск

Node.js 22.12+ или совместимая современная версия, npm.

```sh
cd frontend
npm ci
npm run dev         # сетевые моки, .env.mock
```

Откройте URL из вывода Vite. На `/login` доступны Александр (`user-alex`), Мария (`user-maria`), представитель клуба (`org-run`) и администратор (`admin`), без паролей.

```sh
npm run dev:real    # Java API, .env.real; требуется согласовать контракт
npm run build      # production real mode
npm run build:mock # демонстрационная сборка на моках
npm run typecheck
npm run lint
npm test
npm run test:e2e    # перед первым запуском: npx playwright install chromium
```

## Документация

Все фронтенд-документы собраны в [docs/README.md](docs/README.md):

- [Разработка](docs/DEVELOPMENT.md) — окружение, env, mock/real, сборка и команды проверок.
- [Дизайн-система](docs/DESIGN_SYSTEM.md) — внешний вид, токены, адаптив и доступность.
- [Архитектура](docs/ARCHITECTURE.md) — Clean Architecture + FSD, границы модулей и текущий объём перехода.
- [API и интеграция](docs/API_REVIEW.md) — временные DTO, зависимости и вопросы к backend.
- [QA](docs/QA.md) — демо-аккаунты, ручные пути S1/S3, сброс моков и результаты автотестов.

Далее: S4 APPROVAL → S5 обсуждения → S2 организации → S6 модерация. P1/P2 пока не начаты. Кабинеты администратора и организации пока проверяют только доступ; бизнес-операции не реализованы.
