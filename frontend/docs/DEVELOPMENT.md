# Разработка и запуск frontend

[Документация](README.md) · [Ручная проверка и результаты QA](QA.md)

Все команды ниже выполняются из `frontend/`, кроме первоначального `cd frontend`.

## Локальный запуск и окружение

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

## Команды проверок

```sh
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

RTL/Vitest проверяют фильтры, empty/error/retry, восстановление ролей, запрет доступа, HTTP/CSRF boundary, создание, ошибки полей, timezone, OPEN-запись, дубли и лимит мест. Playwright поднимает Vite в mock mode: каталог/прямые URL, переключение ролей, S1/S3 с перезагрузкой и адаптив. Браузерные скриншоты: `test-results/`, в git не входят. Автотесты не доказывают интеграцию с Java.

Результаты конкретных прогонов и ограничения проверки фиксируются в [QA.md](QA.md). Требования к API и порядок перехода с временных DTO — в [API_REVIEW.md](API_REVIEW.md).
