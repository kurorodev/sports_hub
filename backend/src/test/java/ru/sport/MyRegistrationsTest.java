package ru.sport;

import java.time.Clock;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import ru.sport.api.Api;
import ru.sport.domain.EventEntity;
import ru.sport.persistence.Store;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test") @Transactional
class MyRegistrationsTest extends ApiTestSupport {
    @Autowired Store db;
    @Autowired Clock clock;

    Set<String> ids(Actor actor,String view) throws Exception {
        Set<String> result=new HashSet<>();
        getJson(actor,"/me/registrations?view="+view+"&size=100").path("items").forEach(item -> result.add(item.path("eventId").asText()));
        return result;
    }

    @Test void personalListFiltersBeforePaginationAndIncludesEventDetails() throws Exception {
        var owner=login("coach");var user=login("athlete-c");var outsider=login("athlete-b");
        String future=createEvent(owner,"OPEN",5),past=createEvent(owner,"OPEN",5),hidden=createEvent(owner,"OPEN",5),ongoing=createEvent(owner,"OPEN",5);
        for(String id:List.of(future,past,hidden,ongoing))call(user,"POST","/events/"+id+"/registrations",Map.of(),201);
        db.get(EventEntity.class,UUID.fromString(past)).startsAt=clock.instant().minusSeconds(3600);
        db.get(EventEntity.class,UUID.fromString(hidden)).status=Api.EventStatus.UNPUBLISHED;
        var running=db.get(EventEntity.class,UUID.fromString(ongoing));running.startsAt=clock.instant().minusSeconds(60);running.endsAt=clock.instant().plusSeconds(3600);db.flush();
        assertThat(ids(user,"UPCOMING")).contains(future,ongoing).doesNotContain(past,hidden);
        assertThat(ids(user,"HISTORY")).contains(past,hidden).doesNotContain(future,ongoing);
        assertThat(ids(outsider,"UPCOMING")).doesNotContain(future,past,hidden,ongoing);
        var page=getJson(user,"/me/registrations?view=UPCOMING&size=1");
        assertThat(page.path("items")).hasSize(1);assertThat(page.path("total").asInt()).isGreaterThanOrEqualTo(2);
        var event=page.path("items").get(0).path("event");assertThat(event.path("title").asText()).isNotBlank();assertThat(event.path("location").path("address").asText()).isNotBlank();
        call(null,"GET","/me/registrations?view=UPCOMING",null,401);
        call(user,"GET","/me/registrations?view=INVALID",null,400);
        call(user,"DELETE","/events/"+past+"/registrations/me",null,409);
    }

    @Test void cancellationMovesOwnParticipationToHistoryAndAllowsRejoining() throws Exception {
        var owner=login("coach");var user=login("athlete-c");var outsider=login("athlete-b");String event=createEvent(owner,"OPEN",5);
        call(user,"POST","/events/"+event+"/registrations",Map.of(),201);
        call(outsider,"DELETE","/events/"+event+"/registrations/me",null,404);
        call(null,"DELETE","/events/"+event+"/registrations/me",null,403);
        assertThat(json(call(user,"DELETE","/events/"+event+"/registrations/me",null,200)).path("status").asText()).isEqualTo("CANCELLED");
        assertThat(ids(user,"UPCOMING")).doesNotContain(event);assertThat(ids(user,"HISTORY")).contains(event);
        assertThat(getJson(user,"/events/"+event+"/team").path("confirmedCount").asInt()).isZero();
        call(user,"DELETE","/events/"+event+"/registrations/me",null,409);
        call(user,"POST","/events/"+event+"/registrations",Map.of(),201);
        assertThat(ids(user,"UPCOMING")).contains(event);assertThat(ids(user,"HISTORY")).doesNotContain(event);
    }

    @Test void pendingAndWaitlistedParticipationCanAlsoBeCancelled() throws Exception {
        var owner=login("coach");var user=login("athlete-c");String pending=createEvent(owner,"APPROVAL",5),full=createEvent(owner,"OPEN",2);
        call(user,"POST","/events/"+pending+"/registrations",Map.of(),201);
        call(user,"DELETE","/events/"+pending+"/registrations/me",null,200);
        call(login("athlete-a"),"POST","/events/"+full+"/registrations",Map.of(),201);
        call(login("athlete-b"),"POST","/events/"+full+"/registrations",Map.of(),201);
        call(user,"POST","/events/"+full+"/waitlist",Map.of(),201);
        call(user,"DELETE","/events/"+full+"/registrations/me",null,200);
        assertThat(ids(user,"HISTORY")).contains(pending,full);
    }
}
