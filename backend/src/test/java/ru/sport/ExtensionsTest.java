package ru.sport;

import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import ru.sport.config.DemoSeed;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test") @Transactional
class ExtensionsTest extends ApiTestSupport {
    @Test void waitlistPromotesFirstAndDoesNotExceedCapacity() throws Exception {
        var owner=login("coach");var a=login("athlete-a");var b=login("athlete-b");var c=login("athlete-c");String event=createEvent(owner,"OPEN",2);
        call(a,"POST","/events/"+event+"/registrations",Map.of(),201);call(b,"POST","/events/"+event+"/registrations",Map.of(),201);
        call(c,"POST","/events/"+event+"/registrations",Map.of(),409);
        assertThat(json(call(c,"POST","/events/"+event+"/waitlist",Map.of(),201)).path("status").asText()).isEqualTo("WAITLISTED");
        call(a,"DELETE","/events/"+event+"/registrations/me",null,200);
        assertThat(getJson(c,"/events/"+event+"/my-registration").path("status").asText()).isEqualTo("CONFIRMED");
        var team=getJson(owner,"/events/"+event+"/team");assertThat(team.path("confirmedCount").asInt()).isEqualTo(2);assertThat(team.path("waitlistedCount").asInt()).isZero();
        call(a,"POST","/events/"+event+"/waitlist",Map.of(),201);
        call(a,"DELETE","/events/"+event+"/waitlist/me",null,200);
    }
    @Test void profileIsEditablePublicAndRatingReadOnly() throws Exception {
        var a=login("athlete-a");var b=login("athlete-b");
        call(a,"PATCH","/me/profile",Map.of("displayName","Новое имя","sportsRoles",List.of("ATHLETE","COACH"),"bio","Люблю спорт"),200);
        var publicProfile=getJson(b,"/users/"+a.id());assertThat(publicProfile.path("displayName").asText()).isEqualTo("Новое имя");assertThat(publicProfile.toString()).doesNotContain("demoAccount","admin","csrfToken");
        call(a,"PATCH","/me/profile",Map.of("ratingPoints",100000),400);
        call(a,"PATCH","/me/profile",Map.of("systemRoles",List.of("ADMIN")),400);
        call(a,"PATCH","/me/profile",Map.of("sportsRoles",List.of("REFEREE","REFEREE")),400);
        call(a,"PATCH","/me/profile",Map.of("avatarUrl","javascript:alert(1)"),400);
        call(a,"PATCH","/me/profile",Map.of("nickname","ATHLETE-B"),409);
        call(a,"PATCH","/me/profile","{\"bio\":null}",200);
        call(a,"GET","/admin/events",null,403);
    }
    @Test void recommendationsExplainActualPreferenceChanges() throws Exception {
        var a=login("athlete-a");var owner=login("coach");String event=createEvent(owner,"OPEN",10);
        String sport=getJson(a,"/events/"+event).path("sport").path("id").asText();
        call(a,"PATCH","/me/profile",Map.of("sportsPreferences",List.of(Map.of("sportId",sport,"level","BEGINNER"))),200);
        var recommendations=getJson(a,"/events/recommended?city=Самара").path("items");
        assertThat(recommendations.toString()).contains("FAVORITE_SPORT",event);
        call(a,"PATCH","/me/profile",Map.of("sportsPreferences",List.of()),200);
        assertThat(getJson(a,"/events/recommended?city=Самара").path("items").toString()).doesNotContain("FAVORITE_SPORT");
    }
    @Test void directConversationIsUniqueAndPrivateEvenFromAdmin() throws Exception {
        var a=login("athlete-a");var b=login("athlete-c");var outsider=login("referee");var admin=login("admin");
        String id=json(call(a,"POST","/conversations",Map.of("type","DIRECT","peerUserId",b.id()),201)).path("id").asText();
        assertThat(json(call(b,"POST","/conversations",Map.of("type","DIRECT","peerUserId",a.id()),200)).path("id").asText()).isEqualTo(id);
        call(a,"POST","/conversations/"+id+"/messages",Map.of("text","Привет, идём играть?"),201);
        assertThat(getJson(b,"/conversations/"+id+"/messages").path("items").get(0).path("author").path("id").asText()).isEqualTo(a.id());
        call(b,"POST","/conversations/"+id+"/messages",Map.of("text","Подмена","authorId",a.id()),400);
        call(outsider,"GET","/conversations/"+id,null,403);call(admin,"GET","/conversations/"+id+"/messages",null,403);
        assertThat(getJson(admin,"/conversations").path("items").toString()).doesNotContain(id);
    }
    @Test void communityRequiresCurrentMembershipAndApprovedOrganization() throws Exception {
        var representative=login("org-approved");var a=login("athlete-c");var org=DemoSeed.id("club-approved").toString();
        String id=json(call(representative,"POST","/conversations",Map.of("type","COMMUNITY","organizationId",org,"title","Группа клуба"),201)).path("id").asText();
        call(a,"GET","/conversations/"+id+"/messages",null,403);
        call(a,"POST","/organizations/"+org+"/memberships",null,201);
        call(a,"POST","/conversations/"+id+"/messages",Map.of("text","Всем привет!"),201);
        assertThat(getJson(representative,"/conversations/"+id+"/messages").path("total").asInt()).isEqualTo(1);
        call(a,"DELETE","/organizations/"+org+"/memberships/me",null,204);
        call(a,"GET","/conversations/"+id,null,403);call(a,"POST","/conversations/"+id+"/messages",Map.of("text","Уже вышла"),403);
        assertThat(getJson(a,"/conversations").path("items").toString()).doesNotContain(id);
        var pending=login("org-pending");call(pending,"POST","/conversations",Map.of("type","COMMUNITY","organizationId",DemoSeed.id("club-pending").toString(),"title","Запрещённая группа"),403);
    }
    @Test void competitionVerificationIsAuthorizedIdempotentAndChangesRank() throws Exception {
        var referee=login("referee");var b=login("athlete-b");var outsider=login("athlete-a");var admin=login("admin");
        String event=DemoSeed.id("competition-3").toString(),registration=DemoSeed.id("competition-reg-3").toString();String path="/competitions/"+event+"/participations/"+registration+"/verify";
        assertThat(getJson(b,"/users/"+b.id()+"/rating").path("points").asInt()).isEqualTo(20);
        call(outsider,"POST",path,Map.of(),403);call(admin,"POST",path,Map.of(),403);
        var ledger=json(call(referee,"POST",path,Map.of("note","Участие подтверждено"),200));
        assertThat(json(call(referee,"POST",path,Map.of(),200)).path("id")).isEqualTo(ledger.path("id"));
        var rating=getJson(b,"/users/"+b.id()+"/rating");assertThat(rating.path("points").asInt()).isEqualTo(30);assertThat(rating.path("rank").asText()).isEqualTo("ACTIVE");
        assertThat(getJson(b,"/users/"+b.id()+"/rating-history").path("total").asInt()).isEqualTo(3);
        assertThat(getJson(b,"/me/profile").path("ratingPoints").asInt()).isEqualTo(30);
    }
    @Test void unfinishedCompetitionCannotAwardPointsAndSportsRoleAloneGrantsNothing() throws Exception {
        var owner=login("coach");var a=login("athlete-a");var referee=login("referee");
        String event=createEvent(owner,"OPEN",10);
        String reg=json(call(a,"POST","/events/"+event+"/registrations",Map.of(),201)).path("id").asText();
        call(owner,"POST","/competitions/"+event+"/participations/"+reg+"/verify",Map.of(),409);
        call(referee,"POST","/competitions/"+event+"/participations/"+reg+"/verify",Map.of(),403);
        call(owner,"POST","/competitions/"+DemoSeed.id("competition-3")+"/referees",Map.of("userId",a.id()),422);
    }
    @Test void loginCsrfSurvivesSequentialReadsWritesAndLogout() throws Exception {
        var a=login("athlete-a");
        assertThat(getJson(a,"/session").path("csrfToken").asText()).isEqualTo(a.csrf());
        call(a,"PATCH","/me/profile",Map.of("bio","Первое изменение"),200);
        assertThat(getJson(a,"/session").path("csrfToken").asText()).isEqualTo(a.csrf());
        call(a,"PATCH","/me/profile",Map.of("bio","Второе изменение"),200);
        assertThat(getJson(a,"/me/profile").path("bio").asText()).isEqualTo("Второе изменение");
        var invalid=mvc.perform(patch("/api/v1/me/profile").session(a.session()).header("X-CSRF-Token","invalid")
            .contentType("application/json").content("{\"bio\":\"Подмена\"}")).andReturn();
        assertThat(invalid.getResponse().getStatus()).isEqualTo(403);
        call(a,"DELETE","/demo/session",null,204);
        assertThat(a.session().isInvalid()).isTrue();
        call(null,"GET","/session",null,401);
    }
    @Test void csrfUnknownFieldsAndSessionRotation() throws Exception {
        var a=login("athlete-a");
        var result=mvc.perform(patch("/api/v1/me/profile").session(a.session()).contentType("application/json").content("{\"displayName\":\"test\"}")).andReturn();
        assertThat(result.getResponse().getStatus()).isEqualTo(403);
        assertThat(json(result).path("requestId").asText()).isNotBlank();
        call(null,"GET","/me/profile",null,401);
        call(a,"POST","/demo/session",Map.of("accountId","athlete-a","role","ADMIN"),400);
        var rotated=mvc.perform(post("/api/v1/demo/session").session(a.session()).contentType("application/json").content("{\"accountId\":\"athlete-b\"}")).andReturn();
        assertThat(rotated.getResponse().getStatus()).isEqualTo(200);assertThat(a.session().isInvalid()).isTrue();
        assertThat(json(rotated).path("csrfToken").asText()).isNotEqualTo(a.csrf());
    }
    @Test void draftsArePrivateAndCanBePublishedOnlyByOwner() throws Exception {
        var owner=login("coach");var a=login("athlete-a");String id=DemoSeed.id("event-draft").toString();
        call(a,"GET","/events/"+id,null,404);call(a,"POST","/events/"+id+"/publish",null,403);
        call(owner,"POST","/events/"+id+"/publish",null,200);call(a,"GET","/events/"+id,null,200);
        call(owner,"POST","/events/"+id+"/publish",null,409);
    }
}
