package ru.dvizh;

import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import ru.dvizh.domain.*;
import ru.dvizh.persistence.Store;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test") @Transactional
class SupportTest extends ApiTestSupport {
    @Autowired Store db;
    @Autowired Clock clock;
    String ticket(Actor author) throws Exception {return json(call(author,"POST","/support/tickets",Map.of("category","HELP","title","Не могу записаться","description","Помогите разобраться с записью на встречу"),201)).path("id").asText();}
    @Test void privateThreadAdminNotificationRepliesStatusesAndReopening() throws Exception {
        var author=login("athlete-a");var stranger=login("athlete-b");var admin=login("admin");String id=ticket(author);
        assertThat(getJson(author,"/support/tickets").path("items").get(0).path("author").path("id").asText()).isEqualTo(author.id());
        assertThat(getJson(stranger,"/support/tickets").path("total").asInt()).isZero();
        for(String route:List.of("/support/tickets/"+id,"/support/tickets/"+id+"/messages"))call(stranger,"GET",route,null,404);
        call(stranger,"POST","/support/tickets/"+id+"/messages",Map.of("text","Чужой ответ"),404);
        call(stranger,"PATCH","/support/tickets/"+id,Map.of("status","CLOSED"),404);
        call(author,"GET","/admin/support/tickets",null,403);
        assertThat(getJson(admin,"/admin/support/tickets?q=записаться&category=HELP&status=OPEN").path("total").asInt()).isEqualTo(1);
        assertThat(getJson(admin,"/me/notifications").toString()).contains("SUPPORT_NEW","/support/"+id);
        call(admin,"POST","/support/tickets/"+id+"/messages",Map.of("text","Уточните, какая встреча?"),201);
        var ticket=getJson(author,"/support/tickets/"+id);assertThat(ticket.path("status").asText()).isEqualTo("WAITING_USER");assertThat(ticket.path("assignedTo").path("id").asText()).isEqualTo(admin.id());
        assertThat(getJson(author,"/me/notifications").toString()).contains("SUPPORT_REPLY");
        call(author,"POST","/support/tickets/"+id+"/messages",Map.of("text","Встреча в парке"),201);
        assertThat(getJson(admin,"/support/tickets/"+id).path("status").asText()).isEqualTo("OPEN");
        call(author,"PATCH","/support/tickets/"+id,Map.of("priority","URGENT"),403);
        call(author,"PATCH","/support/tickets/"+id,Map.of("status","RESOLVED"),403);
        call(admin,"PATCH","/support/tickets/"+id,Map.of("status","RESOLVED","priority","HIGH"),200);
        call(author,"POST","/support/tickets/"+id+"/messages",Map.of("text","Ещё вопрос"),409);
        call(author,"PATCH","/support/tickets/"+id,Map.of("status","OPEN"),200);
        call(author,"POST","/support/tickets/"+id+"/messages",Map.of("text","Теперь работает"),201);
        call(author,"PATCH","/support/tickets/"+id,Map.of("status","CLOSED"),200);
        var history=getJson(admin,"/support/tickets/"+id+"/messages?size=2");assertThat(history.path("items").size()).isEqualTo(2);assertThat(history.path("total").asInt()).isEqualTo(6);
        call(author,"GET","/support/tickets?page=-1",null,400);call(admin,"GET","/admin/support/tickets?status=WRONG",null,400);
    }
    @Test void reportSnapshotsVisibleCommentDeduplicatesAndDoesNotHideIt() throws Exception {
        var author=login("athlete-a");var reporter=login("athlete-b");var admin=login("admin");String event=createEvent(author,"OPEN",2);
        String comment=json(call(author,"POST","/events/"+event+"/comments",Map.of("text","Подозрительный текст"),201)).path("id").asText();
        var input=Map.of("category","COMMENT_REPORT","title","Жалоба на спам","description","В сообщении подозрительная реклама","commentId",comment,"reportReason","SPAM");
        var report=json(call(reporter,"POST","/support/tickets",input,201));String id=report.path("id").asText();
        assertThat(report.path("commentText").asText()).isEqualTo("Подозрительный текст");assertThat(report.path("eventId").asText()).isEqualTo(event);
        call(reporter,"POST","/support/tickets",input,409);
        assertThat(getJson(author,"/events/"+event+"/comments").toString()).contains("Подозрительный текст");
        assertThat(getJson(author,"/support/tickets").path("total").asInt()).isZero();
        call(admin,"POST","/admin/comments/"+comment+"/hide",Map.of("reason","Спам подтверждён"),200);
        assertThat(getJson(admin,"/support/tickets/"+id).path("commentText").asText()).isEqualTo("Подозрительный текст");
        call(admin,"PATCH","/support/tickets/"+id,Map.of("status","RESOLVED"),200);
        call(reporter,"POST","/support/tickets",input,404);
    }
    @Test void validatesVenueAuthenticationCsrfUnknownFieldsAndRateLimit() throws Exception {
        var author=login("athlete-a");var admin=login("admin");
        call(null,"GET","/support/tickets",null,401);
        call(new Actor(author.session(),"bad",author.id()),"POST","/support/tickets",Map.of(),403);
        call(author,"POST","/support/tickets",Map.of("category","HELP","title","   ","description","          "),400);
        call(author,"POST","/support/tickets",Map.of("category","VENUE_SUGGESTION","title","Площадка в парке","description","Есть отличная площадка для баскетбола"),400);
        var venue=Map.of("category","VENUE_SUGGESTION","title","Площадка в парке","description","Есть отличная площадка для баскетбола","venueCity","  Самара  ","venueAddress","  Лесная 10  ");
        var created=json(call(author,"POST","/support/tickets",venue,201));assertThat(created.path("venueCity").asText()).isEqualTo("Самара");
        String id=created.path("id").asText();
        call(author,"POST","/support/tickets/"+id+"/messages",Map.of("text"," "),400);
        call(author,"POST","/support/tickets/"+id+"/messages",Map.of("text","x".repeat(5001)),400);
        call(admin,"PATCH","/support/tickets/"+id,Map.of(),400);
        call(author,"POST","/support/tickets",Map.of("category","HELP","title","Мой вопрос","description","Подробное описание вопроса","authorId",admin.id()),400);
        for(int i=1;i<10;i++)ticket(author);
        call(author,"POST","/support/tickets",venue,429);
        assertThat(getJson(author,"/support/tickets?size=3").path("total").asInt()).isEqualTo(10);
        db.execute("update SupportTicketEntity e set e.createdAt=:before where e.authorId=:user",Map.of("user",UUID.fromString(author.id()),"before",clock.instant().minusSeconds(3700)));
        ticket(author);
    }
    @Test void closedReportsCanBeRepeatedButOnlyOneCanBeReopened() throws Exception {
        var a=login("athlete-a");var b=login("athlete-b");String event=createEvent(a,"OPEN",2);
        String comment=json(call(a,"POST","/events/"+event+"/comments",Map.of("text","Текст сообщения"),201)).path("id").asText();
        var input=Map.of("category","COMMENT_REPORT","title","Проверить сообщение","description","Прошу проверить это сообщение","commentId",comment,"reportReason","OTHER");
        String first=json(call(b,"POST","/support/tickets",input,201)).path("id").asText();call(b,"PATCH","/support/tickets/"+first,Map.of("status","CLOSED"),200);db.flush();
        String second=json(call(b,"POST","/support/tickets",input,201)).path("id").asText();
        call(b,"PATCH","/support/tickets/"+first,Map.of("status","OPEN"),409);
        call(b,"PATCH","/support/tickets/"+second,Map.of("status","CLOSED"),200);db.flush();
        call(b,"PATCH","/support/tickets/"+first,Map.of("status","OPEN"),200);
    }
    @Test void venuePointIsOptionalPairedBoundedAndPersists() throws Exception {
        var a=login("athlete-a");var admin=login("admin");
        var body=new HashMap<String,Object>(Map.of("category","VENUE_SUGGESTION","title","Новая площадка","description","Площадка для совместных занятий спортом","venueCity","Самара","venueAddress","Парк"));
        var manual=json(call(a,"POST","/support/tickets",body,201));assertThat(manual.path("venueLatitude").isNull()).isTrue();
        body.put("venueLatitude",0.0);call(a,"POST","/support/tickets",body,400);
        body.put("venueLongitude",180.0);var pinned=json(call(a,"POST","/support/tickets",body,201));
        var restored=getJson(admin,"/support/tickets/"+pinned.path("id").asText());assertThat(restored.path("venueLatitude").asDouble()).isZero();assertThat(restored.path("venueLongitude").asDouble()).isEqualTo(180.0);
        body.put("venueLatitude",91.0);call(a,"POST","/support/tickets",body,400);
        call(a,"POST","/support/tickets",Map.of("category","HELP","title","Нужна помощь","description","Подробное описание вопроса","venueLatitude",53.0,"venueLongitude",50.0),400);
    }
}
