# Архитектура frontend

Статус: постепенный переход к Clean Architecture с принципами Feature-Sliced Design. Сценарии S3 OPEN, S4 APPROVAL, публикация комментария S5, создание/решение заявки S2 и модерация S6 уже разделены на чистое ядро, адаптеры и React. Остальные экраны приведены к слоям FSD, но создание события и сессия пока используют прежний query/service-подход. Весь проект ещё не считается полностью переведённым на Clean Architecture.

## Структура и направление зависимостей

```text
src/
  app/                          router, layout, composition root/providers
  pages/                        сборка каталога, события, создания, входа и кабинетов
  features/
    join-event/model/           независимые сценарии joinEvent/findMyRegistration
    join-event/ui/              JoinAction, useJoinEvent, TanStack query options
    review-registrations/model/  проверка ответа решения организатора
    review-registrations/ui/     список, фильтры, пагинация, форма отказа и mutation
    event-discussion/model/     независимый publishComment и проверка публикации
    event-discussion/ui/        список, пагинация, polling, форма и mutation
    create-event/ui/            существующая форма и её Zod-схема
    edit-profile/model/         независимый updateProfile с проверкой ответа
    edit-profile/ui/            форма и orchestration редактирования
  entities/
    event/                      API/query, карточка, форматирование, EventParticipation
    registration/model/         Registration, ParticipantPage, repository port, failures
    registration/api/           HTTP-репозиторий, DTO mappers, read query options
    registration/lib/           React context для внедрения репозитория
    registration/ui/            участники и отображение статусов/ошибок
    comment/model/              DiscussionComment, CommentPage, repository port, failures
    comment/api/                HTTP-адаптер, runtime DTO guards, query options
    comment/lib/                context для внедрения репозитория
    comment/ui/                 сообщение, автор/время, отображение ошибок
    profile/                    модель/порт, HTTP guards, DI context, ProfileSummary
    session/                    session/demo services, общий переход после входа/регистрации
  shared/                       транспорт, generated DTO, общие UI и токены
  mocks/                        MSW и локальная эмуляция backend
  tests/                        проверки ядра, адаптеров, UI и границ
```

`pages/profile` собирает собственный и публичный профиль через внедрённый `ProfileRepository`. Редактирование проходит через `features/edit-profile/model/update-profile`; DTO преобразуются в HTTP-адаптере профиля. Публичные профили читаются без сессии, приватные запросы ждут её восстановления. Рейтинг отображается из ответа API, не вычисляется клиентом.

`pages/register` и `pages/login` используют общий `entities/session/lib/use-session-transition`: отмена запросов, очистка приватного кэша, установка Session/CSRF и переход. `shared/lib/session-return` разрешает только известные внутренние назначения и безопасный контекст карты. Bootstrap POST регистрации и входа не передают старый CSRF; остальные мутации сохраняют существующую защиту. Сессия остаётся в прежнем query/service-подходе.

Допустимое направление слоёв: `app → pages → features → entities → shared`. Промежуточные слои можно пропускать. Модуль одного слоя не импортирует другой модуль того же слоя; несколько модулей собираются выше. `widgets/` пока не требуется и не создаётся.

Обычные потребители используют публичные `index.ts` модулей. У моделей есть отдельный чистый entry point `entities/*/model/index.ts`, чтобы сценарий не импортировал React через общий barrel. Composition root явно импортирует конкретный HTTP-адаптер. Сам HTTP-адаптер не экспортируется через UI entry point регистрации или комментариев.

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

- `entities/registration/model` не импортирует React, TanStack Query, Zod, DTO или HTTP. Модель регистрации использует `participant.displayName`/`registeredAt`, а DTO — `user.displayName`/`createdAt`. Это разные представления, преобразование выполняет API-адаптер.
- Порт располагается в модели регистрации, поскольку нужен и сценарию записи, и чтению участников. Он не зависит от конкретной реализации. `AbortSignal` используется как стандартный тип отмены чтения; React/HTTP-код в ядро не передаётся.
- `features/join-event/model` получает репозиторий аргументом. Сценарий проверяет соответствие ответа запрошенному событию и аккаунту. Права, лимит и статус CONFIRMED назначает сервер, сценарий их не вычисляет.
- `createHttpRegistrationRepository(http)` реализует порт: вызывает прежние API-пути, проверяет generated DTO, преобразует их в модели и переводит `ApiError` в `RegistrationFailure`. Только 404 собственной регистрации означает `null`; ошибка чтения участников остаётся ошибкой. Abort сохраняется отменой.
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

