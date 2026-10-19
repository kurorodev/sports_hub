package ru.dvizh;

import java.time.*;
import java.util.*;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import ru.dvizh.api.Api;
import ru.dvizh.domain.*;
import ru.dvizh.persistence.Store;
import ru.dvizh.service.NotificationService;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test") @Transactional
class NotificationsTest extends ApiTestSupport {
    @Autowired NotificationService notifications;
    @Autowired Store db;
    @Autowired Clock clock;
    List<JsonNode> notices(Actor user,String type) throws Exception {
        var result=new ArrayList<JsonNode>();getJson(user,"/me/notifications?size=100").path("items").forEach(n -> {if(n.path("type").asText().equals(type))result.add(n);});return result;
    }
    @Test void approvalAndRejectionNotifyOnlyAffectedUsers() throws Exception {
        var owner=login("coach");var a=login("athlete-a");var b=login("athlete-b");var admin=login("admin");String event=createEvent(owner,"APPROVAL",2);
        String reg=json(call(a,"POST","/events/"+event+"/registrations",Map.of(),201)).path("id").asText();
        assertThat(notices(a,"REGISTRATION_STATUS")).singleElement().extracting(n -> n.path("title").asText()).isEqualTo("Заявка отправлена");
        assertThat(notices(owner,"NEW_REGISTRATION")).hasSize(1);assertThat(notices(b,"NEW_REGISTRATION")).isEmpty();
        call(owner,"POST","/events/"+event+"/registrations/"+reg+"/decision",Map.of("decision","APPROVE"),200);
        assertThat(notices(a,"REGISTRATION_STATUS")).extracting(n -> n.path("title").asText()).contains("Участие подтверждено");
        String second=json(call(b,"POST","/events/"+event+"/registrations",Map.of(),201)).path("id").asText();
        call(owner,"POST","/events/"+event+"/registrations/"+second+"/decision",Map.of("decision","REJECT","reason","Группа заполнена"),200);
        assertThat(notices(b,"REGISTRATION_STATUS")).anyMatch(n -> n.path("reason").asText().equals("Группа заполнена"));
        long before=getJson(b,"/me/notifications").path("total").asLong();
        call(owner,"POST","/events/"+event+"/registrations/"+second+"/decision",Map.of("decision","REJECT"),409);
        assertThat(getJson(b,"/me/notifications").path("total").asLong()).isEqualTo(before);
        String id=notices(a,"REGISTRATION_STATUS").get(0).path("id").asText();
        call(b,"POST","/me/notifications/"+id+"/read",null,404);call(admin,"POST","/me/notifications/"+id+"/read",null,404);
        call(null,"GET","/me/notifications",null,401);
        var forged=new Actor(a.session(),"wrong",a.id());call(forged,"POST","/me/notifications/"+id+"/read",null,403);
    }
    @Test void moderationReasonsArePersonalAndNeverInEventResponses() throws Exception {
        var owner=login("coach");var a=login("athlete-a");var admin=login("admin");String event=createEvent(owner,"OPEN",2);
        call(a,"POST","/events/"+event+"/registrations",Map.of(),201);
        String comment=json(call(a,"POST","/events/"+event+"/comments",Map.of("text","Мой вопрос"),201)).path("id").asText();
        call(admin,"POST","/admin/comments/"+comment+"/hide",Map.of("reason","Личная причина комментария"),200);
        call(admin,"POST","/admin/comments/"+comment+"/hide",Map.of("reason","Повторное скрытие"),409);
        assertThat(notices(a,"COMMENT_HIDDEN")).singleElement().extracting(n -> n.path("reason").asText()).isEqualTo("Личная причина комментария");
        assertThat(notices(owner,"COMMENT_HIDDEN")).isEmpty();
        call(admin,"POST","/admin/events/"+event+"/unpublish",Map.of("reason","Личная причина организатору"),200);
        assertThat(notices(owner,"EVENT_UNPUBLISHED")).singleElement().extracting(n -> n.path("reason").asText()).isEqualTo("Личная причина организатору");
        assertThat(notices(a,"EVENT_UNPUBLISHED")).singleElement().matches(n -> n.path("reason").isNull());
        for(var viewer:List.of(owner,a,admin))assertThat(getJson(viewer,"/events/"+event).path("moderationReason").isNull()).isTrue();
        assertThat(getJson(admin,"/admin/events").toString()).doesNotContain("Личная причина организатору");
    }
    @Test void organizationDecisionAndModerationReachItsRepresentative() throws Exception {
        var rep=login("athlete-a");var other=login("athlete-b");var admin=login("admin");
        String org=json(call(rep,"POST","/organizations",Map.of("name","Команда уведомлений","description","Организация для проверки личных уведомлений"),201)).path("id").asText();
        call(admin,"POST","/admin/organizations/"+org+"/decision",Map.of("decision","APPROVE"),200);
        assertThat(notices(rep,"ORGANIZATION_STATUS")).hasSize(1);assertThat(notices(other,"ORGANIZATION_STATUS")).isEmpty();
        var e=new EventEntity();e.title="Встреча клуба";e.description="Описание встречи клуба";e.organizerOrganizationId=UUID.fromString(org);e.sportId=db.list(SportEntity.class,"e.canonicalId is null",Map.of()).getFirst().id;
        e.city="Самара";e.address="Парк";e.startsAt=clock.instant().plusSeconds(10000);e.joinMode=Api.JoinMode.OPEN;e.status=Api.EventStatus.PUBLISHED;db.add(e);
        call(admin,"POST","/admin/events/"+e.id+"/unpublish",Map.of("reason","Уточните место встречи клуба"),200);
        assertThat(notices(rep,"EVENT_UNPUBLISHED")).singleElement().extracting(n -> n.path("reason").asText()).isEqualTo("Уточните место встречи клуба");
        assertThat(notices(other,"EVENT_UNPUBLISHED")).isEmpty();
    }
    @Test void hiddenCommentNotificationKeepsTheFullOriginalTextOnlyForItsAuthor() throws Exception {
        var owner=login("coach");var author=login("athlete-a");var other=login("athlete-b");var admin=login("admin");
        String event=createEvent(owner,"OPEN",2);
        String original="<script>не HTML</script>\n"+"я".repeat(1975); // Full 2000-character comment, including the newline.
        assertThat(original).hasSize(2000);
        String comment=json(call(author,"POST","/events/"+event+"/comments",Map.of("text",original),201)).path("id").asText();
        String second=json(call(author,"POST","/events/"+event+"/comments",Map.of("text","Другой мой вопрос"),201)).path("id").asText();
        call(admin,"POST","/admin/comments/"+comment+"/hide",Map.of("reason","Причина первого скрытия"),200);
        call(admin,"POST","/admin/comments/"+second+"/hide",Map.of("reason","Причина второго скрытия"),200);
        var notices=notices(author,"COMMENT_HIDDEN");
        assertThat(notices).hasSize(2);
        var first=notices.stream().filter(n -> n.path("commentText").asText().equals(original)).findFirst().orElseThrow();
        assertThat(first.path("reason").asText()).isEqualTo("Причина первого скрытия");
        assertThat(first.path("text").asText()).isEqualTo(getJson(owner,"/events/"+event).path("title").asText());
        assertThat(notices).anyMatch(n -> n.path("commentText").asText().equals("Другой мой вопрос") && n.path("reason").asText().equals("Причина второго скрытия"));
        String noticeId=first.path("id").asText();
        assertThat(json(call(author,"POST","/me/notifications/"+noticeId+"/read",null,200)).path("commentText").asText()).isEqualTo(original);
        db.execute("update CommentEntity e set e.text=:text where e.id=:id",Map.of("text","Изменённый текст","id",UUID.fromString(comment)));
        assertThat(notices(author,"COMMENT_HIDDEN")).anyMatch(n -> n.path("commentText").asText().equals(original));
        for(var viewer:List.of(owner,other,admin)) {
            assertThat(notices(viewer,"COMMENT_HIDDEN")).isEmpty();
            call(viewer,"POST","/me/notifications/"+noticeId+"/read",null,404);
        }
        for(var viewer:List.of(owner,author,other))assertThat(getJson(viewer,"/events/"+event+"/comments").path("total").asInt()).isZero();
        assertThat(getJson(null,"/events/"+event+"/comments").path("total").asInt()).isZero();
    }
    @Test void readStateIsIdempotentAndBulkRespectsSnapshotAndAge() throws Exception {
        var a=login("athlete-a");var b=login("athlete-b");var user=UUID.fromString(a.id());var now=clock.instant();
        for(int i=0;i<25;i++)notifications.send(user,Api.NotificationType.EVENT_STATUS,"Событие "+i,"Описание",null,null,"test:"+i);
        var old=db.list(NotificationEntity.class,"e.recipientId=:user",Map.of("user",user)).getFirst();db.execute("update NotificationEntity e set e.createdAt=:old where e.id=:id",Map.of("old",now.minus(Duration.ofDays(31)),"id",old.id));
        var page=getJson(a,"/me/notifications?size=10");assertThat(page.path("total").asInt()).isEqualTo(24);assertThat(page.path("items").size()).isEqualTo(10);assertThat(page.path("totalPages").asInt()).isEqualTo(3);
        call(a,"POST","/me/notifications/"+old.id+"/read",null,404);
        String id=page.path("items").get(0).path("id").asText();var read=json(call(a,"POST","/me/notifications/"+id+"/read",null,200));
        assertThat(json(call(a,"POST","/me/notifications/"+id+"/read",null,200)).path("readAt")).isEqualTo(read.path("readAt"));
        var snapshot=page.path("asOf").asText();notifications.send(user,Api.NotificationType.EVENT_STATUS,"Позднее","Новое",null,null,"late");
        var late=db.first(NotificationEntity.class,"e.dedupeKey=:key",Map.of("key","late")).orElseThrow();late.createdAt=Instant.parse(snapshot).plusMillis(1);
        // Read-all must leave the newly arrived notification unread, regardless of page size.
        call(a,"POST","/me/notifications/read-all",Map.of("through",snapshot),204);
        assertThat(db.get(NotificationEntity.class,late.id).readAt).isNull();
        assertThat(getJson(b,"/me/notifications").path("total").asInt()).isZero();
        call(a,"GET","/me/notifications?page=-1",null,400);call(a,"GET","/me/notifications?size=101",null,400);
        call(a,"POST","/me/notifications/read-all",Map.of("through","bad"),400);
    }
    @Test void remindersAreDeduplicatedAndExcludePendingCancelledAndUnpublished() throws Exception {
        var owner=login("coach");var a=login("athlete-a");var b=login("athlete-b");String event=createEvent(owner,"APPROVAL",2);
        String reg=json(call(a,"POST","/events/"+event+"/registrations",Map.of(),201)).path("id").asText();
        call(owner,"POST","/events/"+event+"/registrations/"+reg+"/decision",Map.of("decision","APPROVE"),200);
        call(b,"POST","/events/"+event+"/registrations",Map.of(),201);
        var e=db.get(EventEntity.class,UUID.fromString(event));e.startsAt=clock.instant().plusSeconds(3600);db.flush();
        notifications.reminders();notifications.reminders();
        assertThat(notices(owner,"EVENT_STARTING")).hasSize(1);assertThat(notices(a,"EVENT_STARTING")).hasSize(1);assertThat(notices(b,"EVENT_STARTING")).isEmpty();
        e.startsAt=clock.instant().plusSeconds(7200);db.flush();notifications.reminders();assertThat(notices(a,"EVENT_STARTING")).hasSize(1);
        e.startsAt=clock.instant().plusSeconds(600);e.status=Api.EventStatus.UNPUBLISHED;db.flush();notifications.reminders();assertThat(notices(a,"EVENT_STARTING")).hasSize(1);
    }
    @Test void cancellationPromotionChangesAndMentionsNotifyCorrectPeople() throws Exception {
        var owner=login("coach");var a=login("athlete-a");var b=login("athlete-b");String event=createEvent(owner,"OPEN",2);
        call(owner,"POST","/events/"+event+"/registrations",Map.of(),201);
        call(a,"POST","/events/"+event+"/registrations",Map.of(),201);call(b,"POST","/events/"+event+"/waitlist",Map.of(),201);
        call(a,"DELETE","/events/"+event+"/registrations/me",null,200);
        assertThat(notices(b,"REGISTRATION_STATUS")).extracting(n -> n.path("title").asText()).contains("Участие подтверждено");
        assertThat(notices(a,"REGISTRATION_STATUS")).extracting(n -> n.path("title").asText()).contains("Участие отменено");
        call(owner,"PATCH","/events/"+event,Map.of("startsAt",clock.instant().plusSeconds(9000).toString()),200);
        assertThat(notices(b,"EVENT_UPDATED")).hasSize(1);assertThat(notices(a,"EVENT_UPDATED")).isEmpty();
        String nickname=getJson(b,"/me/profile").path("nickname").asText();
        call(owner,"POST","/events/"+event+"/comments",Map.of("text","Привет @"+nickname+" и @"+nickname),201);
        assertThat(notices(b,"MENTION")).hasSize(1);assertThat(notices(owner,"MENTION")).isEmpty();
    }
}
