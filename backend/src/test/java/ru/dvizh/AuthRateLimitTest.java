package ru.dvizh;

import org.junit.jupiter.api.Test;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.mock.web.*;
import ru.dvizh.config.AuthRateLimitFilter;
import static org.assertj.core.api.Assertions.*;

class AuthRateLimitTest {
    @Test void hashingAttemptsAreBoundedPerPeerAndBusinessRequestsRemainAvailable() throws Exception {
        var filter=new AuthRateLimitFilter(new ObjectMapper());
        for(int i=0;i<61;i++) {
            var req=new MockHttpServletRequest("POST","/api/v1/auth/login");req.setRemoteAddr("10.0.0.1");
            var res=new MockHttpServletResponse();filter.doFilter(req,res,new MockFilterChain());
            assertThat(res.getStatus()).isEqualTo(i<60?200:429);
            if(i==60)assertThat(res.getHeader("Retry-After")).isEqualTo("60");
        }
        var business=new MockHttpServletResponse();filter.doFilter(new MockHttpServletRequest("POST","/api/v1/events"),business,new MockFilterChain());
        assertThat(business.getStatus()).isEqualTo(200);
    }
}
