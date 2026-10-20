package ru.sport;

import java.util.*;
import java.util.concurrent.*;
import com.fasterxml.jackson.databind.JsonNode;
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

@SpringBootTest(properties="spring.datasource.url=jdbc:h2:mem:sport_signup;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000")
@AutoConfigureMockMvc @ActiveProfiles("test")
class DemoRegistrationTest extends ApiTestSupport {
    @Autowired JdbcTemplate jdbc;

    private String nickname(){return "new-"+UUID.randomUUID().toString().replace("-","");}
    private long users(){return jdbc.queryForObject("select count(*) from users",Long.class);}
    private Actor actor(MvcResult result) throws Exception {
        var body=json(result);
        return new Actor((MockHttpSession)result.getRequest().getSession(false),body.path("csrfToken").asText(),body.path("user").path("id").asText());
    }
    private MvcResult register(String nickname,String displayName) throws Exception {
        return call(null,"POST","/demo/accounts",Map.of("nickname",nickname,"displayName",displayName),201);
    }
    private String accountId(Actor actor,String label) {
        try {
            for(JsonNode account:getJson(actor,"/demo/accounts"))
                if(account.path("label").asText().equals(label))return account.path("id").asText();
        } catch(Exception e){throw new AssertionError(e);}
        throw new AssertionError("Registered account is absent from demo login choices");
    }

    @Test void guestGetsIndependentUserAndReusableSessionForBusinessOperations() throws Exception {
        var original=login("athlete-a");var before=getJson(original,"/me/profile");long count=users();
        String name=nickname();var result=register("  "+name+"  ","  Новый участник  ");
        var created=json(result);var fresh=actor(result);
        assertThat(users()).isEqualTo(count+1);
        assertThat(fresh.id()).isNotEqualTo(original.id());
        assertThat(created.path("user").path("nickname").asText()).isEqualTo(name);
        assertThat(created.path("user").path("displayName").asText()).isEqualTo("Новый участник");
        assertThat(created.path("systemRoles").toString()).isEqualTo("[\"USER\"]");
        assertThat(created.path("manageableOrganizationIds").isEmpty()).isTrue();
        assertThat(created.path("user").path("sportsRoles").isEmpty()).isTrue();
        assertThat(created.path("user").path("sportsPreferences").isEmpty()).isTrue();
        assertThat(created.path("user").path("ratingPoints").asInt()).isZero();
        assertThat(created.path("user").path("rank").asText()).isEqualTo("ROOKIE");
        assertThat(created.path("demo").asBoolean()).isTrue();assertThat(fresh.csrf()).isNotBlank();
        assertThat(getJson(null,"/users/"+fresh.id()).path("nickname").asText()).isEqualTo(name);
        assertThat(getJson(fresh,"/session").path("user").path("id").asText()).isEqualTo(fresh.id());
        call(fresh,"PATCH","/me/profile",Map.of("bio","Прихожу заниматься вместе"),200);
        String event=createEvent(fresh,"OPEN",3);
        call(original,"POST","/events/"+event+"/registrations",Map.of(),201);
        assertThat(getJson(fresh,"/events/"+event+"/participants").path("items").toString()).contains(original.id());
        assertThat(getJson(original,"/me/profile")).isEqualTo(before);
        assertThat(getJson(fresh,"/session").path("csrfToken").asText()).isEqualTo(fresh.csrf());
    }

    @Test void renamedUserCanLogOutAndReturnUsingStableDemoAccountId() throws Exception {
        String name=nickname();var fresh=actor(register(name,name));String account=accountId(fresh,name);
        String renamed=nickname();
        call(fresh,"PATCH","/me/profile",Map.of("nickname",renamed,"displayName",renamed),200);
        assertThat(accountId(fresh,renamed)).isEqualTo(account);
        call(fresh,"DELETE","/demo/session",null,204);
        var restored=login(account);
        assertThat(restored.id()).isEqualTo(fresh.id());
        assertThat(getJson(restored,"/me/profile").path("nickname").asText()).isEqualTo(renamed);
    }

    @Test void registrationRotatesOnlyTheCurrentBrowserSessionAndProtectsBusinessWrites() throws Exception {
        var previous=login("admin");var independent=login("athlete-b");
        String name=nickname();var result=call(previous,"POST","/demo/accounts",Map.of("nickname",name,"displayName",name),201);
        var fresh=actor(result);
        assertThat(previous.session().isInvalid()).isTrue();
        assertThat(fresh.session().getId()).isNotEqualTo(previous.session().getId());
        assertThat(fresh.csrf()).isNotEqualTo(previous.csrf());
        assertThat(getJson(independent,"/session").path("user").path("id").asText()).isEqualTo(independent.id());
        assertThat(mvc.perform(patch(api("/me/profile")).session(fresh.session()).contentType("application/json")
            .content("{\"bio\":\"Без CSRF\"}")).andReturn().getResponse().getStatus()).isEqualTo(403);
        assertThat(mvc.perform(patch(api("/me/profile")).session(fresh.session()).header("X-CSRF-Token",previous.csrf())
            .contentType("application/json").content("{\"bio\":\"Старый CSRF\"}")).andReturn().getResponse().getStatus()).isEqualTo(403);
        call(fresh,"PATCH","/me/profile",Map.of("bio","Новый CSRF работает"),200);
        call(fresh,"GET","/admin/organizations",null,403);
    }

