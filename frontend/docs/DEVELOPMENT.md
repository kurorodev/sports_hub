# Разработка и запуск frontend

[Документация](README.md) · [QA](QA.md) · [API](API_REVIEW.md)

## Java и PostgreSQL

Нужны Docker / OrbStack, Node.js 22.12+ и npm. Если `backend/.env` ещё нет, скопируйте `backend/.env.example` в этот файл. Существующий `.env` не перезаписывайте. Из корня репозитория:

```sh
docker compose --env-file backend/.env -p sport -f backend/compose.yaml up --build -d
curl http://localhost:8080/api/v1/health
```

Ожидается `status: UP`. Первый запуск скачивает образы и Maven-зависимости. Данные хранятся в volume `sport_postgres_data`; повторный запуск не сбрасывает seed. Детали сервера — в [backend/README.md](../../backend/README.md).

```sh
cd frontend
npm ci
npm run dev
```

`npm run dev` и `npm run dev:real` выбирают `.env.real`. Открывайте `http://localhost:5173`: этот origin разрешён стандартной настройкой CORS backend. Vite проксирует `/api/v1` на `http://localhost:8080`. Порты 8080 и 5432 должны быть свободны; чужие сервисы автоматически не останавливаются. Остановка только этого проекта из корня: `docker compose -p sport -f backend/compose.yaml stop`.

`GET /demo/accounts` даёт актуальные имена и accountId. Основной QA-путь: `athlete-a` создаёт → `athlete-b` записывается → `athlete-a` видит участника. Cookie `SPORT_SESSION` устанавливает Java; фронт использует `credentials: include`, CSRF из `/session`, приватный кэш очищается при смене аккаунта.

`/register` создаёт аккаунт через `POST /auth/register` и сразу устанавливает сессию. Пароль 8–128 символов; повторный вход — `@nickname` и пароль на `/login`. Эти маршруты работают при `DEMO_ENABLED=false`; фиксированные демоаккаунты доступны отдельно только в деморежиме. `/profile` читает и редактирует собственный профиль, `/users/:userId` доступен гостю. Созданные аккаунты и встречи остаются в PostgreSQL после перезапуска.

## Моки

```sh
npm run dev:mock
```

`.env.mock` явно запускает MSW; вверху страницы есть отметка режима. На `/login` доступны локальные Александр (`user-alex`), Мария (`user-maria`), клуб (`org-run`) и администратор (`admin`). Это отдельная локальная база, независимая от PostgreSQL. Wire DTO и пути берутся из того же OpenAPI; аккаунты и события различаются. При смене real/mock перезапускайте Vite.

Вся графика и Manrope поставляются локально. SVG-иллюстрации созданы для проекта, не являются фотографиями событий.

Mock-регистрация также создаёт отдельного пользователя с хешем пароля; он не предлагается в списке демо-входа. Новые аккаунты хранятся в `sport.mock.accounts.v1`, изменения профилей — в `sport.mock.profiles.v1`, текущий аккаунт — в `sport.mock.account`. Для полного сброса используйте список ключей в [QA.md](QA.md); удаление localStorage не меняет Java/PostgreSQL.

## Окружение и сборки

`.env.example` описывает `VITE_API_MODE=real|mock` и `VITE_API_BASE_URL=/api/v1`. Локальные overrides храните в игнорируемых `.env.local` или `.env.real.local`/`.env.mock.local`. Режим по умолчанию real. API base URL задаётся без конечного `/`.

```sh
npm run build       # production real API
npm run build:mock  # явная демонстрационная сборка с MSW
npm run preview     # просмотр последней сборки
```

Real mode не включает MSW и не переключается на него при ошибке Java. Для другого origin настройте credentialed CORS и cookie SameSite/Secure. При размещении SPA нужен fallback frontend-маршрутов на `index.html`, исключая `/api/*` и assets. Vite dev proxy в production-сборку не входит: API проксирует сервер размещения. Публикация не выполнялась.

## Контракт и проверки

```sh
npm run api:generate # из ../backend/contracts/openapi.yaml
npm run api:check    # проверка актуальности generated/schema.d.ts
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

`test:e2e` поднимает отдельный Vite в mock mode на `127.0.0.1:5175`. Тестовые часы фиксированы, seed воспроизводим. `test:e2e:api` запускает real mode на `127.0.0.1:5174`, блокирует service workers и требует доступных Java/PostgreSQL. Для этого origin нужен CORS. Из корня репозитория:

```sh
CORS_ORIGINS=http://localhost:5173,http://localhost:3000,http://127.0.0.1:5174 \
  docker compose --env-file backend/.env -p sport -f backend/compose.yaml up -d backend

cd frontend
npm run test:e2e:api
```

Команда пересоздаёт контейнер backend с тестовой CORS-настройкой; его сессии в памяти будут сброшены, бизнес-данные сохранятся. Прогон создаёт собственные организации, заявки, решения, встречи, комментарии и виды спорта; S6 скрывает собственные тестовые комментарии и снимает собственные тестовые события через API и оставляет их в базе; общие данные не удаляет. Тесты на моках и Java запускайте последовательно. Их traces сохраняются отдельно в `test-results/mock/` и `test-results/api/`; скриншоты — в `test-results/`. Артефакты `test-results/` в Git не входят. Реальные даты создания вычисляются относительно текущего дня, без изменения часов Java.

Результаты, ручные пути и ограничения — в [QA.md](QA.md). После обновления OpenAPI пересоздайте типы, исправьте адаптеры/моки и повторите оба прогона.
