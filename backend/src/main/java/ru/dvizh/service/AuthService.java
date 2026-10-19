package ru.dvizh.service;

import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.crypto.password.*;
import ru.dvizh.api.*;
import ru.dvizh.domain.UserEntity;
import ru.dvizh.persistence.Store;

@Service @Transactional(readOnly=true)
public class AuthService {
    private final Store db;
    private final PasswordEncoder encoder=new DelegatingPasswordEncoder("pbkdf2",Map.of("pbkdf2",Pbkdf2PasswordEncoder.defaultsForSpringSecurity_v5_8()));
    private final String dummy=encoder.encode(UUID.randomUUID().toString());
    public AuthService(Store db){this.db=db;}
    @Transactional public UUID register(Api.AuthRegistrationRequest request) {
        String normalized=request.nickname().toLowerCase(Locale.ROOT);
        if(db.count(UserEntity.class,"e.normalizedNickname=:name",Map.of("name",normalized))>0)
            throw Problem.conflict(Api.ErrorCode.CONFLICT,"Никнейм уже занят");
        var user=new UserEntity();user.nickname=request.nickname();user.normalizedNickname=normalized;user.displayName=request.displayName();
        user.passwordHash=encoder.encode(request.password());
        // Password accounts never receive a demoAccount: demo login cannot bypass the password.
        db.add(user);db.flush();return user.id;
    }
    public UUID login(Api.AuthLoginRequest request) {
        var user=db.first(UserEntity.class,"e.normalizedNickname=:name",Map.of("name",request.nickname().toLowerCase(Locale.ROOT))).orElse(null);
        String hash=user==null||user.passwordHash==null?dummy:user.passwordHash;
        boolean matches=encoder.matches(request.password(),hash);
        if(!matches||user==null||user.passwordHash==null)
            throw new Problem(401,Api.ErrorCode.UNAUTHENTICATED,"Неверный никнейм или пароль");
        return user.id;
    }
}
