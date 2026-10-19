# ДВИЖ — backend

Бэкенд платформы совместных спортивных активностей по предоставленным PDF, командной спецификации и OpenAPI. Java 21, Spring Boot 3.5.16, Spring Security, Spring Data JPA, PostgreSQL, Flyway, Maven. Включены все 51 операция исходного контракта, шесть обязательных сценариев и дополнительные API профилей, рекомендаций, очереди ожидания, рейтинга и переписки.

Это серверная часть. Frontend, презентация и публикация в GitVerse в эту поставку не входят. Статус проверок и ограничения приведены ниже и в [docs/verification.md](docs/verification.md).

## Быстрый запуск через Docker

Нужны Docker Engine и Docker Compose v2 с доступом к Docker Hub и Maven Central при первой сборке.

Если JDK, Maven и Compose уже установлены, одна команда выполняет сборку с тестами, поднимает PostgreSQL и backend, ожидает готовности API и запускает HTTP smoke:

```bash
bash /home/dhevydev/sport-hub/scripts/start-local.sh
```

Запускайте её из обычного терминала. Maven собирает JAR один раз на компьютере; Compose использует `compose.local.yaml` и `Dockerfile.runtime`, которые упаковывают готовый JAR без загрузки Maven-зависимостей в Docker. Для повторного запуска уже собранного приложения без изменений кода: `bash scripts/start-local.sh --skip-build`. Если Docker доступен только с правами администратора, скрипт вызовет `sudo` только для Docker-команд. Результаты сохраняются в `build-latest.log`, `startup.log`, `smoke-latest.log`; при ошибке готовности/HTTP-проверки — также в `startup-diagnostics.log`.

Для Debian 13 подготовлен установщик JDK 21, Maven, Compose и Buildx. Если Docker отсутствует, он также установит Docker из репозитория Debian. Запустите из обычного терминала:

```bash
bash /home/dhevydev/sport-hub/scripts/install-debian.sh
```

Скрипт использует `sudo` для установки пакетов и запуска службы Docker. Пароль вводится только в терминале. Права групп и Docker-сокета не меняются. Проверка без установки: `bash scripts/install-debian.sh --check`. Установка выполнена пользователем в обычном терминале; наличие JDK 21, Maven и Compose подтверждено.

```bash
cd /home/dhevydev/sport-hub
cp .env.example .env
docker compose up --build -d
curl http://localhost:8080/api/v1/health
```

API: `http://localhost:8080/api/v1`. Контракт: `http://localhost:8080/openapi.yaml`. Готовность приложения и БД: `/actuator/health`. Данные сохраняются в Docker volume `postgres_data`; обычный `docker compose down` их сохраняет. Порт БД доступен только с localhost. Backend по умолчанию также доступен с localhost; для сетевой демонстрации настройте `BACKEND_BIND` или reverse proxy.

В `.env.example` указаны локальные демонстрационные значения. Compose включает `DEMO_ENABLED=true`: это **вход в заранее подготовленные вымышленные аккаунты без пароля**, включая администратора. Для общего публичного приложения нужна отдельная настоящая авторизация; текущий контракт описывает конкурсный прототип.

## Запуск без контейнера приложения

Нужны JDK 21, Maven 3.6.3+ (рекомендуется 3.9.x) и PostgreSQL 17. Maven должен загружать зависимости из Maven Central.

```bash
cd /home/dhevydev/sport-hub
docker compose up -d db
cd backend
mvn verify
SPRING_PROFILES_ACTIVE=demo mvn spring-boot:run
```

Параметры: `DB_URL` (по умолчанию `jdbc:postgresql://localhost:5432/dvizh`), `DB_USER`, `DB_PASSWORD`, `PORT`, `DEMO_ENABLED`, `COOKIE_SECURE`, `CORS_ORIGINS`. Файл `.env` читает Compose; при запуске Java напрямую переменные необходимо передать процессу самостоятельно. Без `demo`-профиля или `DEMO_ENABLED=true` демовход и seed выключены.

Flyway применяет `V1__schema.sql` автоматически. Hibernate работает с `ddl-auto=validate`, не создаёт и не обновляет схему. Seed выполняется один раз в пустой демобазе и не перезаписывает внесённые изменения. Даты будущих событий относительно первого запуска; после их истечения можно создать новые события через API.

