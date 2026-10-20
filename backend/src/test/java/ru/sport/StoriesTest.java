package ru.sport;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.time.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import javax.imageio.ImageIO;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.*;
import org.springframework.context.annotation.*;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test") @Transactional
@Import(StoriesTest.TimeConfig.class)
class StoriesTest extends ApiTestSupport {
    static class StoryClock extends Clock {
        final AtomicReference<Instant> time=new AtomicReference<>(Instant.parse("2030-01-01T12:00:00Z"));
        public ZoneId getZone(){return ZoneOffset.UTC;}
        public Clock withZone(ZoneId zone){return this;}
        public Instant instant(){return time.get();}
    }
    @TestConfiguration static class TimeConfig { @Bean @Primary StoryClock storyClock(){return new StoryClock();} }
    @Autowired StoryClock clock;
    @BeforeEach void resetClock(){clock.time.set(Instant.parse("2030-01-01T12:00:00Z"));}
    Map<String,Object> body() {return new LinkedHashMap<>(Map.of("title","Новость Стечения","text","Встречаемся на городском забеге"));}
    String image() throws Exception {
        var bytes=new ByteArrayOutputStream();ImageIO.write(new BufferedImage(2,2,BufferedImage.TYPE_INT_RGB),"png",bytes);
        return "data:image/png;base64,"+Base64.getEncoder().encodeToString(bytes.toByteArray());
    }
    JsonNode publish(Actor admin,boolean withImage) throws Exception {
        var input=body();if(withImage)input.put("imageData",image());
        return json(call(admin,"POST","/admin/stories",input,201));
    }
    JsonNode story(Actor user,String id) throws Exception {
        for(var item:getJson(user,"/stories").path("items"))if(item.path("id").asText().equals(id))return item;
        throw new AssertionError("Story missing: "+id);
    }
    @Test void onlyAdminsPublishAndDeleteAndCannotChooseLifetime() throws Exception {
        var user=login("athlete-a");var admin=login("admin");
        call(null,"GET","/stories",null,401);
        call(user,"POST","/admin/stories",body(),403);
        var forged=new Actor(admin.session(),"wrong",admin.id());
        call(forged,"POST","/admin/stories",body(),403);
        var input=body();input.put("expiresAt",clock.instant().plusSeconds(3600).toString());
        call(admin,"POST","/admin/stories",input,400);
        var published=publish(admin,false);String id=published.path("id").asText();
        assertThat(Duration.between(Instant.parse(published.path("createdAt").asText()),Instant.parse(published.path("expiresAt").asText()))).isEqualTo(Duration.ofHours(24));
        call(user,"DELETE","/admin/stories/"+id,null,403);
        call(forged,"DELETE","/admin/stories/"+id,null,403);
        call(admin,"DELETE","/admin/stories/"+id,null,204);
        call(admin,"DELETE","/admin/stories/"+id,null,204);
        assertThat(getJson(user,"/stories").path("items").toString()).doesNotContain(id);
        call(user,"POST","/stories/"+id+"/view",null,404);
    }
    @Test void viewsArePersonalAndFirstTimestampIsStable() throws Exception {
        var admin=login("admin");var a=login("athlete-a");var b=login("athlete-b");
        String id=publish(admin,false).path("id").asText();
        assertThat(story(a,id).path("readAt").isNull()).isTrue();
        assertThat(story(b,id).path("readAt").isNull()).isTrue();
        String readAt=json(call(a,"POST","/stories/"+id+"/view",null,200)).path("readAt").asText();
        clock.time.set(clock.instant().plusSeconds(20));
        assertThat(json(call(a,"POST","/stories/"+id+"/view",null,200)).path("readAt").asText()).isEqualTo(readAt);
        assertThat(story(a,id).path("readAt").asText()).isEqualTo(readAt);
        assertThat(story(b,id).path("readAt").isNull()).isTrue();
    }
    @Test void exactlyAt24HoursListMediaAndViewBecomeUnavailable() throws Exception {
        var admin=login("admin");var user=login("athlete-a");
        var published=publish(admin,true);String id=published.path("id").asText();
        String url=published.path("imageUrl").asText();
        call(user,"GET",url,null,200);
        clock.time.set(Instant.parse(published.path("expiresAt").asText()).minusSeconds(1));
        assertThat(story(user,id).path("id").asText()).isEqualTo(id);
        call(user,"GET",url,null,200);
        clock.time.set(Instant.parse(published.path("expiresAt").asText()));
        assertThat(getJson(user,"/stories").path("items").toString()).doesNotContain(id);
        call(user,"GET",url,null,404);call(user,"POST","/stories/"+id+"/view",null,404);
    }
    @Test void deletingImmediatelyRevokesMediaAndInvalidImagesAreRejected() throws Exception {
        var admin=login("admin");var user=login("athlete-a");
        var invalid=body();invalid.put("imageData","data:image/png;base64,bm90IGFuIGltYWdl");
        call(admin,"POST","/admin/stories",invalid,400);
        var published=publish(admin,true);String id=published.path("id").asText();
        call(admin,"DELETE","/admin/stories/"+id,null,204);
        call(user,"GET",published.path("imageUrl").asText(),null,404);
        call(user,"POST","/stories/"+id+"/view",null,404);
    }
}
