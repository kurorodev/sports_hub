package ru.dvizh.config;

import java.io.IOException;
import java.util.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.*;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.*;
import org.springframework.web.cors.*;
import ru.dvizh.api.Api;

@Configuration
public class SecurityConfig {
    @Bean HttpSessionSecurityContextRepository securityContextRepository() {
        return new HttpSessionSecurityContextRepository();
    }
    @Bean HttpSessionCsrfTokenRepository csrfRepository() {
        var repository = new HttpSessionCsrfTokenRepository();
        repository.setHeaderName("X-CSRF-Token");
        return repository;
    }
    @Bean SecurityFilterChain security(HttpSecurity http, HttpSessionCsrfTokenRepository repository,
        HttpSessionSecurityContextRepository contexts, ObjectMapper mapper) throws Exception {
        http.cors(c -> {}).csrf(c -> c.csrfTokenRepository(repository)
            .csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler())
            .ignoringRequestMatchers(request -> "POST".equals(request.getMethod()) && (request.getContextPath()+"/api/v1/demo/session").equals(request.getRequestURI())))
            .sessionManagement(c -> c.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
            .securityContext(c -> c.securityContextRepository(contexts).requireExplicitSave(true))
            .requestCache(c -> c.disable()).httpBasic(c -> c.disable()).formLogin(c -> c.disable()).logout(c -> c.disable())
            .authorizeHttpRequests(c -> c
                .requestMatchers("/error", "/openapi.yaml", "/actuator/health", "/actuator/health/**").permitAll()
                .requestMatchers(org.springframework.http.HttpMethod.OPTIONS,"/**").permitAll()
                .requestMatchers(org.springframework.http.HttpMethod.POST,"/api/v1/demo/session").permitAll()
                .requestMatchers(org.springframework.http.HttpMethod.GET,
                    "/api/v1/health", "/api/v1/demo/accounts", "/api/v1/sports", "/api/v1/users/**", "/api/v1/map/**", "/api/v1/geo/**",
                    "/api/v1/events", "/api/v1/events/*", "/api/v1/events/*/participants", "/api/v1/events/*/comments", "/api/v1/events/*/team",
                    "/api/v1/organizations", "/api/v1/organizations/*", "/api/v1/organizations/*/events").permitAll()
                .anyRequest().authenticated())
            .exceptionHandling(c -> c
                .authenticationEntryPoint((req,res,e) -> error(mapper,res,401,Api.ErrorCode.UNAUTHENTICATED,"Войдите в аккаунт"))
                .accessDeniedHandler((req,res,e) -> error(mapper,res,403,Api.ErrorCode.FORBIDDEN,"Нет доступа или неверный CSRF токен")));
        return http.build();
    }
    @Bean CorsConfigurationSource corsConfigurationSource(@Value("${app.cors-origins}") String origins) {
        var c = new CorsConfiguration();
        c.setAllowedOrigins(Arrays.stream(origins.split(",")).map(String::trim).toList());
        c.setAllowedMethods(List.of("GET","POST","PATCH","DELETE","OPTIONS"));
        c.setAllowedHeaders(List.of("Content-Type","X-CSRF-Token"));
        c.setExposedHeaders(List.of("X-Request-Id")); c.setAllowCredentials(true); c.setMaxAge(3600L);
        var source = new UrlBasedCorsConfigurationSource(); source.registerCorsConfiguration("/**",c); return source;
    }
    private static void error(ObjectMapper mapper,HttpServletResponse response,int status,Api.ErrorCode code,String message) throws IOException {
        response.setStatus(status); response.setContentType("application/json;charset=UTF-8");
        String id = Optional.ofNullable(response.getHeader("X-Request-Id")).orElseGet(() -> UUID.randomUUID().toString());
        mapper.writeValue(response.getOutputStream(),new Api.ApiError(code,message,List.of(),id));
    }
}
