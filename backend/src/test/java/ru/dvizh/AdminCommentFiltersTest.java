package ru.dvizh;

import java.time.*;
import java.util.*;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.*;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test") @Transactional
@Import(AdminCommentFiltersTest.TimeConfig.class)
class AdminCommentFiltersTest extends ApiTestSupport {
    @TestConfiguration static class TimeConfig {
        @Bean @Primary FilterClock filterClock() { return new FilterClock(); }
    }
    static class FilterClock extends Clock {
        Instant now=Instant.now();
        public ZoneId getZone(){return ZoneOffset.UTC;}
        public Clock withZone(ZoneId zone){return this;}
        public Instant instant(){return now;}
    }
    @Autowired FilterClock clock;
    @BeforeEach void setTimeAfterDemoSeed() { clock.now=Instant.now().truncatedTo(java.time.temporal.ChronoUnit.SECONDS).plusSeconds(172800); }

    String comment(Actor author,String event,Instant at) throws Exception {
        Instant saved=clock.now;clock.now=at;
        try { return json(call(author,"POST","/events/"+event+"/comments",Map.of("text","Комментарий для проверки фильтра"),201)).path("id").asText(); }
        finally { clock.now=saved; }
    }
    List<String> ids(JsonNode page) {
        List<String> ids=new ArrayList<>();page.path("items").forEach(item -> ids.add(item.path("id").asText()));return ids;
    }
    @Test void latestTenAreSelectedAfterAuthorAndEventFiltersAndRemainCappedAcrossPages() throws Exception {
        var a=login("athlete-a");var b=login("athlete-b");var admin=login("admin");
        String event=createEvent(a,"OPEN",10),other=createEvent(a,"OPEN",10);
        var own=new ArrayList<String>();
        for(int i=0;i<12;i++)own.add(comment(a,event,clock.instant().minusSeconds(1200-i*60)));
        String otherAuthor=comment(b,event,clock.instant().minusSeconds(2));
        String otherEvent=comment(a,other,clock.instant().minusSeconds(1));
        String scoped="/admin/comments?eventId="+event+"&authorId="+a.id()+"&latest=true&size=10";
        var result=getJson(admin,scoped);
        var expected=new ArrayList<>(own.subList(2,12));Collections.reverse(expected);
        assertThat(ids(result)).containsExactlyElementsOf(expected);
        assertThat(result.path("total").asInt()).isEqualTo(10);
        assertThat(ids(getJson(admin,scoped+"&page=1"))).isEmpty();
        assertThat(ids(getJson(admin,"/admin/comments?eventId="+event+"&latest=true"))).hasSize(10).startsWith(otherAuthor).doesNotContain(otherEvent);
        assertThat(ids(getJson(admin,"/admin/comments?authorId="+a.id()+"&latest=true"))).hasSize(10).startsWith(otherEvent).doesNotContain(otherAuthor);
        assertThat(ids(getJson(admin,"/admin/comments?latest=true"))).hasSize(10).startsWith(otherEvent,otherAuthor);
    }
    @Test void last24HoursIncludesBoundaryAndCombinesWithBothFiltersAndHiddenComments() throws Exception {
        var a=login("athlete-a");var b=login("athlete-b");var admin=login("admin");
        String event=createEvent(a,"OPEN",10),other=createEvent(a,"OPEN",10);
        comment(a,event,clock.instant().minusSeconds(86401));
        String boundary=comment(a,event,clock.instant().minusSeconds(86400));
        String recent=comment(a,event,clock.instant().minusSeconds(60));
        String byB=comment(b,event,clock.instant().minusSeconds(30));
        String elsewhere=comment(a,other,clock.instant().minusSeconds(10));
        call(admin,"POST","/admin/comments/"+recent+"/hide",Map.of("reason","Проверка скрытого комментария"),200);
        String scoped="/admin/comments?eventId="+event+"&authorId="+a.id()+"&last24Hours=true";
        var result=getJson(admin,scoped);
        assertThat(ids(result)).containsExactly(recent,boundary);
        assertThat(result.path("items").get(0).path("status").asText()).isEqualTo("HIDDEN");
        assertThat(ids(getJson(admin,scoped+"&latest=true"))).containsExactly(recent,boundary);
        assertThat(ids(getJson(admin,"/admin/comments?last24Hours=true"))).contains(elsewhere,byB,recent,boundary);
        assertThat(ids(getJson(admin,"/admin/comments?eventId="+event+"&last24Hours=true"))).containsExactly(byB,recent,boundary);
        assertThat(ids(getJson(admin,"/admin/comments?authorId="+a.id()+"&last24Hours=true"))).containsExactly(elsewhere,recent,boundary);
    }
    @Test void filtersRemainAdminOnlyAndRejectInvalidParameters() throws Exception {
        var a=login("athlete-a");var admin=login("admin");
        call(null,"GET","/admin/comments?latest=true&last24Hours=true",null,401);
        call(a,"GET","/admin/comments?authorId="+a.id(),null,403);
        for(String query:List.of("authorId=bad","last24Hours=bad","latest=bad","page=-1","size=101"))
            call(admin,"GET","/admin/comments?"+query,null,400);
        call(admin,"GET","/admin/comments?authorId="+UUID.randomUUID(),null,404);
    }
}