## Подключение frontend

[contracts/openapi.yaml](contracts/openapi.yaml) — исходный контракт без изменений. API использует `joinMode`, `POST .../decision` и `GET /session` согласно этому файлу. Часть ранних примеров в Markdown использует старые имена; объяснение находится в [docs/decisions.md](docs/decisions.md).

```javascript
const response = await fetch('http://localhost:8080/api/v1/demo/session', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ accountId: 'athlete-a' })
});
const session = await response.json();
// На POST/PATCH/DELETE передавайте session.csrfToken в X-CSRF-Token.
// На каждом запросе сохраняйте credentials: 'include'.
```

Cookie `SPORT_SESSION` — HttpOnly; токен CSRF берётся из JSON `/session`. Вход инвалидирует предыдущую сессию и выдаёт новый CSRF. Выход: `DELETE /demo/session` с CSRF. Для смены роли выбирается другой демоаккаунт, а не передаётся `role`/`userId` в произвольном запросе. После входа заново запрашивайте `/session`, чтобы увидеть текущие одобренные организации.

CORS допускает `http://localhost:5173` и `http://localhost:3000`. Другие origin задаются через `CORS_ORIGINS` через запятую. Для HTTPS установите `COOKIE_SECURE=true`; предпочтителен общий origin frontend и API с проксированием `/api`. SameSite=Lax предполагает развёртывание на одном site.

Пагинация: `page=0`, `size=20`, максимум 100. Ответ: `{items,page,size,total,totalPages}`. Ошибка: `{code,message,details,requestId}`; детали — массив полей согласно OpenAPI. `X-Request-Id` помогает сопоставить ответ с серверным журналом. Пользовательский текст возвращается как plain text: frontend должен выводить его текстовыми узлами и не вставлять через `innerHTML`.

## Демонстрационные аккаунты

Полный список выдаёт `GET /demo/accounts`.

| accountId | Назначение |
|---|---|
| `athlete-a`, `athlete-b`, `athlete-c` | Пользователи и участники |
| `coach` | Автор демособытий, тренер и спортивный организатор |
| `referee` | Судья, отдельно назначенный на демосоревнования |
| `org-approved` | Представитель одобренного клуба «Темп» |
| `org-pending` | Представитель организации «Новый старт», ожидающей решения |
| `org-rejected` | Представитель отклонённой организации «Вектор» |
| `admin` | Административная модерация |

У `athlete-b` в seed 20 баллов за два проверенных соревнования; третье завершённое соревнование позволяет показать +10 и переход в `ACTIVE`. Остальные начальные рейтинги равны нулю. Есть личный диалог A↔B, групповой чат клуба, заполненное событие с очередью, черновик и снятое событие. UUID детерминированы; для работы frontend следует получать их из API.

Полный API-прогон обязательных сценариев: [scripts/smoke.py](scripts/smoke.py). Пошаговая демонстрация: [docs/demo.md](docs/demo.md).

```bash
python3 scripts/smoke.py --base http://localhost:8080/api/v1
```

Скрипт создаёт собственные вымышленные события и организации через HTTP, проверяет результат под разными ролями, обе ветви решений и запреты. Не очищает общую базу.

## Проверки

```bash
cd backend
mvn verify                     # JUnit, MockMvc, H2 PostgreSQL mode; Docker не нужен
mvn -Ppostgres-it verify       # также S1–S6, расширения и конкурентные запросы в PostgreSQL/Testcontainers
```

Второй вариант требует доступного Docker daemon. PostgreSQL-тесты не помечены как пропущенные при отсутствии Docker: команда должна завершиться ошибкой, если выполнить их нельзя. Отдельный автоматический workflow `.github/workflows/backend.yml` подготовлен для GitHub Actions; в GitVerse команды нужно включить в его CI.

Для статической сверки API нужен Python 3 и PyYAML:

```bash
python3 -m pip install pyyaml
python3 scripts/check_contract.py
```

