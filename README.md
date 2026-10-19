# ДВИЖ · Sports Hub

Backend находится целиком в [`backend/`](backend/): исходники, Maven, Docker Compose, скрипты, API-контракт и документация.

## Запуск backend

Из корня репозитория (нужны Docker и Docker Compose):

```sh
cd backend
cp .env.example .env
docker compose up --build -d
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
