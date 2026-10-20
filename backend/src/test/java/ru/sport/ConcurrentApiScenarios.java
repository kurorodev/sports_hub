package ru.sport;

import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import ru.sport.config.DemoSeed;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;

/** The same concurrent HTTP scenarios run against H2 and PostgreSQL. */
@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test")
abstract class ConcurrentApiScenarios extends ApiTestSupport {
    private List<org.springframework.test.web.servlet.MvcResult> race(Actor first,Actor second,String path,Object firstBody,Object secondBody) throws Exception {
        return race(first,second,path,firstBody,path,secondBody);
    }
    private List<org.springframework.test.web.servlet.MvcResult> race(Actor first,Actor second,String firstPath,Object firstBody,String secondPath,Object secondBody) throws Exception {
        var ready=new CountDownLatch(2);var start=new CountDownLatch(1);
        try(var pool=Executors.newFixedThreadPool(2)) {
            List<Future<org.springframework.test.web.servlet.MvcResult>> futures=new ArrayList<>();
            var actors=List.of(first,second);var bodies=List.of(firstBody,secondBody);var paths=List.of(firstPath,secondPath);
            for(int i=0;i<2;i++){final int index=i;futures.add(pool.submit(()->{ready.countDown();if(!start.await(10,TimeUnit.SECONDS))throw new IllegalStateException("Race barrier timed out");return mvc.perform(post(api(paths.get(index))).session(actors.get(index).session()).header("X-CSRF-Token",actors.get(index).csrf()).contentType("application/json").content(mapper.writeValueAsString(bodies.get(index)))).andReturn();}));}
            assertThat(ready.await(10,TimeUnit.SECONDS)).isTrue();start.countDown();
            return List.of(futures.get(0).get(20,TimeUnit.SECONDS),futures.get(1).get(20,TimeUnit.SECONDS));
        }
    }
    @Test void concurrentOpenJoinCannotTakeLastSeatTwice() throws Exception {
        var owner=login("coach");var a=login("athlete-a");var b=login("athlete-b");var c=login("athlete-c");String event=createEvent(owner,"OPEN",2);
        call(a,"POST","/events/"+event+"/registrations",Map.of(),201);
        var results=race(b,c,"/events/"+event+"/registrations",Map.of(),Map.of());
        assertThat(results.stream().map(r->r.getResponse().getStatus()).sorted().toList()).containsExactly(201,409);
        assertThat(getJson(owner,"/events/"+event+"/team").path("confirmedCount").asInt()).isEqualTo(2);
    }
    @Test void concurrentApprovalCannotTakeLastSeatTwice() throws Exception {
        var owner=login("coach");var a=login("athlete-a");var b=login("athlete-b");var c=login("athlete-c");String event=createEvent(owner,"APPROVAL",2);
        String first=json(call(a,"POST","/events/"+event+"/registrations",Map.of(),201)).path("id").asText();
        String second=json(call(b,"POST","/events/"+event+"/registrations",Map.of(),201)).path("id").asText();
        String third=json(call(c,"POST","/events/"+event+"/registrations",Map.of(),201)).path("id").asText();
        String prefix="/events/"+event+"/registrations/";
        call(owner,"POST",prefix+first+"/decision",Map.of("decision","APPROVE"),200);
        var results=race(owner,owner,prefix+second+"/decision",Map.of("decision","APPROVE"),prefix+third+"/decision",Map.of("decision","APPROVE"));
        assertThat(results.stream().map(r->r.getResponse().getStatus()).sorted().toList()).containsExactly(200,409);
        assertThat(getJson(owner,"/events/"+event+"/team").path("confirmedCount").asInt()).isEqualTo(2);
    }
    @Test void concurrentDuplicateRegistrationIsRejected() throws Exception {
        var owner=login("coach");var a=login("athlete-a");String event=createEvent(owner,"OPEN",10);
        var results=race(a,a,"/events/"+event+"/registrations",Map.of(),Map.of());
        assertThat(results.stream().map(r->r.getResponse().getStatus()).sorted().toList()).containsExactly(201,409);
        assertThat(getJson(owner,"/events/"+event+"/team").path("confirmedCount").asInt()).isEqualTo(1);
    }
    @Test void concurrentVerificationCreatesOneLedgerEntry() throws Exception {
        var owner=login("coach");var referee=login("referee");var athlete=login("athlete-b");
        String path="/competitions/"+DemoSeed.id("competition-3")+"/participations/"+DemoSeed.id("competition-reg-3")+"/verify";
        var results=race(owner,referee,path,Map.of(),Map.of());
        assertThat(results.stream().map(r->r.getResponse().getStatus()).toList()).containsOnly(200);
        assertThat(json(results.get(0)).path("id")).isEqualTo(json(results.get(1)).path("id"));
        assertThat(getJson(athlete,"/users/"+athlete.id()+"/rating").path("points").asInt()).isEqualTo(30);
    }
    @Test void concurrentDirectCreationReturnsSameConversation() throws Exception {
        var a=login("athlete-c");var b=login("referee");
        var results=race(a,b,"/conversations",Map.of("type","DIRECT","peerUserId",b.id()),Map.of("type","DIRECT","peerUserId",a.id()));
        assertThat(results.stream().map(r->r.getResponse().getStatus()).sorted().toList()).containsExactly(200,201);
        assertThat(json(results.get(0)).path("id")).isEqualTo(json(results.get(1)).path("id"));
    }
}