**Фактически проверено:** полный `mvn verify` завершился **BUILD SUCCESS**, все **23 теста** прошли, включая пять конкурентных сценариев на H2. Исполняемый JAR собран. Логи пользовательского запуска подтверждают работу PostgreSQL и backend в Docker, успешный HTTP smoke S1–S6, очереди и чатов. Полный профиль PostgreSQL/Testcontainers ещё не запускался: Docker daemon недоступен из изолированной сессии агента. Точные результаты: [docs/verification.md](docs/verification.md).

## Правила и ограничения

- Системные права, владение, допуск организации, лимиты и автор сообщения определяет сервер. Спортивная роль в профиле не даёт прав администратора или судьи на чужих соревнованиях.
- `OPEN` сразу создаёт `CONFIRMED`; `APPROVAL` создаёт `PENDING`, решение принимает только организатор. Дубликаты запрещены; отменённую регистрацию можно подать повторно. Отклонённую заявку повторно подать нельзя.
- Места занимают только `CONFIRMED`. Все изменения блокируют строку события в транзакции. Очередь только для заполненного `OPEN`; отмена участника автоматически продвигает первого ожидающего. Изменение лимита при существующей очереди запрещено.
- Снятие с публикации сохраняет регистрации и причину. Карточка видна владельцу, администратору и ранее зарегистрированным; новые записи запрещены. Восстановление модератором не предусмотрено контрактом; `/publish` предназначен для черновиков.
- Рейтинг: +10 за верифицированное участие в завершённом `COMPETITION` с `endsAt`; `ROOKIE` 0–29, `ACTIVE` 30–79, `EXPERIENCED` 80–159, `ELITE` 160+. Проверяет организатор или назначенный на конкретное событие судья; проверять собственное участие нельзя. Повтор возвращает ту же проводку. Проводки и факт верификации записываются атомарно. Это внутренний показатель активности; внешней проверки посещения нет.
- Снятие уже проверенного соревнования **сохраняет ранее начисленные баллы**, новые начисления запрещены. Автоматического отзыва и API корректировок контракт не содержит.
- Рекомендации: +50 за любимый спорт, +20 за уровень, +20 за предпочитаемое время, +10 за места. Время сравнивается в UTC, поскольку в контракте нет часового пояса профиля; используемые интервалы указаны в ADR. Текущая реализация сортирует кандидатов в памяти, подходит для прототипа.
- Direct доступен только двум участникам, включая запрет для постороннего администратора. Community доступен активным членам одобренной организации; после выхода закрыта вся история, после повторного свободного вступления доступ восстанавливается. Исключение другого участника, жалобы и модерация приватных сообщений требуют дополнительных API.
- Переписка работает через HTTP и пагинацию; frontend может использовать polling. WebSocket, загрузка файлов, настоящее создание аккаунтов и восстановление пароля не входят в предоставленный API.
- Встроенного rate limiting, внешних уведомлений и загрузки файлов нет. При внешнем размещении ограничения запросов можно настроить в reverse proxy.
- Аватары — внешние HTTP(S) URL, сервер их не загружает; frontend должен показывать fallback при ошибке загрузки.
- Сессии хранятся в памяти одного экземпляра сервиса и теряются при перезапуске. Бизнес-данные хранятся в PostgreSQL. Для нескольких экземпляров потребуется общее хранилище сессий.

## Структура

```text
backend/src/main/java/ru/dvizh/
  api/          HTTP-контроллеры, DTO, ошибки и пагинация
  config/       Security, CORS, request ID, демоданные
  domain/       JPA-сущности
  persistence/  параметризованные JPQL-запросы
  service/      бизнес-правила, транзакции и API-проекции
backend/src/main/resources/db/migration/  Flyway
backend/src/test/                         JUnit, MockMvc, Testcontainers
contracts/                               исходный OpenAPI
docs/source/                             оба исходных PDF
docs/                                    спецификация, архитектура, решения, QA
scripts/                                 HTTP smoke и статическая сверка API
compose.yaml                             PostgreSQL и backend
```

Архитектура и модель: [docs/architecture.md](docs/architecture.md). Использованные технические источники: [Spring Boot system requirements](https://docs.spring.io/spring-boot/3.5/system-requirements.html) и [Spring Security CSRF](https://docs.spring.io/spring-security/reference/servlet/exploits/csrf.html).
