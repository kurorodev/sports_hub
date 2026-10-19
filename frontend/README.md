# ДВИЖ · frontend

Реализованы P0 shell/session, каталог, S1 (личная встреча со своим видом спорта), S3 (OPEN-запись и участники), S4 (заявки с решением организатора), S5 (публичное обсуждение встречи) и S2 (допуск организаций и публикация от их имени). React 19 + TypeScript strict + Vite 7; точные версии закреплены `package-lock.json`.

**Java API подключён** для сессии, каталога, S1, S2, S3, S4 и обсуждения S5. Сквозной браузерный путь проверен с PostgreSQL на 375/768/1440 px. Типы генерируются из `../backend/contracts/openapi.yaml`. Границы интеграции описаны в [API_REVIEW.md](docs/API_REVIEW.md).

## Быстрый запуск

Node.js 22.12+ или совместимая современная версия, npm.

```sh
# Из корня репозитория; требуется запущенный Docker / OrbStack
docker compose -p dvizh -f backend/compose.yaml up --build -d

cd frontend
npm ci
npm run dev         # Java API на localhost:8080, .env.real
```

Откройте `http://localhost:5173` из вывода Vite. На `/login` аккаунты загружаются с Java, без паролей: Алексей (`athlete-a`), Мария (`athlete-b`), Ирина (`athlete-c`), тренер (`coach`), представители организаций и администратор (`admin`). После смены режима перезапустите Vite.

```sh
npm run dev:mock    # отдельный режим сетевых моков, .env.mock
npm run build      # production real mode
npm run build:mock # демонстрационная сборка на моках
npm run api:generate # после изменения OpenAPI
npm run api:check
npm run typecheck
npm run lint
npm test
npm run test:e2e    # моки; перед первым запуском: npx playwright install chromium
npm run test:e2e:api # Java + PostgreSQL; CORS-настройка — в docs/DEVELOPMENT.md
```

## Документация

Все фронтенд-документы собраны в [docs/README.md](docs/README.md):

- [Разработка](docs/DEVELOPMENT.md) — окружение, env, mock/real, сборка и команды проверок.
- [Дизайн-система](docs/DESIGN_SYSTEM.md) — внешний вид, токены, адаптив и доступность.
- [Архитектура](docs/ARCHITECTURE.md) — Clean Architecture + FSD, границы модулей и текущий объём перехода.
- [API и интеграция](docs/API_REVIEW.md) — покрытые endpoints, зависимости и вопросы к backend.
- [QA](docs/QA.md) — демо-аккаунты, ручные пути S1–S5, сброс моков и результаты автотестов.

Далее — S6: модерация мероприятий и комментариев. Организации доступны в `/organizations`, свои заявки — в `/organization`, административные решения — в `/admin`. P1/P2 пока не начаты.
