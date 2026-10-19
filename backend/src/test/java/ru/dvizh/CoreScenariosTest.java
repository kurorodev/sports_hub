package ru.dvizh;

import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import ru.dvizh.config.DemoSeed;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test") @Transactional
class CoreScenariosTest extends ApiTestSupport {
    @Test void s1_createNewSportFindAndValidateOwner() throws Exception {
        var a=login("athlete-a");var b=login("athlete-b");String event=createEvent(a,"OPEN",10);
        var detail=getJson(b,"/events/"+event);
        assertThat(detail.path("sport").path("name").asText()).isEqualTo("Другое");
        assertThat(detail.path("organizer").path("id").asText()).isEqualTo(a.id());
        assertThat(getJson(b,"/events?sport=Флорбол&city=Самара").path("items").toString()).contains(event);
        assertThat(detail.path("customSportName").asText()).isEqualTo("Флорбол");
        call(b,"PATCH","/events/"+event,Map.of("title","Чужая правка"),403);
        call(a,"PATCH","/events/"+event,Map.of("organizer",Map.of("id",b.id())),400);
        call(null,"GET","/events?page=-1",null,400);
        call(null,"GET","/events?joinMode=INVALID",null,400);
    }
    @Test void s2_organizationPendingApprovalRejectionAndPublication() throws Exception {
        var representative=login("athlete-a");var admin=login("admin");var outsider=login("athlete-b");
        String org=json(call(representative,"POST","/organizations",Map.of("name","Новая команда","description","Спортивное сообщество любителей спорта"),201)).path("id").asText();
        assertThat(getJson(representative,"/organizations/"+org).path("status").asText()).isEqualTo("PENDING");
        call(outsider,"GET","/organizations/"+org,null,404);
        var event=new LinkedHashMap<String,Object>();event.put("title","Встреча команды");event.put("description","Первая совместная встреча спортивного сообщества");event.put("sport",Map.of("customName","Петанк"));event.put("startsAt",java.time.Instant.now().plusSeconds(864000).toString());event.put("location",Map.of("city","Самара","address","Парк"));event.put("joinMode","OPEN");event.put("organizer",Map.of("type","ORGANIZATION","id",org));
        call(representative,"POST","/events",event,403);
        call(outsider,"POST","/admin/organizations/"+org+"/decision",Map.of("decision","APPROVE"),403);
        call(admin,"POST","/admin/organizations/"+org+"/decision",Map.of("decision","APPROVE"),200);
        assertThat(getJson(outsider,"/organizations/"+org).path("status").asText()).isEqualTo("APPROVED");
        String eventId=json(call(representative,"POST","/events",event,201)).path("id").asText();
        assertThat(getJson(outsider,"/organizations/"+org+"/events").path("items").toString()).contains(eventId);
        String second=json(call(representative,"POST","/organizations",Map.of("name","Второй клуб","description","Другое спортивное сообщество для проверки отказа"),201)).path("id").asText();
        call(admin,"POST","/admin/organizations/"+second+"/decision",Map.of("decision","REJECT"),400);
        call(admin,"POST","/admin/organizations/"+second+"/decision",Map.of("decision","REJECT","reason","Описание требует уточнения"),200);
        assertThat(getJson(representative,"/organizations/"+second).path("decisionReason").asText()).isEqualTo("Описание требует уточнения");
        event.put("organizer",Map.of("type","ORGANIZATION","id",second));call(representative,"POST","/events",event,403);
    }
    @Test void s3_openRegistrationPersistsAndRejectsDuplicateAndForgery() throws Exception {
        var owner=login("coach");var athlete=login("athlete-a");String event=createEvent(owner,"OPEN",2);
        var reg=json(call(athlete,"POST","/events/"+event+"/registrations",Map.of(),201));
        assertThat(reg.path("status").asText()).isEqualTo("CONFIRMED");
        assertThat(getJson(owner,"/events/"+event+"/participants").path("items").toString()).contains(athlete.id());
        assertThat(getJson(athlete,"/events/"+event+"/my-registration").path("id")).isEqualTo(reg.path("id"));
        call(athlete,"POST","/events/"+event+"/registrations",Map.of(),409);
        call(login("athlete-b"),"POST","/events/"+event+"/registrations",Map.of("userId",owner.id()),400);
    }
    @Test void s4_approvalBothDecisionsAndAdminCannotDecide() throws Exception {
        var owner=login("coach");var a=login("athlete-a");var b=login("athlete-b");var admin=login("admin");String event=createEvent(owner,"APPROVAL",2);
        String first=json(call(a,"POST","/events/"+event+"/registrations",Map.of(),201)).path("id").asText();
        String second=json(call(b,"POST","/events/"+event+"/registrations",Map.of(),201)).path("id").asText();
        assertThat(getJson(owner,"/events/"+event+"/participants").path("total").asInt()).isZero();
        call(admin,"POST","/events/"+event+"/registrations/"+first+"/decision",Map.of("decision","APPROVE"),403);
        call(b,"POST","/events/"+event+"/registrations/"+first+"/decision",Map.of("decision","APPROVE"),403);
        call(owner,"POST","/events/"+event+"/registrations/"+first+"/decision",Map.of("decision","APPROVE"),200);
        call(owner,"POST","/events/"+event+"/registrations/"+second+"/decision",Map.of("decision","REJECT","reason","Группа укомплектована"),200);
        assertThat(getJson(a,"/events/"+event+"/my-registration").path("status").asText()).isEqualTo("CONFIRMED");
        assertThat(getJson(b,"/events/"+event+"/my-registration").path("status").asText()).isEqualTo("REJECTED");
        assertThat(getJson(owner,"/events/"+event+"/participants").path("total").asInt()).isEqualTo(1);
        call(owner,"POST","/events/"+event+"/registrations/"+first+"/decision",Map.of("decision","REJECT"),409);
        String other=createEvent(owner,"APPROVAL",2);
        call(owner,"POST","/events/"+other+"/registrations/"+first+"/decision",Map.of("decision","REJECT"),404);
    }
    @Test void s5_questionWithoutRegistrationAnswerAndIsolatedModeration() throws Exception {
        var owner=login("coach");var a=login("athlete-a");var admin=login("admin");String event=createEvent(owner,"OPEN",2);
        String question=json(call(a,"POST","/events/"+event+"/comments",Map.of("text","Можно без опыта?"),201)).path("id").asText();
        call(owner,"POST","/events/"+event+"/comments",Map.of("text","Да, конечно"),201);
        assertThat(getJson(null,"/events/"+event+"/comments").path("total").asInt()).isEqualTo(2);
        call(a,"POST","/admin/comments/"+question+"/hide",Map.of("reason","Скрыть вопрос"),403);
        call(admin,"POST","/admin/comments/"+question+"/hide",Map.of("reason","Демонстрация модерации"),200);
        var comments=getJson(a,"/events/"+event+"/comments");assertThat(comments.path("total").asInt()).isEqualTo(1);assertThat(comments.path("items").get(0).path("author").path("id").asText()).isEqualTo(owner.id());
        assertThat(getJson(admin,"/admin/comments?eventId="+event).path("total").asInt()).isEqualTo(2);
    }
    @Test void s6_unpublishBlocksDirectJoinAndPreservesExplanation() throws Exception {
        var owner=login("coach");var a=login("athlete-a");var b=login("athlete-b");var admin=login("admin");String event=createEvent(owner,"OPEN",2);
        call(a,"POST","/events/"+event+"/registrations",Map.of(),201);
        call(admin,"POST","/admin/events/"+event+"/unpublish",Map.of("reason","Площадка закрыта"),200);
        assertThat(getJson(null,"/events").path("items").toString()).doesNotContain(event);
        call(b,"POST","/events/"+event+"/registrations",Map.of(),409);call(b,"GET","/events/"+event,null,404);
        assertThat(getJson(a,"/events/"+event).path("moderationReason").isNull()).isTrue();
        assertThat(getJson(owner,"/me/events").path("items").toString()).contains(event);
        call(owner,"POST","/events/"+event+"/publish",null,409);
    }
}