Контракт находится в `backend/contracts/openapi.yaml` (версия `1.0.0-draft`). `npm run api:generate` создаёт `shared/api/generated/schema.d.ts`, `shared/api/types.ts` экспортирует aliases на generated DTO. `npm run api:check` обнаруживает устаревшую генерацию. Файлы provisional удалены. Runtime guards S3 находятся в `entities/registration/api/mappers.ts`, UI-валидация создания — в `shared/api/event-schema.ts`. Доменная модель регистрации не импортирует generated DTO.

Создание события, каталог и сессия ещё не имеют самостоятельных портов/use cases. Их транспорт и React orchestration остаются в существующих adapters/UI. Следующие переносы выполняются отдельными проверяемыми срезами, без переименования всего кода ради одинаковой структуры. Сессия, каталог, создание и OPEN-запись подключены к Java; браузерные проверки выполняются отдельной конфигурацией `playwright.api.config.ts` с заблокированными service workers.

## Тема и интерфейс

`JoinAction` находится в `features/join-event/ui`, карта отображения статуса — в `entities/registration/ui/presentation.ts`. Цвета, размеры и радиусы централизованы в `src/shared/styles/index.css`; CSS custom properties — источник темы, Tailwind 4 подключён через `@import 'tailwindcss'`. Визуальные правила описаны в [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).

## Подключение Java

В mock и real используется один HTTP-адаптер. `npm run dev`/`dev:real` выбирает Java, `dev:mock` явно включает MSW; автоматического fallback нет. Точные wire-типы берутся из OpenAPI, а модель регистрации и use cases сохраняют независимость от транспорта.

Каталог использует `EventCard`, детальная страница — `Event`. Query детальной страницы дополнительно читает `/events/{id}/team`: доступность действия приходит из `TeamStatus.joinAvailable/waitlistAvailable`, а права организатора — из `Event.viewerIsOrganizer`. Это уже реализованный серверный P1 endpoint, используемый как зависимость P0-записи. Новый API или клиентское назначение прав не вводились.

Создание отправляет `sport: {sportId}|{customName}`, `maxParticipants`, `organizer: {type:USER,id}` и `publishNow`; Java проверяет, что указанный автор совпадает с сессией. UI не предлагает запись самому организатору; это интерфейсное решение, а не утверждение о серверном запрете. Участники приходят как `PublicUser[]`, ошибки полей — `ApiError.details[]`.

Модель регистрации поддерживает все пять статусов контракта для чтения уже существующих данных. APPROVAL-подача и решения подключены. Отмена и очередь пока не подключены в UI. Их наличие в enum не означает готовый пользовательский сценарий.

## S4: рассмотрение заявок

`pages/event` собирает `JoinAction`, `RegistrationRequests` и `Participants`. Фичи join-event и review-registrations не импортируют друг друга. Они используют общий RegistrationRepository из сущности регистрации. Runtime schema адаптера преобразует Registration DTO и PagedRegistrations в самостоятельные Registration/RegistrationPage, включая message и decisionReason. В wire-адаптере outcome accept/decline преобразуется в контрактный APPROVE/REJECT.

`reviewRegistration` не назначает права или места: он вызывает сервер и отклоняет ответ с чужими eventId/registrationId/participantId либо неправильным итоговым статусом. `useReviewRegistration` фиксирует viewerId и проверяет текущую сессию до объявления успеха и invalidation. Список приватных заявок имеет viewerId в query key.

`RequestRow` отвечает за отображение заявки и доступную с клавиатуры RHF/Zod-форму отказа; `RegistrationRequests` — за query, фильтр, пагинацию и сообщение о сохранении. Метки статусов для организатора и участника находятся в одной карте сущности. PENDING не входит в PublicUser-список участников. HTTP polling обновляет статус у заявителя без перезагрузки и обновляет публичные участники/численность после решения. Отдельная реализация для MSW не внедряется в production-код.

