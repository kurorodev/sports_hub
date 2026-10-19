package ru.dvizh;

import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MvcResult;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;

@SpringBootTest(properties="spring.datasource.url=jdbc:h2:mem:dvizh_auth;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000")
@AutoConfigureMockMvc @ActiveProfiles("test")
class AuthAndMentionsTest extends ApiTestSupport {
    @Autowired JdbcTemplate jdbc;
    private String name(){return "u"+UUID.randomUUID().toString().replace("-","");}
    private Actor actor(MvcResult result) throws Exception {
        var body=json(result);return new Actor((MockHttpSession)result.getRequest().getSession(false),body.path("csrfToken").asText(),body.path("user").path("id").asText());
    }
    private Actor register(String name,String password) throws Exception {
        return actor(call(null,"POST","/auth/register",Map.of("nickname",name,"displayName","Новый участник","password",password),201));
    }
    @Test void passwordAccountHasSaltedHashCannotUseDemoAndCanRelogin() throws Exception {
        String nick=name(),password="  secret пароль  ";var a=register("@"+nick,password);var b=register(name(),password);
        String hash=jdbc.queryForObject("select password_hash from users where id=?",String.class,UUID.fromString(a.id()));
        assertThat(hash).startsWith("{pbkdf2}").doesNotContain(password);
        assertThat(hash).isNotEqualTo(jdbc.queryForObject("select password_hash from users where id=?",String.class,UUID.fromString(b.id())));
        assertThat(jdbc.queryForObject("select demo_account from users where id=?",String.class,UUID.fromString(a.id()))).isNull();
        assertThat(getJson(null,"/demo/accounts").toString()).doesNotContain(a.id(),nick);
        call(null,"POST","/demo/session",Map.of("accountId","signup-"+a.id()),404);
        assertThat(getJson(a,"/session").toString()).doesNotContain("password","pbkdf2");
        call(a,"DELETE","/auth/session",null,204);
        var restored=actor(call(null,"POST","/auth/login",Map.of("nickname","@"+nick.toUpperCase(Locale.ROOT),"password",password),200));
        assertThat(restored.id()).isEqualTo(a.id());
        call(restored,"PATCH","/me/profile",Map.of("bio","Защищённая запись"),200);
        assertThat(mvc.perform(patch(api("/me/profile")).session(restored.session()).contentType("application/json").content("{\"bio\":\"forged\"}")).andReturn().getResponse().getStatus()).isEqualTo(403);
    }
    @Test void invalidCredentialsKeepCurrentSessionAndDoNotRevealWhichFieldFailed() throws Exception {
        String nick=name();var a=register(nick,"valid-password");
        var wrong=json(call(a,"POST","/auth/login",Map.of("nickname",nick,"password","wrong-password"),401));
        var unknown=json(call(a,"POST","/auth/login",Map.of("nickname",name(),"password","wrong-password"),401));
        assertThat(wrong.path("message")).isEqualTo(unknown.path("message"));
        assertThat(getJson(a,"/session").path("user").path("id").asText()).isEqualTo(a.id());
        call(a,"POST","/auth/register",Map.of("nickname","@"+nick.toUpperCase(Locale.ROOT),"displayName","Захват","password","other-password"),409);
        assertThat(a.session().isInvalid()).isFalse();
    }
    @Test void rejectsMalformedFieldsAndDoesNotGrantPrivileges() throws Exception {
        for(Object password:List.of("short"," ".repeat(10),"x".repeat(129),123456789,true))
            call(null,"POST","/auth/register",Map.of("nickname",name(),"displayName","Имя","password",password),400);
        for(String nickname:List.of("@@abc","a b c","a.b","ab","@"+"x".repeat(41)))
            call(null,"POST","/auth/register",Map.of("nickname",nickname,"displayName","Имя","password","valid-password"),400);
        call(null,"POST","/auth/register",Map.of("nickname",name(),"displayName","Имя","password","valid-password","admin",true),400);
        var a=register(name(),"x".repeat(128));
        assertThat(getJson(a,"/session").path("systemRoles").toString()).isEqualTo("[\"USER\"]");
    }
    @Test void loginRotatesSessionAndNicknameChangeKeepsPassword() throws Exception {
        var previous=login("admin");String nick=name();var a=register(nick,"valid-password");
        var result=call(previous,"POST","/auth/login",Map.of("nickname",nick,"password","valid-password"),200);
        assertThat(previous.session().isInvalid()).isTrue();assertThat(actor(result).csrf()).isNotEqualTo(previous.csrf());
        String renamed=name();call(a,"PATCH","/me/profile",Map.of("nickname","@"+renamed),200);
        call(null,"POST","/auth/login",Map.of("nickname",nick,"password","valid-password"),401);
        assertThat(actor(call(null,"POST","/auth/login",Map.of("nickname",renamed,"password","valid-password"),200)).id()).isEqualTo(a.id());
    }
    @Test void mentionsAreServerResolvedPersistAfterRenameAndIgnoreEmailsAndUnknownUsers() throws Exception {
        String nick=name();var target=register(nick,"valid-password");var author=login("athlete-a");String event=createEvent(author,"OPEN",5);
        String text="🏃 Привет, @"+nick+"! Почта x@"+nick+" @unknown-handle.";
        var posted=json(call(author,"POST","/events/"+event+"/comments",Map.of("text",text),201));
        assertThat(posted.path("mentions").size()).isEqualTo(1);
        var mention=posted.path("mentions").get(0);assertThat(mention.path("userId").asText()).isEqualTo(target.id());
        assertThat(text.substring(mention.path("start").asInt(),mention.path("end").asInt())).isEqualTo("@"+nick);
        call(target,"PATCH","/me/profile",Map.of("nickname",name()),200);
        var read=getJson(null,"/events/"+event+"/comments").path("items").get(0);
        assertThat(read.path("mentions")).isEqualTo(posted.path("mentions"));
        var admin=login("admin");call(admin,"POST","/admin/comments/"+posted.path("id").asText()+"/hide",Map.of("reason","Проверка скрытия"),200);
        assertThat(getJson(null,"/events/"+event+"/comments").path("items").isEmpty()).isTrue();
    }
    @Test void directMessagesCarryMentionsWithoutGrantingChatAccess() throws Exception {
        String nick=name();var target=register(nick,"valid-password");var author=login("athlete-a");var outsider=login("athlete-c");
        String id=json(call(author,"POST","/conversations",Map.of("type","DIRECT","peerUserId",target.id()),201)).path("id").asText();
        var message=json(call(author,"POST","/conversations/"+id+"/messages",Map.of("text","Привет @"+nick),201));
        assertThat(message.path("mentions").get(0).path("userId").asText()).isEqualTo(target.id());
        assertThat(getJson(target,"/conversations/"+id+"/messages").path("items").get(0).path("mentions")).isEqualTo(message.path("mentions"));
        call(outsider,"GET","/conversations/"+id+"/messages",null,403);
        var suggestions=getJson(null,"/users?nicknamePrefix=@"+nick.substring(0,12));
        assertThat(suggestions.toString()).contains(target.id()).doesNotContain("password","demoAccount");
        call(null,"GET","/users?nicknamePrefix=%",null,400);
    }
}
