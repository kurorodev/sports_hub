# Стечение

Финальное название проекта — **Стечение**, задано в [branding.json](branding.json). Логотипы и правила использования: [docs/branding.md](docs/branding.md).

Приложение разделено на [`frontend/`](frontend/) (React + TypeScript) и [`backend/`](backend/) (Java + PostgreSQL).

## Локальный запуск приложения

Нужны запущенный Docker / OrbStack, Node.js 22.12+ и npm. Если `backend/.env` ещё нет, скопируйте `backend/.env.example` в `backend/.env`. Существующий файл с локальными настройками сохраните. Из корня репозитория:

```sh
docker compose --env-file backend/.env -p sport -f backend/compose.yaml up --build -d
cd frontend
npm ci
npm run dev -- --port 5173 --strictPort
```

Откройте **http://localhost:5173**. Интерфейс работает с настоящим backend; изменения сохраняются в PostgreSQL. Для проверки тестовых ролей на странице входа доступен отдельный список демоаккаунтов без пароля: Алексей, Мария, организатор встреч, представитель организации или администратор.

На `/register` можно создать аккаунт с никнеймом и паролем. Вход — на `/login` по `@nickname` и паролю; новые аккаунты исключены из демопереключения. Личный профиль и редактирование доступны на `/profile`, публичный профиль организатора — по его имени в карточке встречи. В форме встречи есть необязательные условия участия, которые видны всем читателям события.

Для доступа с другого устройства в той же сети используйте адрес `Network` из вывода Vite, например `http://10.101.228.77:5173`. Добавьте этот origin в `CORS_ORIGINS` в локальном `backend/.env` и примените настройки командой `docker compose --env-file backend/.env -p sport -f backend/compose.yaml up -d backend`. Сетевой IP может измениться при переподключении. Интерфейс проксирует запросы API; подключаться нужно к порту 5173.

Реализованы каталог, создание встреч, свободная запись, заявки с решением организатора, обсуждения, заявки организаций, решения администратора и публикация встреч от имени одобренной организации. Администратору доступна модерация мероприятий и комментариев с указанием причины. Карта `/map` показывает встречи и площадки, позволяет выбрать точку и оценить загруженность. Адресные подсказки требуют `GEOAPIFY_API_KEY` в `backend/.env`; без ключа доступен ручной выбор точки.

Повторный запуск: поднимите контейнеры той же командой (после первой сборки можно без `--build`), затем выполните `cd frontend && npm run dev -- --port 5173 --strictPort`. Остановка интерфейса — `Ctrl+C`; остановка backend и БД из корня:

```sh
docker compose -p sport -f backend/compose.yaml stop
```

Данные БД сохраняются при остановке. Инструкции и проверки интерфейса: [`frontend/README.md`](frontend/README.md).

## Запуск backend

Из корня репозитория (нужны Docker и Docker Compose):

```sh
docker compose --env-file backend/.env -p sport -f backend/compose.yaml up --build -d
curl http://localhost:8080/api/v1/health
```

API: `http://localhost:8080/api/v1`. OpenAPI: [`backend/contracts/openapi.yaml`](backend/contracts/openapi.yaml) и `http://localhost:8080/openapi.yaml` после запуска.

Подробные команды, демоаккаунты и проверки: [`backend/README.md`](backend/README.md).

## Получить текущую версию приложения

Актуальная интеграция frontend и backend находится в ветке `frontend`. Сохраните текущую работу коммитом, затем выполните:

```sh
git fetch origin
git switch frontend
git pull --ff-only origin frontend
```

Backend использует cookie-сессию и CSRF; подключение клиента описано в [инструкции backend](backend/README.md#подключение-frontend).

В обсуждении встречи можно отметить человека: начните вводить `@nickname`, выберите подсказку и отправьте сообщение. Отметка ведёт в профиль и сохраняет привязку после смены никнейма. Подробности входа и упоминаний: [пароли и упоминания](backend/docs/passwords-and-mentions.md).