## S5: обсуждение встречи

`pages/event` собирает EventDiscussion и передаёт идентификатор личного организатора через props. Сущности comment и event не импортируют друг друга. `DiscussionComment` и `CommentPage` — собственные модели, не дубликаты wire DTO: author содержит только id/displayName, publishedAt преобразован из createdAt, visibility — из status. Текст скрытого сообщения удаляется уже в адаптере.

`CommentRepository` имеет list/publish. HTTP-реализация выбирается в `app/providers.tsx` и внедряется через DiscussionServices; без provider нет скрытого fallback. Runtime Zod guards сверены с generated Comment/PagedComments. Ошибки HTTP преобразуются в CommentFailure, Abort сохраняется отменой. Чистый publishComment проверяет длину текста и соответствие ответа событию/автору/тексту/видимости; сервер остаётся источником прав и статуса.

EventDiscussion управляет серверной пагинацией, polling и invalidation; PublishCommentForm связывает RHF/Zod с use case и блокировкой повторной отправки. ViewerId включён в query key, поскольку администратор может получать скрытые сообщения. Поздний ответ предыдущего аккаунта не очищает ввод и не объявляет успех в новой сессии. MSW перехватывает тот же транспорт и хранит данные в `dvizh.mock.comments.v1`; отдельный production mock repository не добавлен. ESLint запрещает импорт конкретного адаптера из feature; негативный тест проверяет эту границу.

## S2: организация и право публикации

`entities/organization/model` содержит независимые Organization / OrganizationApplication / OrganizationDecision и OrganizationRepository. В модели используется representative/submittedAt, DTO — createdBy/createdAt; адаптер проверяет generated типы через runtime Zod guards и преобразует поля/ошибки. Конкретный HTTP-адаптер внедряется OrganizationServices в app; он не экспортируется через публичный UI barrel, архитектурный lint запрещает его импорт из feature.

`features/organization-application` объединяет чистый applyOrganization, RHF/Zod-форму и собственные заявки. `features/review-organizations` — чистый reviewOrganization, фильтры/пагинацию административного списка и форму обязательного отказа. Use cases проверяют поля и соответствие серверного результата запросу; решения, права и статусы устанавливает Java. Guard viewerId не даёт поздней мутации объявить успех в другом аккаунте. MyOrganizations сверяет полученный допуск с Session и при расхождении перечитывает сессию, а не создаёт роль на клиенте.

`pages/workspace` проверяет вход/ADMIN и собирает соответствующие features. `pages/organizations` собирает публичные данные организации и EventCard; сущности organization/event не импортируют друг друга. Запрос мероприятий организации находится в API event, DTO остаётся PagedEvents. `pages/create-event` загружает доступные организации и передаёт форму; feature создания преобразует явный выбор в контрактный OrganizerRef. Подмена organizationId не даёт обхода Java-проверки.

MSW использует те же endpoints и отдельное хранилище `dvizh.mock.organizations.v1`. В mock Session допуск также вычисляется по сохранённым APPROVED-заявкам, а события хранят настоящий organizationId отдельно от id представителя. Публичные/личные/admin query keys включают viewerId для изоляции данных. Страница организации ждёт восстановления Session перед чтением: ответы для автора/ADMIN не сохраняются под гостевым ключом при старте приложения. Старые личные события v2 остаются совместимы.

## S6: модерация контента

`entities/moderation/model` — независимые административные проекции ModerationEvent/ModerationComment и порт ModerationRepository. HTTP-адаптер проверяет generated Event, Comment, PagedEventDetails и PagedComments runtime-схемами; поля DTO преобразуются в модели, даты мероприятия нормализуются в UTC, ApiError переводится в ModerationFailure, Abort остаётся отменой. В административной проекции HIDDEN-текст сохраняется для модератора; публичная сущность comment его редактирует на границе до показа.

