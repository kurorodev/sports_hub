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
import ru.sport.config.DemoSeed;
import ru.sport.domain.EventEntity;
import ru.sport.persistence.Store;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test") @Transactional
class EventCancellationTest extends ApiTestSupport {
    @Autowired Store db;
    @Autowired Clock clock;

    @Test void ownerCancellationClosesAllParticipationAndNotifiesExactlyOnce() throws Exception {
        var owner=login("coach");var a=login("athlete-a");var b=login("athlete-b");var c=login("athlete-c");String event=createEvent(owner,"OPEN",2);
        call(a,"POST","/events/"+event+"/registrations",Map.of(),201);
        call(b,"POST","/events/"+event+"/registrations",Map.of(),201);
        call(c,"POST","/events/"+event+"/waitlist",Map.of(),201);
        var result=json(call(owner,"POST","/events/"+event+"/cancel",null,200));
        assertThat(result.path("status").asText()).isEqualTo("UNPUBLISHED");assertThat(result.path("cancelledAt").asText()).isNotBlank();
        var again=json(call(owner,"POST","/events/"+event+"/cancel",null,200));assertThat(again.path("cancelledAt")).isEqualTo(result.path("cancelledAt"));
        for(var actor:List.of(owner,a,b,c)) {
            int count=0;for(var notice:getJson(actor,"/me/notifications?size=100").path("items"))if(notice.path("href").asText().equals("/events/"+event) && notice.path("title").asText().equals("Мероприятие отменено организатором"))count++;
            assertThat(count).isEqualTo(1);
        }
        for(var actor:List.of(a,b,c)) {
            assertThat(getJson(actor,"/events/"+event+"/my-registration").path("status").asText()).isEqualTo("CANCELLED");
            assertThat(getJson(actor,"/me/registrations?view=HISTORY&size=100").path("items").toString()).contains(event);
            assertThat(getJson(actor,"/me/registrations?view=UPCOMING&size=100").path("items").toString()).doesNotContain(event);
        }
        assertThat(getJson(owner,"/events/"+event+"/team").path("confirmedCount").asInt()).isZero();
        assertThat(getJson(owner,"/events/"+event+"/team").path("waitlistedCount").asInt()).isZero();
        call(a,"POST","/events/"+event+"/registrations",Map.of(),409);
        call(a,"POST","/events/"+event+"/comments",Map.of("text","Нельзя писать после отмены"),409);
        call(owner,"POST","/events/"+event+"/publish",null,409);
        assertThat(getJson(owner,"/events?includePast=true&size=100").path("items").toString()).doesNotContain(event);
        assertThat(getJson(owner,"/me/events?size=100").path("items").toString()).contains(event);
    }

    @Test void approvedOrganizationRepresentativeCanCancelItsOwnEvent() throws Exception {
        var representative=login("org-approved");var a=login("athlete-a");var b=login("athlete-b");
        String event=json(call(representative,"POST","/events",Map.of("title","Отмена встречи клуба","description","Проверяем отмену мероприятия организации","sport",Map.of("customName","Падел"),"startsAt",clock.instant().plusSeconds(86400).toString(),"location",Map.of("city","Самара","address","Парк"),"joinMode","APPROVAL","organizer",Map.of("type","ORGANIZATION","id",DemoSeed.id("club-approved").toString())),201)).path("id").asText();
        String registration=json(call(a,"POST","/events/"+event+"/registrations",Map.of(),201)).path("id").asText();
        call(representative,"POST","/events/"+event+"/registrations/"+registration+"/decision",Map.of("decision","APPROVE"),200);
        call(b,"POST","/events/"+event+"/registrations",Map.of(),201);
        call(login("org-pending"),"POST","/events/"+event+"/cancel",null,403);
        call(representative,"POST","/events/"+event+"/cancel",null,200);
        for(var actor:List.of(a,b))assertThat(getJson(actor,"/events/"+event+"/my-registration").path("status").asText()).isEqualTo("CANCELLED");
        assertThat(getJson(representative,"/me/events").path("items").toString()).contains(event);
        call(representative,"POST","/events/"+event+"/registrations/"+registration+"/decision",Map.of("decision","REJECT"),409);
    }

    @Test void cancellationEnforcesOwnerTimeAndModerationBoundaries() throws Exception {
        var owner=login("coach");String event=createEvent(owner,"OPEN",5);
        for(var actor:List.of(login("athlete-a"),login("org-approved"),login("admin")))call(actor,"POST","/events/"+event+"/cancel",null,403);
        call(null,"POST","/events/"+event+"/cancel",null,403);
        var entity=db.get(EventEntity.class,UUID.fromString(event));entity.startsAt=clock.instant().minusSeconds(60);db.flush();
        call(owner,"POST","/events/"+event+"/cancel",null,409);
        entity.startsAt=clock.instant().plusSeconds(3600);entity.status=Api.EventStatus.UNPUBLISHED;entity.moderationReason="Решение модератора";db.flush();
        call(owner,"POST","/events/"+event+"/cancel",null,409);assertThat(entity.moderationReason).isEqualTo("Решение модератора");assertThat(entity.cancelledAt).isNull();
    }

    @Test void draftCanBeCancelledWithoutDeletingItsHistory() throws Exception {
        var owner=login("coach");String event=createEvent(owner,"OPEN",5);db.get(EventEntity.class,UUID.fromString(event)).status=Api.EventStatus.DRAFT;db.flush();
        call(owner,"POST","/events/"+event+"/cancel",null,200);
        assertThat(getJson(owner,"/events/"+event).path("cancelledAt").asText()).isNotBlank();
        call(owner,"PATCH","/events/"+event,Map.of("title","Новое название"),409);
    }
}
