package ru.dvizh;

import org.springframework.test.context.TestPropertySource;

/** Separate database: concurrent scenarios commit their fixture changes. */
@TestPropertySource(properties="spring.datasource.url=jdbc:h2:mem:dvizh_concurrency;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000")
class H2ConcurrencyTest extends ConcurrentApiScenarios {}
