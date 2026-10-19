package ru.dvizh;

import org.junit.jupiter.api.Tag;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;

@Tag("postgres") @Testcontainers
class PostgresConcurrencyTest extends ConcurrentApiScenarios {
    @Container static final PostgreSQLContainer<?> postgres=new PostgreSQLContainer<>("postgres:17.6-alpine");
    @DynamicPropertySource static void database(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url",postgres::getJdbcUrl);
        r.add("spring.datasource.username",postgres::getUsername);
        r.add("spring.datasource.password",postgres::getPassword);
        r.add("spring.datasource.driver-class-name",()->"org.postgresql.Driver");
    }
}
