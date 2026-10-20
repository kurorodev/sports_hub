package ru.sport;

import java.util.*;
import java.io.ByteArrayOutputStream;
import java.awt.image.BufferedImage;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test") @Transactional
class AdminPanelTest extends ApiTestSupport {
    static String image() throws Exception {
        var out=new ByteArrayOutputStream();ImageIO.write(new BufferedImage(4,3,BufferedImage.TYPE_INT_RGB),"png",out);
        return "data:image/png;base64,"+Base64.getEncoder().encodeToString(out.toByteArray());
    }
    @Test void categoryAndPhotoArePersistentAndPublicButOnlyAdminCanWrite() throws Exception {
        var user=login("athlete-a");var admin=login("admin");String name="Падел "+UUID.randomUUID();
        var body=Map.of("name",name,"imageData",image());
        call(null,"POST","/admin/sports",body,403); // CSRF also protects unauthenticated writes.
        call(user,"POST","/admin/sports",body,403);
        var sport=json(call(admin,"POST","/admin/sports",body,201));String id=sport.path("id").asText();
        assertThat(sport.path("isCustom").asBoolean()).isFalse();
        assertThat(getJson(null,"/sports?q="+name).toString()).contains(id);
        var photo=call(null,"GET",sport.path("imageUrl").asText(),null,200).getResponse();
        assertThat(photo.getContentType()).isEqualTo("image/png");
        assertThat(ImageIO.read(new java.io.ByteArrayInputStream(photo.getContentAsByteArray())).getWidth()).isEqualTo(4);
        call(admin,"POST","/admin/sports",Map.of("name",name.toUpperCase(Locale.ROOT)),409);
        call(user,"PUT","/admin/sports/"+id+"/image",Map.of("imageData",image()),403);
        call(admin,"PUT","/admin/sports/"+id+"/image",Map.of("imageData",image()),200);
        call(admin,"PUT","/admin/sports/"+id+"/image","{\"imageData\":null}",200);
        call(null,"GET","/sports/"+id+"/image",null,404);
        call(admin,"PUT","/admin/sports/"+id+"/image",Map.of("imageData","data:image/png;base64,PHNjcmlwdD4="),400);
        call(admin,"POST","/admin/sports",Map.of("name","   "),400);
        call(admin,"POST","/admin/sports",Map.of("name","Фото "+UUID.randomUUID(),"imageData","https://example.com/photo.png"),400);
    }
    @Test void renameReplaceAndDeletePreserveExistingEvents() throws Exception {
        var admin=login("admin");var owner=login("coach");String name="Категория "+UUID.randomUUID();
        var created=json(call(admin,"POST","/admin/sports",Map.of("name",name,"imageData",image()),201));
        String id=created.path("id").asText(),path="/admin/sports/"+id;
        var body=Map.of("title","Проверка удаления категории","description","Существующее мероприятие должно сохраниться",
            "sport",Map.of("sportId",id),"startsAt",java.time.Instant.now().plusSeconds(864000).toString(),
            "location",Map.of("city","Самара","address","Парк"),"joinMode","OPEN","organizer",Map.of("type","USER","id",owner.id()));
        String event=json(call(owner,"POST","/events",body,201)).path("id").asText();
        call(owner,"PATCH",path,Map.of("name","Чужое название"),403);
        call(owner,"DELETE",path,null,403);
        String renamed="Новое "+UUID.randomUUID();
        var changed=json(call(admin,"PATCH",path,Map.of("name",renamed),200));
        assertThat(changed.path("imageUrl").isTextual()).isTrue();
        assertThat(getJson(null,"/events/"+event).path("sport").path("name").asText()).isEqualTo(renamed);
        var photo=json(call(admin,"PATCH",path,Map.of("imageData",image()),200));
        call(null,"GET",photo.path("imageUrl").asText(),null,200);
        call(admin,"PATCH",path,"{\"imageData\":null}",200);
        call(null,"GET","/sports/"+id+"/image",null,404);
        call(admin,"DELETE",path,null,204);
        call(admin,"DELETE",path,null,204);
        assertThat(getJson(null,"/sports").toString()).doesNotContain(id);
        assertThat(getJson(null,"/events/"+event).path("sport").path("id").asText()).isEqualTo(id);
        call(owner,"POST","/events",body,400);
        call(admin,"PATCH",path,Map.of("name",renamed),404);
        call(admin,"PUT",path+"/image",Map.of("imageData",image()),404);
    }
    @Test void officialCategoriesCanBeChangedButOtherAndDuplicateNamesAreProtected() throws Exception {
        var admin=login("admin");var catalog=getJson(null,"/sports");String official=null,other=null,duplicate=null;
        for(var sport:catalog) {
            if(sport.path("isCustom").asBoolean())other=sport.path("id").asText();
            else if(official==null)official=sport.path("id").asText();
            else if(duplicate==null)duplicate=sport.path("name").asText();
        }
        call(admin,"PATCH","/admin/sports/"+official,Map.of("name",duplicate.toUpperCase(Locale.ROOT)),409);
        call(admin,"PATCH","/admin/sports/"+official,Map.of("name","Обновлённый спорт "+UUID.randomUUID()),200);
        call(admin,"DELETE","/admin/sports/"+official,null,204);
        call(admin,"PATCH","/admin/sports/"+other,Map.of("imageData",image()),200);
        call(admin,"PATCH","/admin/sports/"+other,Map.of("name","Переименовано"),400);
        call(admin,"DELETE","/admin/sports/"+other,null,400);
        var sport=json(call(admin,"POST","/admin/sports",Map.of("name","Валидация "+UUID.randomUUID()),201));
        String path="/admin/sports/"+sport.path("id").asText();
        call(admin,"PATCH",path,Map.of(),400);
        call(admin,"PATCH",path,"{\"name\":null}",400);
        call(admin,"PATCH",path,Map.of("name","  "),400);
        call(admin,"PATCH",path,Map.of("unexpected",true),400);
        call(admin,"PATCH",path,Map.of("imageData","data:image/png;base64,PHNjcmlwdD4="),400);
    }
    @Test void administratorCannotActAsParticipantButCanUseModeration() throws Exception {
        var owner=login("coach");String event=createEvent(owner,"OPEN",5);var admin=login("admin");
        call(admin,"POST","/events",Map.of("title","Администратор","description","Проверка административного аккаунта","sport",Map.of("customName","Падел"),"startsAt",java.time.Instant.now().plusSeconds(864000).toString(),"location",Map.of("city","Самара","address","Парк"),"joinMode","OPEN","organizer",Map.of("type","USER","id",admin.id())),403);
        assertThat(getJson(admin,"/events/"+event+"/team").path("joinAvailable").asBoolean()).isFalse();
        assertThat(getJson(admin,"/events/"+event+"/team").path("waitlistAvailable").asBoolean()).isFalse();
        call(admin,"POST","/events/"+event+"/registrations",Map.of(),403);
        call(admin,"POST","/events/"+event+"/waitlist",Map.of(),403);
        call(admin,"POST","/events/"+event+"/comments",Map.of("text","Проверка"),403);
        call(admin,"POST","/organizations",Map.of("name","Клуб администратора","description","Проверка административного аккаунта"),403);
        call(admin,"PATCH","/me/profile",Map.of("sportsRoles",List.of("ATHLETE")),403);
        call(admin,"PATCH","/me/profile",Map.of("preferredTime","EVENING"),403);
        String sport=getJson(null,"/sports").get(0).path("id").asText();
        call(admin,"PATCH","/me/profile",Map.of("sportsPreferences",List.of(Map.of("sportId",sport,"level","AMATEUR"))),403);
        call(admin,"POST","/map/venues",Map.of("name","Площадка администратора","location",Map.of("city","Самара","address","Парк","latitude",53.195561,"longitude",50.101022)),403);
        call(admin,"POST","/map/venues/"+ru.sport.config.DemoSeed.id("map-venue-0")+"/reports",Map.of("level","LOW"),403);
        assertThat(json(call(admin,"PATCH","/me/profile",Map.of("displayName","Модератор"),200)).path("displayName").asText()).isEqualTo("Модератор");
        assertThat(getJson(admin,"/me/profile").path("sportsRoles")).isEmpty();
        call(admin,"POST","/admin/events/"+event+"/unpublish",Map.of("reason","Проверка модерации"),200);
    }
}
