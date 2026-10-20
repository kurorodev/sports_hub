package ru.sport;

import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(properties={"app.demo-enabled=false","spring.datasource.url=jdbc:h2:mem:sport_signup_disabled;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1"})
@AutoConfigureMockMvc @ActiveProfiles("test")
class DemoRegistrationDisabledTest extends ApiTestSupport {
    @Autowired JdbcTemplate jdbc;
    @Test void disabledDemoDoesNotCreateAnAccountOrASession() throws Exception {
        long count=jdbc.queryForObject("select count(*) from users",Long.class);
        var result=call(null,"POST","/demo/accounts",Map.of("nickname","new-user","displayName","Новый пользователь"),404);
        assertThat(json(result).path("code").asText()).isEqualTo("NOT_FOUND");
        assertThat(jdbc.queryForObject("select count(*) from users",Long.class)).isEqualTo(count);
        assertThat(result.getRequest().getSession(false)).isNull();
        call(null,"GET","/demo/accounts",null,404);
        call(null,"POST","/demo/session",Map.of("accountId","athlete-a"),404);
    }
}
