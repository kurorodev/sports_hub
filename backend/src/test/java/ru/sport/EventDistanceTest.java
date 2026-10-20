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
import ru.sport.domain.*;
import ru.sport.persistence.Store;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test") @Transactional
class EventDistanceTest extends ApiTestSupport {
    @Autowired Store db;
    @Autowired Clock clock;
    final String prefix="GPS-"+UUID.randomUUID();
    EventEntity event(Double latitude,Double longitude,int offset) {
        var e=new EventEntity();e.title=prefix+"-"+offset;e.description="Встреча для проверки расстояния";
        e.sportId=db.list(SportEntity.class,"e.canonicalId is null",Map.of()).getFirst().id;
        e.organizerUserId=db.list(UserEntity.class,"1=1",Map.of()).getFirst().id;
        e.city="Самара";e.address="Точка встречи";e.latitude=latitude;e.longitude=longitude;
        e.startsAt=clock.instant().plusSeconds(86400+offset);e.joinMode=Api.JoinMode.OPEN;e.status=Api.EventStatus.PUBLISHED;
        db.add(e);return e;
    }
    EventEntity at(double meters,int offset){return event(Math.toDegrees(meters/6371000),0.0,offset);}
    String radius(int meters){return "originLatitude=0&originLongitude=0&radiusMeters="+meters;}
    @Test void filtersBeforePaginationCountAndMapLimitAndCombinesOtherFilters() throws Exception {
        at(6000,0);event(null,null,1);
        var near=at(50,2);var boundary=at(100,3);boundary.joinMode=Api.JoinMode.APPROVAL;
        at(100.2,4);at(5000,5);var hidden=at(10,6);hidden.status=Api.EventStatus.UNPUBLISHED;db.flush();
        String path="/events?q="+prefix+"&size=1&"+radius(100);
        var first=getJson(null,path);
        assertThat(first.path("total").asInt()).isEqualTo(2);
        assertThat(first.path("items").get(0).path("id").asText()).isEqualTo(near.id.toString());
        assertThat(getJson(null,path+"&page=1").path("items").get(0).path("id").asText()).isEqualTo(boundary.id.toString());
        assertThat(getJson(null,path+"&city=Москва").path("total").asInt()).isZero();
        assertThat(getJson(null,path+"&joinMode=APPROVAL").path("total").asInt()).isEqualTo(1);
        assertThat(getJson(null,"/events?q="+prefix+"&"+radius(5000)).path("total").asInt()).isEqualTo(4);
        var map=getJson(null,"/map/events?bbox=-0.1,-0.1,0.1,0.1&limit=1&"+radius(100));
        assertThat(map.path("items").get(0).path("id").asText()).isEqualTo(near.id.toString());
        assertThat(map.path("truncated").asBoolean()).isTrue();
        assertThat(getJson(null,"/map/events?bbox=-0.1,-0.1,0.1,0.1&"+radius(100)).path("items").size()).isEqualTo(2);
    }
    @Test void handlesAntimeridianAndPolarCoordinates() throws Exception {
        var across=event(0.0,-179.9995,0);var pole=event(90.0,180.0,1);db.flush();
        assertThat(getJson(null,"/events?q="+prefix+"&originLatitude=0&originLongitude=179.9995&radiusMeters=200").path("items").get(0).path("id").asText()).isEqualTo(across.id.toString());
        assertThat(getJson(null,"/events?q="+prefix+"&originLatitude=90&originLongitude=0&radiusMeters=100").path("items").get(0).path("id").asText()).isEqualTo(pole.id.toString());
    }
    @Test void rejectsIncompleteInvalidAndNonPresetRadiusOnBothEndpoints() throws Exception {
        for(String invalid:List.of("radiusMeters=100","originLatitude=0&originLongitude=0","originLatitude=0&radiusMeters=100",radius(0),radius(150),radius(5001),radius(-100),
            "originLatitude=NaN&originLongitude=0&radiusMeters=100","originLatitude=91&originLongitude=0&radiusMeters=100","originLatitude=0&originLongitude=181&radiusMeters=100","originLatitude=0&originLongitude=0&radiusMeters=1.5")) {
            call(null,"GET","/events?"+invalid,null,400);
            call(null,"GET","/map/events?bbox=-1,-1,1,1&"+invalid,null,400);
        }
    }
}
