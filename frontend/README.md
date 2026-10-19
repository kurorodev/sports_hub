# ДВИЖ · frontend

Первый P0-срез: адаптивная оболочка, демо-сессии и каталог событий. React 19 + TypeScript strict + Vite 7, React Router 7, TanStack Query 5, Tailwind CSS 4 через Vite plugin, React Hook Form + Zod, MSW 2. Точные версии закреплены `package-lock.json`.

Работа на сетевых моках. **Java не интегрирован.** DTO временные: в checkout пока нет общего OpenAPI. Блокеры и границы: [API_REVIEW.md](docs/API_REVIEW.md). Исходная визуальная система: [DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md).

## Запуск

Node.js 22.12+ или современная совместимая версия (разработка проверяется на Node 25), npm.

```sh
cd frontend
npm ci
npm run dev
```

Откройте URL из вывода Vite. `npm run dev` явно выбирает `.env.mock`. Вверху страницы видна отметка о моках; вся графика и Manrope поставляются локально. SVG-иллюстрации созданы для проекта, не выдаются за фото событий.

```sh
npm run dev:real
```

Этот режим выбирает `.env.real`. Относительный `/api/v1` проксируется Vite на `http://localhost:8080`. Java должен поддерживать согласованный контракт, cookie `SPORT_SESSION`, CSRF и демо-аккаунты. При другом origin настройте credentialed CORS, cookie SameSite/Secure и `VITE_API_BASE_URL`. UI не читает cookie. Backend требуется сверить с моделями перед подключением.

`.env.example` описывает переменные. Локальные overrides храните в игнорируемом `.env.local` или `.env.mock.local`/`.env.real.local`. `VITE_API_MODE` допускает только `mock|real`; по умолчанию real. `VITE_API_BASE_URL` — URL API без конечного `/`. Секретов здесь быть не должно.

```sh
npm run build         # production, real API, без запуска MSW
npm run build:mock    # явно выбранная демонстрационная сборка на моках
npm run preview      # просмотр последней сборки
```

При размещении SPA нужен fallback всех frontend-маршрутов на `index.html`, исключая `/api/*` и статические assets. Продакшен-сервер сам проксирует API; Vite dev proxy не входит в сборку. Публикация не выполнялась.

## Демо-аккаунты и ручной QA

На `/login` доступны Александр (`user-alex`), Мария (`user-maria`), представитель клуба (`org-run`) и администратор (`admin`). Организация определяется `manageableOrganizationIds`, а не выдуманной системной ролью ORGANIZATION.

1. Открыть каталог, выбрать спорт/город, найти событие. Фильтры сохраняются в URL после reload. Проверить пустую выдачу и сброс.
2. Открыть событие по ссылке. Дата показывает время исходного timezone-offset, без преобразования в часовой пояс браузера. Перейти на `/events/missing` для 404.
3. Войти администратором, перезагрузить, открыть `/admin`. Сменить аккаунт на Александра — ссылка «Модерация» исчезает, прямой `/admin` показывает запрет.
4. Войти представителем клуба и открыть `/organization`. Это только каркас доступа; одобрение организации ещё не реализовано.
5. Проверить 320/375/768/1024/1440 px и клавиатуру: видимый фокус, skip-link, поиск, фильтры, выбор аккаунта.

Seed содержит 6 демонстрационных событий 24 октября–1 ноября 2026 года. После этих дат включите «Показать прошедшие». Для полного сброса сессии удалите `dvizh.mock.account` из localStorage. Моки не используют персональные данные.

## Проверки

```sh
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

RTL/Vitest проверяют фильтры, empty/error/retry, восстановление ролей, запрет доступа, HTTP/CSRF boundary и timezone. Playwright поднимает Vite в mock mode: каталог/прямые URL, переключение ролей и адаптив. Браузерные скриншоты: `test-results/`, в git не входят. Автотесты не доказывают интеграцию с Java.

Код организован по сценариям: `app/` — router/layout; `features/events` и `features/session` — UI/query; `shared/api` — транспорт/временные модели; `mocks/` — сетевые handlers и seed. Цвета, размеры и радиусы централизованы в `src/shared/styles/index.css`; CSS custom properties — источник темы, Tailwind 4 подключён через `@import 'tailwindcss'`.

Далее по AGENTS.md: S1 создание и новый спорт → S3 OPEN → S4 APPROVAL → S5 обсуждения → S2 организации → S6 модерация. P1/P2 пока не начаты. Формальный статус QA текущего среза фиксируется в [QA.md](docs/QA.md).
