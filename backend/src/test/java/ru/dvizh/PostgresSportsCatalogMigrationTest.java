package ru.dvizh;

import javax.sql.DataSource;
import org.junit.jupiter.api.Tag;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;

@Tag("postgres") @Testcontainers
class PostgresSportsCatalogMigrationTest extends SportsCatalogMigrationTest {
    @Container static final PostgreSQLContainer<?> postgres=new PostgreSQLContainer<>("postgres:17.6-alpine");
    @Override protected DataSource database() {
        return new DriverManagerDataSource(postgres.getJdbcUrl(),postgres.getUsername(),postgres.getPassword());
    }
}
