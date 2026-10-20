package ru.sport;

import java.time.*;
import java.util.*;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import ru.sport.api.Api;
import ru.sport.domain.EventEntity;
import ru.sport.persistence.Store;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test") @Transactional
class RecommendationTest extends ApiTestSupport {
    @Autowired Store db;
    @Autowired Clock clock;

    Actor newcomer() throws Exception {
        var response=call(null,"POST","/auth/register",Map.of("nickname","reco_"+UUID.randomUUID().toString().substring(0,12),"displayName","Участник","password","recommendation-pass-123"),201);
        var data=json(response);
        return new Actor((MockHttpSession)response.getRequest().getSession(false),data.path("csrfToken").asText(),data.path("user").path("id").asText());
    }
    String sport(Actor user,String name) throws Exception {
        for(var sport:getJson(user,"/sports"))if(sport.path("name").asText().equals(name))return sport.path("id").asText();
        throw new AssertionError("Missing sport "+name);
    }
    Map<String,Object> answers(String sport,Integer age) {
        var result=new LinkedHashMap<String,Object>(Map.of("city","Самара","sportsPreferences",List.of(Map.of("sportId",sport,"level","BEGINNER")),"preferredTime","EVENING","timeZone","Europe/Samara"));
        result.put("age",age);return result;
    }
    EventEntity event(Actor owner,String sport,String city) throws Exception {
        var event=db.get(EventEntity.class,UUID.fromString(createEvent(owner,"OPEN",10)));
        event.sportId=UUID.fromString(sport);event.customSportName=null;event.city=city;
        event.startsAt=LocalDate.now(clock).plusDays(10).atTime(18,0).atZone(ZoneId.of("Europe/Samara")).toInstant();
        db.flush();return event;
    }
    List<String> ids(JsonNode response) {
        var result=new ArrayList<String>();for(var item:response.path("items"))result.add(item.path("event").path("id").asText());return result;
    }
    JsonNode recommendations(Actor user,String query) throws Exception {db.flush();return getJson(user,"/events/recommended?size=100"+query);}

    @Test void favoriteFootballIncludesCustomSpellingButNotUnrelatedTitlesAndAlwaysRanksFirst() throws Exception {
        var user=newcomer();var owner=login("coach");String football=sport(user,"Футбол"),basketball=sport(user,"Баскетбол");
        call(user,"POST","/me/questionnaire",answers(football,null),200);
        var official=event(owner,football,"Самара");official.skillLevel=Api.EventSkillLevel.PROFESSIONAL;
        var custom=db.get(EventEntity.class,UUID.fromString(createEvent(owner,"OPEN",10)));custom.customSportName="  ФУТБОЛ  ";
        var unrelated=event(owner,basketball,"Самара");unrelated.title="Футбол обсуждаем после баскетбола";
        assertThat(ids(recommendations(user,""))).contains(official.id.toString(),custom.id.toString()).doesNotContain(unrelated.id.toString());
        var expanded=recommendations(user,"&includeOtherSports=true");var order=ids(expanded);
        assertThat(order.indexOf(official.id.toString())).isLessThan(order.indexOf(unrelated.id.toString()));
        assertThat(order.indexOf(custom.id.toString())).isLessThan(order.indexOf(unrelated.id.toString()));
        for(var item:expanded.path("items"))if(item.path("event").path("id").asText().equals(custom.id.toString()))assertThat(item.path("matchReasons").toString()).contains("FAVORITE_SPORT");
    }

    @Test void cityScopeIsExplicitAndEveryFavoriteIsReachableAcrossPages() throws Exception {
        var user=newcomer();var owner=login("coach");String football=sport(user,"Футбол");
        call(user,"POST","/me/questionnaire",answers(football,null),200);
        var expected=new ArrayList<String>();for(int i=0;i<8;i++)expected.add(event(owner,football,i==0?"г. Самара":"Самара").id.toString());
        var remote=event(owner,football,"Казань");
        assertThat(ids(recommendations(user,""))).containsAll(expected).doesNotContain(remote.id.toString());
        assertThat(ids(recommendations(user,"&includeOtherCities=true"))).contains(remote.id.toString());
        var collected=new ArrayList<String>();int total=0;
        for(int page=0;;page++) {
            var response=getJson(user,"/events/recommended?size=3&page="+page);total=response.path("total").asInt();collected.addAll(ids(response));
            if(page+1>=response.path("totalPages").asInt())break;
        }
        assertThat(collected).hasSize(total).doesNotHaveDuplicates().containsAll(expected);
        assertThat(collected).isEqualTo(ids(recommendations(user,"")));
        call(user,"GET","/events/recommended?page=-1",null,400);
    }

