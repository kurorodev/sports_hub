package ru.dvizh;

import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test") @Transactional
class SportsCatalogTest extends ApiTestSupport {
    @Test void fixedRegistryAndOtherNeverGrowThroughEventCreation() throws Exception {
        var before=getJson(null,"/sports");
        assertThat(before).hasSize(201);
        var codes=new HashSet<String>();String official=null,other=null;
        for(var sport:before) {
            if(sport.path("isCustom").asBoolean()) {
                assertThat(other).isNull();other=sport.path("id").asText();
                assertThat(sport.path("name").asText()).isEqualTo("Другое");
                assertThat(sport.path("registryCode").isNull()).isTrue();
            } else {
                assertThat(codes.add(sport.path("registryCode").asText())).isTrue();
                if(sport.path("name").asText().equals("Шахматы"))official=sport.path("id").asText();
            }
        }
        assertThat(codes).hasSize(200);assertThat(other).isNotNull();assertThat(official).isNotNull();
        var owner=login("athlete-a");var viewer=login("athlete-b");
        String id=createEvent(owner,"OPEN",10);
        var custom=getJson(viewer,"/events/"+id);
        assertThat(custom.path("sport").path("id").asText()).isEqualTo(other);
        assertThat(custom.path("customSportName").asText()).isEqualTo("Флорбол");
        assertThat(getJson(null,"/sports")).isEqualTo(before);
        assertThat(getJson(null,"/sports?q=Флорбол")).hasSize(1); // Official category, independent of the custom label.
        assertThat(getJson(viewer,"/events?q=Флорбол").path("items").toString()).contains(id);
        var body=new LinkedHashMap<String,Object>();
        body.put("title","Шахматы в парке");body.put("description","Играем в шахматы и разбираем партии вместе");
        body.put("sport",Map.of("sportId",official));body.put("startsAt",java.time.Instant.now().plusSeconds(864000).toString());
        body.put("location",Map.of("city","Самара","address","Парк"));body.put("joinMode","OPEN");body.put("organizer",Map.of("type","USER","id",owner.id()));
        var event=json(call(owner,"POST","/events",body,201));
        assertThat(event.path("sport").path("name").asText()).isEqualTo("Шахматы");
        assertThat(event.path("customSportName").isNull()).isTrue();
        body.put("sport",Map.of("sportId",UUID.randomUUID()));call(owner,"POST","/events",body,404);
        body.put("sport",Map.of("customName","Неподходящая общая категория"));
        var another=json(call(owner,"POST","/events",body,201));
        assertThat(another.path("sport").path("id").asText()).isEqualTo(other);
        assertThat(getJson(null,"/sports?q=Неподходящая")).isEmpty();
        assertThat(getJson(null,"/sports")).isEqualTo(before);
    }
}
