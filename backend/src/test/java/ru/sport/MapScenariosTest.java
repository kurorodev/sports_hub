package ru.sport;

import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.*;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.context.annotation.*;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.beans.factory.annotation.Autowired;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;

@SpringBootTest(properties="spring.datasource.url=jdbc:h2:mem:sport_maps;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000")
@AutoConfigureMockMvc @ActiveProfiles("test") @Import(MapScenariosTest.TimeConfig.class)
class MapScenariosTest extends ApiTestSupport {
    static class MutableClock extends Clock {
        AtomicReference<Instant> time=new AtomicReference<>(Instant.parse("2030-01-01T12:00:00Z"));
        public ZoneId getZone(){return ZoneOffset.UTC;} public Clock withZone(ZoneId zone){return this;} public Instant instant(){return time.get();}
    }
    @TestConfiguration static class TimeConfig { @Bean @Primary MutableClock mapClock(){return new MutableClock();} }
    @Autowired MutableClock clock;
    final String bbox="49.8,53.0,50.4,53.5";
    @BeforeEach void resetTime(){clock.time.set(Instant.parse("2030-01-01T12:00:00Z"));}
    Map<String,Object> venueBody(){return Map.of("name","Тестовая площадка "+UUID.randomUUID(),"location",Map.of("city","Самара","address","площадь Куйбышева","latitude",53.195561,"longitude",50.101022));}
    String venue(Actor actor) throws Exception {return json(call(actor,"POST","/map/venues",venueBody(),201)).path("id").asText();}
    @Test void publicReadProtectedWritesCooldownAndExpiry() throws Exception {
        var actor=login("athlete-a");String id=venue(actor);
        assertThat(getJson(null,"/map/venues?bbox="+bbox).path("items").toString()).contains(id);
        call(null,"POST","/map/venues/"+id+"/reports",Map.of("level","LOW"),403);
        assertThat(mvc.perform(post(api("/map/venues/"+id+"/reports")).session(actor.session()).contentType("application/json").content("{\"level\":\"LOW\"}")).andReturn().getResponse().getStatus()).isEqualTo(403);
        var response=json(call(actor,"POST","/map/venues/"+id+"/reports",Map.of("level","LOW","peopleCount",5),201));
        assertThat(response.path("occupancy").path("level").asText()).isEqualTo("LOW");assertThat(response.toString()).doesNotContain("userId","createdBy");
        call(actor,"POST","/map/venues/"+id+"/reports",Map.of("level","HIGH"),429);
        clock.time.set(clock.instant().plusSeconds(5400));
        var items=getJson(null,"/map/venues?bbox="+bbox).path("items");
        for(var item:items)if(item.path("id").asText().equals(id)) { assertThat(item.path("occupancy").path("level").asText()).isEqualTo("UNKNOWN");assertThat(item.path("occupancy").path("reportsCount").asInt()).isZero(); }
    }
    @Test void validationDuplicatesAndRateLimits() throws Exception {
        var actor=login("athlete-b");var body=venueBody();call(actor,"POST","/map/venues",body,201);call(actor,"POST","/map/venues",body,409);
        call(actor,"POST","/map/venues",Map.of("name","bad","location",Map.of("city","Самара","address","Адрес")),400);
        var altered=new HashMap<>(body);altered.put("createdBy",actor.id());call(actor,"POST","/map/venues",altered,400);
        String id=venue(actor);
        for(Object invalid:List.of(Map.of("level","UNKNOWN"),Map.of("level","LOW","peopleCount",1001),Map.of("level","LOW","userId",actor.id())))call(actor,"POST","/map/venues/"+id+"/reports",invalid,400);
        call(actor,"POST","/map/venues/"+UUID.randomUUID()+"/reports",Map.of("level","LOW"),404);
        venue(actor);call(actor,"POST","/map/venues",venueBody(),429);
        for(String invalid:List.of("NaN,53,50,54","50,54,49,53","-180,-90,180,90","49,53,50,54,55"))call(null,"GET","/map/venues?bbox="+invalid,null,400);
        call(null,"GET","/map/events?bbox="+bbox+"&limit=501",null,400);
        call(null,"GET","/map/events?bbox="+bbox+"&from=2030-01-01",null,400);
        call(null,"GET","/geo/suggest?q=ab",null,400);call(null,"GET","/geo/reverse?latitude=NaN&longitude=50",null,400);
        call(null,"GET","/geo/suggest?q=Самара",null,503);
    }
    @Test void eventCoordinatesRoundTripAndPublicationFiltering() throws Exception {
        var actor=login("coach");
        var base=Map.of("title","Событие на карте","description","Спортивная встреча для проверки карты","sport",Map.of("customName","Геоспорт"),"startsAt",clock.instant().plusSeconds(86400).toString(),"location",Map.of("city","Самара","address","площадь Куйбышева","latitude",53.195561,"longitude",50.101022),"joinMode","OPEN","organizer",Map.of("type","USER","id",actor.id()));
        var draft=new HashMap<String,Object>(base);draft.put("publishNow",false);
        var withoutPoint=new HashMap<String,Object>(base);withoutPoint.put("location",Map.of("city","Самара","address","Без координат"));
        String noPoint=json(call(actor,"POST","/events",withoutPoint,201)).path("id").asText();
        String draftId=json(call(actor,"POST","/events",draft,201)).path("id").asText();
        String published=json(call(actor,"POST","/events",base,201)).path("id").asText();
        assertThat(getJson(null,"/events/"+published).path("location").path("latitude").asDouble()).isEqualTo(53.195561);
        var items=getJson(null,"/map/events?bbox="+bbox).path("items").toString();
        assertThat(items).contains(published,"organizer","skillLevel").doesNotContain(draftId,noPoint);
        call(login("admin"),"POST","/admin/events/"+published+"/unpublish",Map.of("reason","Проверка модерации карты"),200);
        assertThat(getJson(actor,"/map/events?bbox="+bbox).toString()).doesNotContain(published);
    }
    @Test void concurrentReportsFromSameUserAreSerialized() throws Exception {
        var actor=login("athlete-c");String id=venue(actor);
        var start=new CountDownLatch(1);
        try(var executor=Executors.newFixedThreadPool(2)) {
            Callable<Integer> work=()->{start.await();return mvc.perform(post(api("/map/venues/"+id+"/reports")).session(actor.session()).header("X-CSRF-Token",actor.csrf()).contentType("application/json").content("{\"level\":\"LOW\"}")).andReturn().getResponse().getStatus();};
            var a=executor.submit(work);var b=executor.submit(work);start.countDown();assertThat(List.of(a.get(20,TimeUnit.SECONDS),b.get(20,TimeUnit.SECONDS))).containsExactlyInAnyOrder(201,429);
        }
    }
}
