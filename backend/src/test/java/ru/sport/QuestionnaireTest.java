package ru.sport;

import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import ru.sport.domain.EventEntity;
import ru.sport.persistence.Store;
import org.springframework.beans.factory.annotation.Autowired;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test") @Transactional
class QuestionnaireTest extends ApiTestSupport {
    @Autowired Store db;

    Actor register() throws Exception {
        var response=call(null,"POST","/auth/register",Map.of("nickname","anketa_"+UUID.randomUUID().toString().substring(0,12),
            "displayName","Новый участник","password","questionnaire-pass-123"),201);
        var data=json(response);
        return new Actor((MockHttpSession)response.getRequest().getSession(false),data.path("csrfToken").asText(),data.path("user").path("id").asText());
    }
    Map<String,Object> answers(String sport) {
        return new LinkedHashMap<>(Map.of("city","Самара","sportsPreferences",List.of(Map.of("sportId",sport,"level","BEGINNER")),
            "preferredTime","EVENING","timeZone","Europe/Samara"));
    }
    String sport(Actor actor) throws Exception { return getJson(actor,"/sports").get(0).path("id").asText(); }

    @Test void onboardingCanBeSkippedAndCompletedLaterWithoutChangingOtherProfileData() throws Exception {
        var user=register();
        assertThat(getJson(user,"/me/questionnaire").path("status").asText()).isEqualTo("PENDING");
        call(user,"POST","/me/questionnaire/skip",null,200);
        assertThat(getJson(user,"/me/questionnaire").path("status").asText()).isEqualTo("SKIPPED");
        call(user,"PATCH","/me/profile",Map.of("bio","Люблю тренировки с друзьями","sportsRoles",List.of("COACH")),200);
        var saved=json(call(user,"POST","/me/questionnaire",answers(sport(user)),200));
        assertThat(saved.path("status").asText()).isEqualTo("COMPLETED");
        assertThat(saved.path("completedAt").asText()).isNotBlank();
        var profile=getJson(user,"/me/profile");
        assertThat(profile.path("city").asText()).isEqualTo("Самара");
        assertThat(profile.path("bio").asText()).isEqualTo("Люблю тренировки с друзьями");
        assertThat(profile.path("sportsRoles").toString()).contains("COACH");
        assertThat(getJson(user,"/users/"+user.id()).toString()).doesNotContain("questionnaire","recommendationTimeZone");
        call(user,"POST","/me/questionnaire/skip",null,200);
        assertThat(getJson(user,"/me/questionnaire")).isEqualTo(saved);
        var changed=answers(sport(user));changed.put("city","Красноярск");
        call(user,"POST","/me/questionnaire",changed,200);
        assertThat(getJson(user,"/me/questionnaire").path("city").asText()).isEqualTo("Красноярск");
    }

    @Test void answersArePrivateValidatedAndProtectedByCsrf() throws Exception {
        var a=register();var b=register();String sport=sport(a);
        call(null,"GET","/me/questionnaire",null,401);
        var valid=answers(sport);
        mvc.perform(post("/api/v1/me/questionnaire").session(a.session()).contentType("application/json")
            .content(mapper.writeValueAsString(valid))).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isForbidden());
        for (var entry:Map.<String,Object>of("city"," ","sportsPreferences",List.of(),"preferredTime","NIGHT","timeZone","Invalid/Zone").entrySet()) {
            var invalid=answers(sport);invalid.put(entry.getKey(),entry.getValue());
            call(a,"POST","/me/questionnaire",invalid,400);
        }
        var duplicates=answers(sport);duplicates.put("sportsPreferences",List.of(Map.of("sportId",sport,"level","BEGINNER"),Map.of("sportId",sport,"level","AMATEUR")));
        call(a,"POST","/me/questionnaire",duplicates,400);
        call(a,"POST","/me/questionnaire",answers(UUID.randomUUID().toString()),404);
        assertThat(getJson(a,"/me/questionnaire").path("status").asText()).isEqualTo("PENDING");
        call(a,"POST","/me/questionnaire",valid,200);
        assertThat(getJson(b,"/me/questionnaire").path("status").asText()).isEqualTo("PENDING");
        assertThat(getJson(b,"/me/profile").path("sportsPreferences")).isEmpty();
        assertThat(getJson(login("athlete-a"),"/me/questionnaire").path("status").asText()).isEqualTo("SKIPPED");
    }

    @Test void recommendationsUseSavedCitySportAndLocalTimeAndExcludeUnpublishedEvents() throws Exception {
        var user=register();var owner=login("coach");
        String eventId=createEvent(owner,"OPEN",10);
        var event=db.get(EventEntity.class,UUID.fromString(eventId));
        event.startsAt=LocalDate.now(ZoneOffset.UTC).plusDays(10).atTime(18,0).atZone(ZoneId.of("Europe/Samara")).toInstant();
        db.flush();
        call(user,"POST","/me/questionnaire",answers(event.sportId.toString()),200);
        var items=getJson(user,"/events/recommended").path("items");
        var match=java.util.stream.StreamSupport.stream(items.spliterator(),false).filter(item -> item.path("event").path("id").asText().equals(eventId)).findFirst().orElseThrow();
        assertThat(match.path("matchReasons").toString()).contains("FAVORITE_SPORT","PREFERRED_TIME","SUITABLE_LEVEL");
        assertThat(match.path("score").asInt()).isEqualTo(100);
        call(login("admin"),"POST","/admin/events/"+eventId+"/unpublish",Map.of("reason","Проверка модерации"),200);
        assertThat(getJson(user,"/events/recommended").path("items").toString()).doesNotContain(eventId);
        var changed=answers(event.sportId.toString());changed.put("city","Другой город");
        call(user,"POST","/me/questionnaire",changed,200);
        assertThat(getJson(user,"/events/recommended").path("items")).isEmpty();
    }
}
