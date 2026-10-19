# ДВИЖ · Sports Hub

Приложение разделено на [`frontend/`](frontend/) (React + TypeScript) и [`backend/`](backend/) (Java + PostgreSQL).

## Локальный запуск приложения

Нужны запущенный Docker / OrbStack, Node.js 22.12+ и npm. Из корня репозитория:

```sh
docker compose -p dvizh -f backend/compose.yaml up --build -d
cd frontend
npm ci
npm run dev -- --port 5173 --strictPort
```

Откройте **http://localhost:5173**. Интерфейс работает с настоящим backend; изменения сохраняются в PostgreSQL. На странице входа выберите демоаккаунт без пароля: Алексей, Мария, тренер, представитель организации или администратор.

Для доступа с другого устройства в той же сети используйте адрес `Network` из вывода Vite, например `http://10.101.228.77:5173`. Добавьте этот origin в `CORS_ORIGINS` в локальном `backend/.env` и примените настройки командой `docker compose --env-file backend/.env -p dvizh -f backend/compose.yaml up -d backend`. Сетевой IP может измениться при переподключении. Интерфейс проксирует запросы API; подключаться нужно к порту 5173.

Реализованы каталог, создание встреч, свободная запись, заявки с решением организатора, обсуждения, заявки организаций, решения администратора и публикация встреч от имени одобренной организации. Администратору доступна модерация мероприятий и комментариев с указанием причины. Карта `/map` показывает встречи и площадки, позволяет выбрать точку и оценить загруженность. Адресные подсказки требуют `GEOAPIFY_API_KEY` в `backend/.env`; без ключа доступен ручной выбор точки.

Повторный запуск: поднимите контейнеры той же командой (после первой сборки можно без `--build`), затем выполните `cd frontend && npm run dev -- --port 5173 --strictPort`. Остановка интерфейса — `Ctrl+C`; остановка backend и БД из корня:

```sh
docker compose -p dvizh -f backend/compose.yaml stop
```

Данные БД сохраняются при остановке. Инструкции и проверки интерфейса: [`frontend/README.md`](frontend/README.md).

## Запуск backend

Из корня репозитория (нужны Docker и Docker Compose):

```sh
docker compose -p dvizh -f backend/compose.yaml up --build -d
curl http://localhost:8080/api/v1/health
```

API: `http://localhost:8080/api/v1`. OpenAPI: [`backend/contracts/openapi.yaml`](backend/contracts/openapi.yaml) и `http://localhost:8080/openapi.yaml` после запуска.

Подробные команды, демоаккаунты и проверки: [`backend/README.md`](backend/README.md).

## Забрать backend в рабочую ветку

Сохраните текущую работу коммитом, затем в своей ветке выполните:

```sh
git fetch origin
git merge origin/master
```

Backend использует cookie-сессию и CSRF; подключение клиента описано в [инструкции backend](backend/README.md#подключение-frontend).
