package ru.dvizh;

import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test") @Transactional
class AvatarImagesTest extends ApiTestSupport {
    @Test void characterPersistsWhileUniformFollowsActualContext() throws Exception {
        var owner=login("athlete-a");var participant=login("athlete-b");var admin=login("admin");
        var changed=json(call(owner,"PATCH","/me/profile",Map.of("avatarUrl","/avatars/admin/female-03.svg"),200));
        assertThat(changed.path("avatarUrl").asText()).isEqualTo("/avatars/user/female-03.svg");
        assertThat(getJson(null,"/users/"+owner.id()).path("avatarUrl").asText()).isEqualTo("/avatars/user/female-03.svg");
        String event=createEvent(owner,"OPEN",5);
        assertThat(getJson(null,"/events/"+event).path("organizer").path("avatarUrl").asText()).isEqualTo("/avatars/organizer/female-03.svg");
        var comment=json(call(owner,"POST","/events/"+event+"/comments",Map.of("text","Ответ организатора"),201));
        assertThat(comment.path("author").path("avatarUrl").asText()).isEqualTo("/avatars/organizer/female-03.svg");
        String other=createEvent(participant,"OPEN",5);
        call(owner,"POST","/events/"+other+"/registrations",Map.of(),201);
        assertThat(getJson(null,"/events/"+other+"/participants").toString()).contains("/avatars/user/female-03.svg");
        assertThat(json(call(admin,"PATCH","/me/profile",Map.of("avatarUrl","/avatars/user/male-04.svg"),200)).path("avatarUrl").asText()).isEqualTo("/avatars/admin/male-04.svg");
        var adminComment=json(call(admin,"POST","/events/"+event+"/comments",Map.of("text","Ответ администратора"),201));
        assertThat(adminComment.path("author").path("avatarUrl").asText()).isEqualTo("/avatars/admin/male-04.svg");
        assertThat(getJson(login("org-approved"),"/me/profile").path("avatarUrl").asText()).startsWith("/avatars/organizer/");
        assertThat(getJson(login("org-pending"),"/me/profile").path("avatarUrl").asText()).startsWith("/avatars/user/");
    }
    @Test void rejectsUnknownAndUnsafeImagesAndKeepsExternalAvatars() throws Exception {
        var user=login("athlete-a");
        for(String url:List.of("/avatars/admin/male-99.svg","/avatars/user/../admin/male-01.svg","//example.com/a.svg","javascript:alert(1)","https://name:password@example.com/a.png"))
            call(user,"PATCH","/me/profile",Map.of("avatarUrl",url),400);
        String url="https://example.com/avatar.png";
        assertThat(json(call(user,"PATCH","/me/profile",Map.of("avatarUrl",url),200)).path("avatarUrl").asText()).isEqualTo(url);
        call(user,"PATCH","/me/profile","{\"avatarUrl\":null}",200);
        assertThat(getJson(user,"/me/profile").path("avatarUrl").asText()).startsWith("/avatars/user/");
    }
}