    @Test void invalidBodiesDoNotCreateUsersOrReplaceAnExistingSession() throws Exception {
        var original=login("admin");long count=users();
        var invalid=List.of("{}","null","{\"nickname\":null,\"displayName\":\"Имя\"}",
            "{\"nickname\":\"abc\",\"displayName\":null}","{\"nickname\":12345,\"displayName\":\"Имя\"}",
            "{\"nickname\":\"abc\",\"displayName\":true}","{\"nickname\":[],\"displayName\":\"Имя\"}",
            mapper.writeValueAsString(Map.of("nickname","  ab  ","displayName","Имя")),
            mapper.writeValueAsString(Map.of("nickname"," \t\n ","displayName","Имя")),
            mapper.writeValueAsString(Map.of("nickname",nickname(),"displayName"," \t\n ")),
            mapper.writeValueAsString(Map.of("nickname","a".repeat(41),"displayName","Имя")),
            mapper.writeValueAsString(Map.of("nickname",nickname(),"displayName","x".repeat(101))));
        for(String body:invalid)
            assertThat(json(call(original,"POST","/demo/accounts",body,400)).path("code").asText()).isEqualTo("VALIDATION_ERROR");
        for(String field:List.of("admin","systemRoles","id","ratingPoints","demoAccount","sportsRoles")) {
            var body=new HashMap<String,Object>(Map.of("nickname",nickname(),"displayName","Имя"));body.put(field,"forged");
            call(original,"POST","/demo/accounts",body,400);
        }
        assertThat(users()).isEqualTo(count);assertThat(original.session().isInvalid()).isFalse();
        assertThat(getJson(original,"/session").path("user").path("id").asText()).isEqualTo(original.id());
    }

    @Test void trimmedBoundaryLengthsAreAccepted() throws Exception {
        String name="edge"+UUID.randomUUID().toString();assertThat(name).hasSize(40);
        var result=json(register("  "+name+"  ","  "+"Я".repeat(100)+"  "));
        assertThat(result.path("user").path("nickname").asText()).isEqualTo(name);
        assertThat(result.path("user").path("displayName").asText()).hasSize(100);
    }

    @Test void duplicateAndCaseVariantDoNotSwitchToOrModifyTheExistingUser() throws Exception {
        String name=nickname();var existing=actor(register(name,name));long count=users();var before=getJson(existing,"/me/profile");
        var previous=login("admin");
        for(String duplicate:List.of(name,name.toUpperCase(Locale.ROOT),"  "+name+"  "))
            assertThat(json(call(previous,"POST","/demo/accounts",Map.of("nickname",duplicate,"displayName","Другой"),409)).path("code").asText()).isEqualTo("CONFLICT");
        assertThat(users()).isEqualTo(count);assertThat(previous.session().isInvalid()).isFalse();
        assertThat(getJson(previous,"/session").path("user").path("id").asText()).isEqualTo(previous.id());
        assertThat(getJson(existing,"/me/profile")).isEqualTo(before);
    }

    @Test void accountsBeyondTheOldHundredItemLimitRemainAvailableForRelogin() throws Exception {
        for(int i=0;i<101;i++) {
            String id=UUID.randomUUID().toString(),name="f-"+id;
            jdbc.update("insert into users(id,created_at,updated_at,nickname,normalized_nickname,display_name,admin,demo_account) values(?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,?,?,?,false,?)",
                UUID.fromString(id),name,name,name,"aaa-fixture-"+id);
        }
        String name=nickname();var fresh=actor(register(name,name));String account=accountId(fresh,name);
        assertThat(getJson(fresh,"/demo/accounts").size()).isGreaterThan(100);
        call(fresh,"DELETE","/demo/session",null,204);
        assertThat(login(account).id()).isEqualTo(fresh.id());
    }

    @Test void concurrentCaseVariantsCreateExactlyOneAccount() throws Exception {
        String name=nickname();var ready=new CountDownLatch(2);var start=new CountDownLatch(1);
        long count=users();
        try(var pool=Executors.newFixedThreadPool(2)) {
            var futures=new ArrayList<Future<MvcResult>>();
            for(String candidate:List.of(name,name.toUpperCase(Locale.ROOT))) {
                futures.add(pool.submit(()->{
                    ready.countDown();if(!start.await(10,TimeUnit.SECONDS))throw new IllegalStateException("Race barrier timed out");
                    return mvc.perform(post(api("/demo/accounts")).contentType("application/json")
                        .content(mapper.writeValueAsString(Map.of("nickname",candidate,"displayName","Участник")))).andReturn();
                }));
            }
            assertThat(ready.await(10,TimeUnit.SECONDS)).isTrue();start.countDown();
            var results=List.of(futures.get(0).get(20,TimeUnit.SECONDS),futures.get(1).get(20,TimeUnit.SECONDS));
            assertThat(results.stream().map(r->r.getResponse().getStatus()).sorted().toList()).containsExactly(201,409);
            assertThat(users()).isEqualTo(count+1);
            assertThat(jdbc.queryForObject("select count(*) from users where normalized_nickname=?",Long.class,name)).isEqualTo(1L);
            for(var result:results)if(result.getResponse().getStatus()==409) {
                assertThat(json(result).path("code").asText()).isEqualTo("CONFLICT");
                assertThat(result.getRequest().getSession(false)).isNull();
            }
        }
    }
}
