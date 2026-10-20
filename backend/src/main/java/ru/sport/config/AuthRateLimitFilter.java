package ru.sport.config;

import java.io.IOException;
import java.util.*;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import com.fasterxml.jackson.databind.ObjectMapper;
import ru.sport.api.Api;

/** Ограничиваем дорогое хеширование паролей по адресу соединения; заголовки клиента не задают IP для лимита. */
@Component
public class AuthRateLimitFilter extends OncePerRequestFilter {
    private final Map<String,long[]> windows=new LinkedHashMap<>();
    private final ObjectMapper mapper;
    public AuthRateLimitFilter(ObjectMapper mapper){this.mapper=mapper;}
    private synchronized boolean allowed(String address,long now) {
        windows.entrySet().removeIf(e -> now-e.getValue()[0]>=60_000);
        var bucket=windows.get(address);
        if(bucket==null){if(windows.size()>=10_000)return false;bucket=new long[]{now,0};windows.put(address,bucket);}
        return ++bucket[1]<=60;
    }
    @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain) throws ServletException,IOException {
        String path=request.getRequestURI().substring(request.getContextPath().length());
        if("POST".equals(request.getMethod())&&Set.of("/api/v1/auth/register","/api/v1/auth/login").contains(path)
            &&!allowed(request.getRemoteAddr(),System.currentTimeMillis())) {
            response.setStatus(429);response.setHeader("Retry-After","60");response.setContentType("application/json;charset=UTF-8");
            mapper.writeValue(response.getOutputStream(),new Api.ApiError(Api.ErrorCode.RATE_LIMITED,"Слишком много попыток. Подождите минуту",List.of(),UUID.randomUUID().toString()));return;
        }
        chain.doFilter(request,response);
    }
}