`features/moderate-content/model/moderate-content` не импортирует React, HTTP или DTO. Сценарий проверяет причину, id, статус и соответствие ответа цели. React-hook фиксирует viewerId, проверяет текущую сессию перед успехом и делает invalidation после ответа Java. ModerationServices выбирает реализацию только в app; lint и негативный тест запрещают подключать конкретный адаптер из feature.

WorkspacePage сохраняет ADMIN-guard и собирает три раздела по URL section: организации, мероприятия и комментарии. Раздел комментариев принимает eventId/page в URL, без неподтверждённого серверного full-text поиска. Общая ModerationReasonForm реализует RHF/Zod, обязательную причину, подтверждение, pending, retry и фокус после отмены. Карточки показывают серверные статусы, организатора и переход в обсуждение.

EventPage ждёт восстановления Session, использует viewerId в query key и перечитывает Event + TeamStatus каждые 10 секунд в активной вкладке. Над сеткой отображается статус снятия; личная причина доступна организатору только в колокольчике. Флаг publicationClosed в JoinAction меняет пояснение к сохранённой регистрации; права по-прежнему приходят с сервера. Временный сбой фонового запроса оставляет текст обсуждения, а 401/403/404 прекращает показ приватных данных.

MSW хранит аудит/причины в `dvizh.mock.moderation.v1`; getEvents применяет серверное UNPUBLISHED к исходным данным без изменения регистраций. Скрытие меняет только выбранный Comment. GET деталей/состава проверяет видимость, POST регистрации — доступность даже при прямом запросе. Реализация mock остаётся эмуляцией без транзакций между вкладками.

## Навигация каталога и карты

Общие ссылки режимов и проверка адреса возврата — `shared/lib/activity-navigation.ts`, представление переключателя — `shared/ui/ActivityViewSwitch`. Фильтры, область и выбор объекта принадлежат URL; `pages/map/ui/use-map-params` объединяет отложенные изменения области с текущими параметрами и синхронно обновляет управляемые поля через router. Число участников, публикация и загруженность остаются серверным состоянием TanStack Query. `entities/event/ui/EventLocation` показывает адрес и по запросу лениво загружает общий GeoMap; страница события собирает его с регистрациями и обсуждением. Новых API-контрактов или менеджера глобального состояния нет.

С 20.10.2026 справочник спорта закрыт: `GET /sports` возвращает официальный снимок ВРВС + «Другое». `sport.customName` — текст активности категории «Другое», не новая категория. Нормализация старых данных выполняется серверной миграцией; UI получает канонические DTO. Мок-снимок генерируется из backend-ресурса (`sports:generate` / `sports:check`).

## Пароли и упоминания

`features/password-login` связывает форму с session services. Вход/регистрация используют существующий общий переход Session/CSRF; выход очищает запросы и кэш только после успешного 204. `shared/ui/MentionInput` получает text/onChange от RHF Controller, отменяет устаревшие запросы подсказок через AbortSignal и сохраняет курсор после вставки. `shared/ui/MentionText` отображает только корректные неперекрывающиеся диапазоны как внутренние ссылки. Модель комментария содержит независимые поля mentions, HTTP-адаптер проверяет wire-формат и очищает скрытые данные. Пароли проверяет только Java; `mocks/passwords.ts` используется исключительно явным MSW-режимом.

При смене/завершении сессии `replaceSession` отменяет запросы, удаляет остальные query и mutation cache, обновляет CSRF и перезаписывает наблюдаемый session query. Сам query сессии сохраняется, чтобы шапка и защищённые страницы получили новую идентичность.

## Личные уведомления

`entities/notification/model` содержит чистую модель и интерфейс repository; HTTP-адаптер проверяет DTO и безопасные внутренние ссылки. Конкретный repository выбирается в app/providers. `features/notifications` собирает TanStack Query, мутации прочтения и доступный нативный Dialog; Layout передаёт viewerId и перемонтирует колокольчик при смене пользователя. Кэш разделён по viewerId и очищается общим session transition; позднее завершение чтения не навигирует другой аккаунт. UI показывает серверный счётчик и статусы, причина живёт только внутри окна. MSW изолирован в mocks/notifications и использует те же сетевые операции.