    @Test void ageUsesExplicitEventGuidanceWithoutAssigningSportsOrRestrictingJoining() throws Exception {
        var user=newcomer();var owner=login("coach");String basketball=sport(user,"Баскетбол");
        call(user,"POST","/me/questionnaire",answers(basketball,60),200);
        var adult=event(owner,basketball,"Самара");adult.recommendedMinAge=60;adult.recommendedMaxAge=75;
        var child=event(owner,basketball,"Самара");child.recommendedMinAge=10;child.recommendedMaxAge=16;
        var unknown=event(owner,basketball,"Самара");
        var recommendations=recommendations(user,"");assertThat(ids(recommendations)).contains(adult.id.toString(),unknown.id.toString()).doesNotContain(child.id.toString());
        var match=java.util.stream.StreamSupport.stream(recommendations.path("items").spliterator(),false).filter(i -> i.path("event").path("id").asText().equals(adult.id.toString())).findFirst().orElseThrow();
        assertThat(match.path("score").asInt()).isEqualTo(100);assertThat(match.path("matchReasons").toString()).contains("SUITABLE_AGE");
        assertThat(getJson(user,"/me/questionnaire").path("age").asInt()).isEqualTo(60);
        assertThat(getJson(user,"/users/"+user.id()).toString()).doesNotContain("age","recommendationAge");
        call(user,"POST","/me/questionnaire",answers(basketball,null),200);
        assertThat(ids(recommendations(user,""))).contains(child.id.toString());
        call(user,"POST","/me/questionnaire",answers(basketball,60),200);
        call(user,"POST","/events/"+child.id+"/registrations",Map.of(),201);
    }

    @Test void filledOwnedPastUnpublishedAndPreviouslyRegisteredEventsAreExcluded() throws Exception {
        var user=newcomer();var owner=login("coach");String football=sport(user,"Футбол");
        call(user,"POST","/me/questionnaire",answers(football,null),200);
        var available=event(owner,football,"Самара");var own=event(user,football,"Самара");
        var past=event(owner,football,"Самара");past.startsAt=clock.instant().minusSeconds(60);
        var draft=event(owner,football,"Самара");draft.status=Api.EventStatus.DRAFT;
        var cancelled=event(owner,football,"Самара");call(owner,"POST","/events/"+cancelled.id+"/cancel",null,200);
        var full=event(owner,football,"Самара");full.maxParticipants=2;db.flush();
        call(login("athlete-a"),"POST","/events/"+full.id+"/registrations",Map.of(),201);
        call(login("athlete-b"),"POST","/events/"+full.id+"/registrations",Map.of(),201);
        var joined=event(owner,football,"Самара");call(user,"POST","/events/"+joined.id+"/registrations",Map.of(),201);
        var left=event(owner,football,"Самара");call(user,"POST","/events/"+left.id+"/registrations",Map.of(),201);
        call(user,"DELETE","/events/"+left.id+"/registrations/me",null,200);
        assertThat(ids(recommendations(user,""))).contains(available.id.toString()).doesNotContain(own.id.toString(),past.id.toString(),draft.id.toString(),cancelled.id.toString(),full.id.toString(),joined.id.toString(),left.id.toString());
        call(login("admin"),"GET","/events/recommended",null,403);
    }

    @Test void localTimeDoesNotTreatNightAsEveningAndAnyDoesNotGiveFalseTimeReason() throws Exception {
        var user=newcomer();var owner=login("coach");String football=sport(user,"Футбол");
        call(user,"POST","/me/questionnaire",answers(football,null),200);
        var evening=event(owner,football,"Самара");var night=event(owner,football,"Самара");night.startsAt=night.startsAt.plusSeconds(8*3600);
        var response=recommendations(user,"");assertThat(ids(response).indexOf(evening.id.toString())).isLessThan(ids(response).indexOf(night.id.toString()));
        for(var item:response.path("items"))if(item.path("event").path("id").asText().equals(night.id.toString()))assertThat(item.path("matchReasons").toString()).doesNotContain("PREFERRED_TIME");
        var any=answers(football,null);any.put("preferredTime","ANY");call(user,"POST","/me/questionnaire",any,200);
        assertThat(recommendations(user,"").path("items").toString()).doesNotContain("PREFERRED_TIME");
    }

    @Test void ageValidationIsAtomicAndEventBoundsCanBeUpdatedAndCleared() throws Exception {
        var user=newcomer();var owner=login("coach");String football=sport(user,"Футбол");
        call(user,"POST","/me/questionnaire",answers(football,60),200);
        for(int invalid:new int[]{0,121})call(user,"POST","/me/questionnaire",answers(football,invalid),400);
        assertThat(getJson(user,"/me/questionnaire").path("age").asInt()).isEqualTo(60);
        var event=event(owner,football,"Самара");String path="/events/"+event.id;
        call(owner,"PATCH",path,Map.of("recommendedMinAge",60,"recommendedMaxAge",75),200);
        assertThat(getJson(user,path).path("recommendedMinAge").asInt()).isEqualTo(60);
        call(owner,"PATCH",path,Map.of("recommendedMaxAge",-1),400);
        var clear=new LinkedHashMap<String,Object>();clear.put("recommendedMinAge",null);clear.put("recommendedMaxAge",null);
        call(owner,"PATCH",path,clear,200);assertThat(getJson(user,path).path("recommendedMinAge").isNull()).isTrue();
        // Невалидный диапазон проверяем последним: после исключения сущность изменена в тестовой транзакции.
        call(owner,"PATCH",path,Map.of("recommendedMinAge",70,"recommendedMaxAge",20),400);
    }
}
