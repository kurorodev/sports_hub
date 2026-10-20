package ru.sport.config;

import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import ru.sport.api.Api;
import ru.sport.domain.*;
import ru.sport.persistence.Store;

/** Only fictional accounts, enabled explicitly with the demo profile. Never resets user data. */
@Component @ConditionalOnProperty(name="app.demo-enabled",havingValue="true")
public class DemoSeed implements ApplicationRunner {
    private final Store db;private final Clock clock;
    public DemoSeed(Store db,Clock clock){this.db=db;this.clock=clock;}
    public static UUID id(String key){return UUID.nameUUIDFromBytes(("sport:"+key).getBytes(StandardCharsets.UTF_8));}
    private <T extends BaseEntity> T save(T e,String key){e.id=id(key);e.createdAt=clock.instant();e.updatedAt=e.createdAt;return db.add(e);}
    @Override @Transactional public void run(ApplicationArguments args) {
        if(db.count(UserEntity.class,"e.demoAccount is not null",Map.of())>0){
            db.first(UserEntity.class,"e.demoAccount=:account",Map.of("account","admin")).ifPresent(admin->{
                if(admin.displayName.startsWith("Администратор "))admin.displayName="Администратор";
            });
            seedMap();return;
        }
        var a=user("athlete-a","Алексей Спортов",false,Api.SportsRole.ATHLETE);
        var b=user("athlete-b","Мария Беговая",false,Api.SportsRole.ATHLETE);
        var c=user("athlete-c","Ирина Новая",false,Api.SportsRole.ATHLETE);
        var coach=user("coach","Денис Тренеров",false,Api.SportsRole.COACH,Api.SportsRole.SPORTS_ORGANIZER);
        var referee=user("referee","Ольга Судейская",false,Api.SportsRole.REFEREE);
        var approved=user("org-approved","Представитель клуба «Темп»",false,Api.SportsRole.SPORTS_ORGANIZER);
        var pending=user("org-pending","Представитель «Новый старт»",false,Api.SportsRole.SPORTS_ORGANIZER);
        var rejected=user("org-rejected","Представитель «Вектор»",false,Api.SportsRole.SPORTS_ORGANIZER);
        var admin=user("admin","Администратор",true);
        var football=sport("football","Футбол");var running=sport("running","Легкая атлетика");var chess=sport("chess","Шахматы");
        a.sportsPreferences.add(new SportPreference(football.id,Api.ExperienceLevel.AMATEUR));a.preferredTime="EVENING";
        b.sportsPreferences.add(new SportPreference(running.id,Api.ExperienceLevel.BEGINNER));b.preferredTime="MORNING";
        var club=organization("club-approved","Клуб «Темп»",approved,Api.OrganizationStatus.APPROVED,football,admin);
        organization("club-pending","Новый старт",pending,Api.OrganizationStatus.PENDING,running,admin);
        organization("club-rejected","Вектор",rejected,Api.OrganizationStatus.REJECTED,chess,admin);
        var open=event("event-open","Футбол во дворе",coach,null,football,Api.JoinMode.OPEN,Api.EventKind.ACTIVITY,3,2);
        var approval=event("event-approval","Шахматы: учимся вместе",coach,null,chess,Api.JoinMode.APPROVAL,Api.EventKind.ACTIVITY,8,3);
        event("event-org","Бег с клубом «Темп»",null,club,running,Api.JoinMode.OPEN,Api.EventKind.ACTIVITY,15,4);
        var full=event("event-full","Команда уже собрана",coach,null,football,Api.JoinMode.OPEN,Api.EventKind.ACTIVITY,2,5);
        registration("reg-open-a",open,a,Api.RegistrationStatus.CONFIRMED);
        registration("reg-approval-a",approval,a,Api.RegistrationStatus.PENDING);
        registration("reg-approval-b",approval,b,Api.RegistrationStatus.PENDING);
        registration("reg-approval-c",approval,c,Api.RegistrationStatus.REJECTED);
        registration("reg-full-a",full,a,Api.RegistrationStatus.CONFIRMED);
        registration("reg-full-b",full,b,Api.RegistrationStatus.CONFIRMED);
        registration("reg-full-c",full,c,Api.RegistrationStatus.WAITLISTED);
        comment("comment-question",open,b,"Подойдёт ли встреча новичку?");
        comment("comment-answer",open,coach,"Да, всем поможем освоиться. Возьмите воду!");
        comment("comment-moderate",open,c,"Комментарий для демонстрации модерации");
        var unpublished=event("event-unpublished","Снятая встреча",coach,null,running,Api.JoinMode.OPEN,Api.EventKind.ACTIVITY,10,6);
        unpublished.status=Api.EventStatus.UNPUBLISHED;unpublished.moderationReason="Площадка закрыта на ремонт";
        registration("reg-unpublished-a",unpublished,a,Api.RegistrationStatus.CONFIRMED);
        var draft=event("event-draft","Черновик тренировки",coach,null,running,Api.JoinMode.OPEN,Api.EventKind.ACTIVITY,null,7);draft.status=Api.EventStatus.DRAFT;
        for(int i=1;i<=3;i++) {
            var competition=event("competition-"+i,"Завершённое соревнование №"+i,coach,null,running,Api.JoinMode.OPEN,Api.EventKind.COMPETITION,20,-i);
            var reg=registration("competition-reg-"+i,competition,b,Api.RegistrationStatus.CONFIRMED);
            var staff=new EventStaffEntity();staff.eventId=competition.id;staff.userId=referee.id;staff.assignedBy=coach.id;save(staff,"competition-referee-"+i);
            var p=new ParticipationEntity();p.registrationId=reg.id;p.userId=b.id;p.eventId=competition.id;p.status=i<3?"VERIFIED":"PENDING_VERIFICATION";
            if(i<3){p.verifiedBy=referee.id;p.verifiedAt=clock.instant();}save(p,"competition-participation-"+i);
            if(i<3){var l=new LedgerEntity();l.userId=b.id;l.eventId=competition.id;l.registrationId=reg.id;l.participationId=p.id;l.points=10;l.reason="VERIFIED_COMPETITION_PARTICIPATION";l.verifiedBy=referee.id;l.idempotencyKey="verification:"+reg.id;save(l,"competition-ledger-"+i);}
        }
        var direct=new ConversationEntity();direct.type=Api.ConversationType.DIRECT;
        boolean ordered=a.id.toString().compareTo(b.id.toString())<0;direct.userLowId=ordered?a.id:b.id;direct.userHighId=ordered?b.id:a.id;direct.directKey=direct.userLowId+":"+direct.userHighId;save(direct,"conversation-direct");
        message("message-direct",direct,a,"Привет! Увидимся на футболе?");
        membership("membership-representative",club,approved);membership("membership-athlete",club,a);
        var community=new ConversationEntity();community.type=Api.ConversationType.COMMUNITY;community.organizationId=club.id;community.title="Беседа клуба «Темп»";save(community,"conversation-community");
        message("message-community",community,approved,"Добро пожаловать в клуб!");
        seedMap();db.flush();
    }
    private void seedMap() {
        // Reference point: https://www.wikidata.org/wiki/Q4365616 (53°11'44.02 N, 50°6'3.68 E).
        // These are explicitly fictional sports objects around a real square, not a directory of real venues.
        var owner=db.first(UserEntity.class,"e.demoAccount=:account",Map.of("account","coach"));
        if(owner.isEmpty())return;
        for(int i=0;i<4;i++) {
            String key="map-venue-"+i;
            String name="Демо-площадка № "+(i+1)+" (условный объект)";
            // Existing demo fixtures keep their IDs when the seed namespace changes.
            if(db.count(VenueEntity.class,"e.id=:id or (e.name=:name and e.createdBy=:owner)",Map.of("id",id(key),"name",name,"owner",owner.get().id))>0)continue;
            var v=new VenueEntity();v.name=name;v.normalizedName=v.name.toLowerCase(Locale.ROOT);
            v.city="Самара";v.address="площадь Куйбышева · демонстрационная точка";v.latitude=53.195561+(i%2)*0.001;v.longitude=50.101022+(i/2)*0.001;v.createdBy=owner.get().id;
            save(v,key);
            if(i<3){var r=new VenueOccupancyReportEntity();r.venueId=v.id;r.userId=owner.get().id;r.level=Api.ReportedOccupancyLevel.values()[i];save(r,key+"-report");}
        }
    }
    private UserEntity user(String account,String name,boolean admin,Api.SportsRole... roles){var u=new UserEntity();u.nickname=account;u.normalizedNickname=account;u.displayName=name;u.admin=admin;u.demoAccount=account;u.questionnaireStatus="SKIPPED";u.city="Красноярск";u.sportsRoles.addAll(List.of(roles));return save(u,"user-"+account);}
    private SportEntity sport(String key,String name){return db.first(SportEntity.class,"e.canonicalId is null and e.name=:name",Map.of("name",name)).orElseThrow();}
    private OrganizationEntity organization(String key,String name,UserEntity owner,Api.OrganizationStatus status,SportEntity sport,UserEntity admin){var o=new OrganizationEntity();o.name=name;o.description="Демонстрационное спортивное объединение для совместных занятий";o.createdBy=owner.id;o.status=status;o.sports.add(sport.id);if(status!=Api.OrganizationStatus.PENDING){o.decidedAt=clock.instant();o.decidedBy=admin.id;}if(status==Api.OrganizationStatus.REJECTED)o.decisionReason="Добавьте подробное описание деятельности";return save(o,key);}
    private EventEntity event(String key,String title,UserEntity owner,OrganizationEntity org,SportEntity sport,Api.JoinMode mode,Api.EventKind kind,Integer capacity,int days){var e=new EventEntity();e.title=title;e.description="Совместная спортивная встреча. Приходите знакомиться и заниматься вместе.";e.sportId=sport.id;e.joinMode=mode;e.eventKind=kind;e.maxParticipants=capacity;e.startsAt=clock.instant().plus(days,java.time.temporal.ChronoUnit.DAYS);e.endsAt=e.startsAt.plusSeconds(7200);e.city="Красноярск";e.address="Спортивная площадка, ул. Дружбы, 10";e.requirements="Удобная одежда и вода";e.organizerUserId=owner==null?null:owner.id;e.organizerOrganizationId=org==null?null:org.id;e.status=Api.EventStatus.PUBLISHED;return save(e,key);}
    private RegistrationEntity registration(String key,EventEntity e,UserEntity u,Api.RegistrationStatus status){var r=new RegistrationEntity();r.eventId=e.id;r.userId=u.id;r.status=status;if(status==Api.RegistrationStatus.REJECTED)r.decisionReason="Места в учебной группе закончились";return save(r,key);}
    private void comment(String key,EventEntity event,UserEntity user,String text){var c=new CommentEntity();c.eventId=event.id;c.authorId=user.id;c.text=text;save(c,key);}
    private void message(String key,ConversationEntity conversation,UserEntity user,String text){var m=new MessageEntity();m.conversationId=conversation.id;m.authorId=user.id;m.text=text;save(m,key);conversation.lastMessageAt=m.createdAt;}
    private void membership(String key,OrganizationEntity org,UserEntity user){var m=new MembershipEntity();m.organizationId=org.id;m.userId=user.id;save(m,key);}
}
