# Архитектура frontend

Статус: постепенный переход к Clean Architecture с принципами Feature-Sliced Design. Сценарий S3 OPEN уже разделён на чистое ядро, адаптеры и React. Остальные экраны приведены к слоям FSD, но создание события и сессия пока используют прежний query/service-подход. Весь проект ещё не считается полностью переведённым на Clean Architecture.

## Структура и направление зависимостей

```text
src/
  app/                          router, layout, composition root/providers
  pages/                        сборка каталога, события, создания, входа и кабинетов
  features/
    join-event/model/           независимые сценарии joinEvent/findMyRegistration
    join-event/ui/              JoinAction, useJoinEvent, TanStack query options
    create-event/ui/            существующая форма и её Zod-схема
  entities/
    event/                      API/query, карточка, форматирование, EventParticipation
    registration/model/         Registration, ParticipantPage, repository port, failures
    registration/api/           HTTP-репозиторий, DTO mappers, read query options
    registration/lib/           React context для внедрения репозитория
    registration/ui/            участники и отображение статусов/ошибок
    session/                    существующие session/demo query/services
  shared/                       транспорт, временные DTO, общие UI и токены
  mocks/                        MSW и локальная эмуляция backend
  tests/                        проверки ядра, адаптеров, UI и границ
```

Допустимое направление слоёв: `app → pages → features → entities → shared`. Промежуточные слои можно пропускать. Модуль одного слоя не импортирует другой модуль того же слоя; несколько модулей собираются выше. `widgets/` пока не требуется и не создаётся.

Обычные потребители используют публичные `index.ts` модулей. У моделей есть отдельный чистый entry point `entities/*/model/index.ts`, чтобы сценарий не импортировал React через общий barrel. Composition root явно импортирует конкретный HTTP-адаптер. Сам HTTP-адаптер не экспортируется через UI entry point регистрации.

## S3: Clean Architecture

```mermaid
flowchart TD
  UI[JoinAction] --> Hook[useJoinEvent: React/TanStack]
  Hook --> UseCase[joinEvent / findMyRegistration]
  UseCase --> Port[RegistrationRepository: interface]
  HTTP[HTTP repository] --> Port
  HTTP --> Mapper[DTO mappers + failure mapping]
  HTTP --> Fetch[shared/api/client]
  App[app/providers: composition root] --> HTTP
  App --> Context[RegistrationRepositoryProvider]
  Hook --> Context
```

Это направления зависимостей исходного кода. При выполнении сценарий вызывает внедрённую реализацию порта.

- `entities/registration/model` не импортирует React, TanStack Query, Zod, DTO или HTTP. Модель регистрации использует `participant.displayName`/`registeredAt`, а DTO — `user.name`/`createdAt`. Это разные представления, преобразование выполняет API-адаптер.
- Порт располагается в модели регистрации, поскольку нужен и сценарию записи, и чтению участников. Он не зависит от конкретной реализации. `AbortSignal` используется как стандартный тип отмены чтения; React/HTTP-код в ядро не передаётся.
- `features/join-event/model` получает репозиторий аргументом. Сценарий проверяет соответствие ответа запрошенному событию и аккаунту. Права, лимит и статус CONFIRMED назначает сервер, сценарий их не вычисляет.
- `createHttpRegistrationRepository(http)` реализует порт: вызывает прежние API-пути, проверяет временные DTO, преобразует их в модели и переводит `ApiError` в `RegistrationFailure`. Только 404 собственной регистрации означает `null`; ошибка чтения участников остаётся ошибкой. Abort сохраняется отменой.
- `useJoinEvent` связывает сценарий с React/TanStack: query, mutation, pending, cache invalidation и защита от позднего ответа предыдущей сессии. В переменных мутации фиксируются eventId/viewerId на момент нажатия. Query cache не входит в ядро.
- `JoinAction` отображает состояние и вызывает hook. HTTP DTO и конкретный HTTP-репозиторий он не импортирует.
- `app/providers.tsx` выбирает реализацию и внедряет её через React context. У context нет скрытого HTTP fallback; отсутствие provider — ошибка конфигурации. DI-контейнер и классы для каждого сценария не нужны.

MSW по-прежнему перехватывает настоящие fetch-запросы на сетевой границе. Отдельный production MockRepository не вводился. Для unit-тестов сценария и React-hook можно передать маленький in-memory test double без HTTP/MSW.

## Сборка страниц

`pages/event` объединяет API события, `JoinAction` и `Participants`. DTO события преобразуется в `EventParticipation` на API-границе сущности. `pages/catalog` связывает карточку события и оформление статуса регистрации через props: сущности event и registration не импортируют друг друга. Форма создания вынесена в `features/create-event`, а её страница отвечает за загрузку исходных данных и состояние входа.

URL, сетевые пути, CSRF/cookie transport, mock persistence и визуальные классы сохранены. Политики доступа/численности не перенесены из backend в клиент.

## Проверка границ

`npm run lint` включает локальное правило `eslint-rules/architecture.js`:

- запрещены зависимости вверх по слоям и импорты соседних slices;
- в `entities/*/model` и `features/*/model` разрешены только чистые model-модули; запрещены внешние framework imports, HTTP/DTO/UI и прямые browser storage/fetch globals;
- фича join-event не подключает HTTP напрямую;
- production-модули не импортируют mocks/tests; bootstrap `main.tsx` подключает MSW явно по режиму.

Правило проверяет относительные static imports, re-exports и dynamic imports; aliases в проекте не настроены. Негативные тесты запускают настоящий ESLint Linter. Проверка не является анализатором всей транзитивной семантики JS: корректность публичных API и глобальных побочных эффектов также требует code review.

## Границы перехода

OpenAPI пока отсутствует. Временные DTO остаются в `shared/api/provisional.ts`; runtime guards S3 — в `entities/registration/api/mappers.ts`. После появления контракта сначала генерируются типы, затем корректируются адаптеры и моки. Доменная модель не должна импортировать generated DTO.

Создание события, каталог и сессия ещё не имеют самостоятельных портов/use cases. Их транспорт и React orchestration остаются в существующих adapters/UI. Следующие переносы выполняются отдельными проверяемыми срезами, без переименования всего кода ради одинаковой структуры. Java-интеграция не подтверждена.

## Тема и интерфейс

`JoinAction` находится в `features/join-event/ui`, карта отображения статуса — в `entities/registration/ui/presentation.ts`. Цвета, размеры и радиусы централизованы в `src/shared/styles/index.css`; CSS custom properties — источник темы, Tailwind 4 подключён через `@import 'tailwindcss'`. Визуальные правила описаны в [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).
