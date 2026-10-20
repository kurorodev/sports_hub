package ru.sport.api;

import jakarta.servlet.http.*;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import ru.sport.service.AuthService;

@RestController @RequestMapping("/api/v1")
public class AuthController {
    private final AuthService auth;private final SessionController sessions;
    public AuthController(AuthService auth,SessionController sessions){this.auth=auth;this.sessions=sessions;}
    @PostMapping("/auth/register") @ResponseStatus(HttpStatus.CREATED)
    public Api.Session register(@Valid @RequestBody Api.AuthRegistrationRequest body,HttpServletRequest request,HttpServletResponse response) {
        return sessions.establishSession(auth.register(body),request,response);
    }
    @PostMapping("/auth/login")
    public Api.Session login(@Valid @RequestBody Api.AuthLoginRequest body,HttpServletRequest request,HttpServletResponse response) {
        return sessions.establishSession(auth.login(body),request,response);
    }
}
