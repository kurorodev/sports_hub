package ru.dvizh.api;

import java.util.*;
import jakarta.servlet.http.*;
import jakarta.validation.Valid;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.*;
import org.springframework.web.bind.annotation.*;
import ru.dvizh.service.*;

@RestController @RequestMapping("/api/v1")
public class SessionController {
    private final SessionService sessions;private final Access access;private final HttpSessionCsrfTokenRepository csrf;private final javax.sql.DataSource datasource;
    private final HttpSessionSecurityContextRepository contexts;
    public SessionController(SessionService sessions,Access access,HttpSessionCsrfTokenRepository csrf,javax.sql.DataSource datasource,
        HttpSessionSecurityContextRepository contexts){this.sessions=sessions;this.access=access;this.csrf=csrf;this.datasource=datasource;this.contexts=contexts;}
    @GetMapping("/health") public Api.Health health() throws java.sql.SQLException {
        try(var connection=datasource.getConnection()) {
            if(!connection.isValid(2))throw new Problem(500,Api.ErrorCode.INTERNAL_ERROR,"База данных недоступна");
        }
        return new Api.Health("UP","dvizh-backend","1.0.0");
    }
    @GetMapping("/demo/accounts") public List<Api.DemoAccount> accounts(){return sessions.accounts();}
    @PostMapping("/demo/accounts") @ResponseStatus(org.springframework.http.HttpStatus.CREATED)
    public Api.Session register(@Valid @RequestBody Api.DemoRegistrationRequest body,HttpServletRequest request,HttpServletResponse response) {
        return establishSession(sessions.register(body),request,response);
    }
    @PostMapping("/demo/session") public Api.Session login(@Valid @RequestBody Api.DemoLoginRequest body,HttpServletRequest request,HttpServletResponse response) {
        return establishSession(sessions.login(body.accountId()),request,response);
    }
    private Api.Session establishSession(UUID id,HttpServletRequest request,HttpServletResponse response) {
        var old=request.getSession(false);if(old!=null)old.invalidate();
        var context=SecurityContextHolder.createEmptyContext();
        context.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(id,null,List.of()));
        SecurityContextHolder.setContext(context);
        // Persist authentication at login, before issuing CSRF, so subsequent requests
        // do not look like a new authentication and invalidate the returned token.
        contexts.saveContext(context,request,response);
        var token=csrf.generateToken(request);csrf.saveToken(token,request,response);
        return sessions.session(id,token.getToken());
    }
    @GetMapping("/session") public Api.Session session(HttpServletRequest req,HttpServletResponse res) {
        UUID id=access.viewerId();if(id==null)throw new Problem(401,Api.ErrorCode.UNAUTHENTICATED,"Войдите в аккаунт");
        return sessions.session(id,csrf.loadDeferredToken(req,res).get().getToken());
    }
    @DeleteMapping("/demo/session") @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void logout(HttpServletRequest request){var session=request.getSession(false);if(session!=null)session.invalidate();SecurityContextHolder.clearContext();}
}
