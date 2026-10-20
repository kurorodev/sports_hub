package ru.sport;

import org.springframework.test.context.TestPropertySource;

/** Отдельная БД: конкурентные сценарии фиксируют изменения и не откатывают общие тестовые данные. */
@TestPropertySource(properties="spring.datasource.url=jdbc:h2:mem:sport_concurrency;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000")
class H2ConcurrencyTest extends ConcurrentApiScenarios {}
