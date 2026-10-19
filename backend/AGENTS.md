# Backend «ДВИЖ»
Java 21, Spring Boot 3, Maven, PostgreSQL, JPA, Flyway. Применяется docs/TEAM_GUIDE.md. Пути в нём отсчитываются от backend/, если не указано иное.
Контракт contracts/openapi.yaml сохранять совместимым. DTO не являются JPA entity.
Любое изменение регистрации, очереди, верификации и модерации блокирует строку события
PESSIMISTIC_WRITE в одной транзакции. Для direct-чата сначала блокировать обоих пользователей
в стабильном порядке UUID. Членство сообщества проверять на каждый запрос, включая ADMIN.
Проверки: `mvn verify`; с Docker: `mvn -Ppostgres-it verify`.
