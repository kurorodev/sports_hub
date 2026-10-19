package ru.dvizh;

import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(properties={"app.demo-enabled=false","spring.datasource.url=jdbc:h2:mem:dvizh_password_only;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1"})
@AutoConfigureMockMvc @ActiveProfiles("test")
class PasswordAuthWithoutDemoTest extends ApiTestSupport {
    @Test void passwordRegistrationAndLoginWorkWithDemoDisabled() throws Exception {
        String nick="user"+UUID.randomUUID().toString().replace("-","");
        var created=json(call(null,"POST","/auth/register",Map.of("nickname",nick,"displayName","Участник","password","valid-password"),201));
        assertThat(created.path("demo").asBoolean()).isFalse();
        call(null,"GET","/demo/accounts",null,404);
        assertThat(json(call(null,"POST","/auth/login",Map.of("nickname","@"+nick,"password","valid-password"),200)).path("user").path("id")).isEqualTo(created.path("user").path("id"));
    }
}
