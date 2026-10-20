package ru.sport.service;

import java.util.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import ru.sport.api.*;
import ru.sport.domain.*;
import ru.sport.persistence.Store;

/** Explicit API projections; no entity is serialized by a controller. */
@Component
public class Views {
    private final Store db;
    private final Access access;
    private final ObjectMapper mapper;
    private final int active,experienced,elite;
    public Views(Store db,Access access,ObjectMapper mapper,
        @Value("${app.rating.active-threshold}") int active,
        @Value("${app.rating.experienced-threshold}") int experienced,
        @Value("${app.rating.elite-threshold}") int elite) {
        this.db=db;this.access=access;this.mapper=mapper;this.active=active;this.experienced=experienced;this.elite=elite;
    }
    public static Map<String,Object> fields(Object... pairs) {
        Map<String,Object> values=new LinkedHashMap<>();
        for(int i=0;i<pairs.length;i+=2) values.put((String)pairs[i],pairs[i+1]);
        return values;
    }
    private <T> T dto(Class<T> type,Map<String,Object> fields) { return mapper.convertValue(fields,type); }
    public int points(UUID user) { return Math.max(0,Math.toIntExact(db.sum(LedgerEntity.class,"points","e.userId=:user",Map.of("user",user)))); }
    public Api.Rank rank(int points) { return points>=elite?Api.Rank.ELITE:points>=experienced?Api.Rank.EXPERIENCED:points>=active?Api.Rank.ACTIVE:Api.Rank.ROOKIE; }
    public Api.PublicUser user(UUID id) { return user(db.get(UserEntity.class,id)); }
    public Api.PublicUser user(UserEntity u) {
        return user(u,false);
    }
    private Api.PublicUser user(UserEntity u,boolean organizer) {
        int points=points(u.id);
        return new Api.PublicUser(u.id,u.nickname,u.displayName,AvatarImages.forUser(u,organizer),u.sportsRoles.stream().sorted().toList(),rank(points),points);
    }
    public Api.UserProfile profile(UserEntity u) {
        int points=points(u.id);
        boolean organizer=db.count(OrganizationEntity.class,"e.createdBy=:user and e.status=:status",Map.of("user",u.id,"status",Api.OrganizationStatus.APPROVED))>0;
        return dto(Api.UserProfile.class,fields("id",u.id,"nickname",u.nickname,"displayName",u.displayName,"avatarUrl",AvatarImages.forUser(u,organizer),
            "sportsRoles",u.sportsRoles.stream().sorted().toList(),"rank",rank(points),"ratingPoints",points,
            "firstName",u.firstName,"lastName",u.lastName,"bio",u.bio,"city",u.city,"preferredTime",u.preferredTime,
            "sportsPreferences",u.sportsPreferences.stream().map(p -> new Api.SportsPreference(p.sportId,p.level)).toList(),"createdAt",u.createdAt));
    }
    public Api.Rating rating(UserEntity u) {
        int points=points(u.id);
        int count=(int)db.count(ParticipationEntity.class,"e.userId=:user and e.status='VERIFIED'",Map.of("user",u.id));
        return new Api.Rating(u.id,points,rank(points),count,"v1");
    }
    public Api.Sport sport(SportEntity s) { return new Api.Sport(s.id,s.name,s.isCustom,s.registryCode); }
    public Api.Organization organization(OrganizationEntity o) {
        return dto(Api.Organization.class,fields("id",o.id,"name",o.name,"description",o.description,"avatarUrl",o.avatarUrl,
            "sports",o.sports.stream().sorted().map(id -> sport(db.get(SportEntity.class,id))).toList(),"status",o.status,
            "createdBy",user(db.get(UserEntity.class,o.createdBy),o.status==Api.OrganizationStatus.APPROVED),"decisionReason",o.decisionReason,"createdAt",o.createdAt,"decidedAt",o.decidedAt));
    }
    public long registrations(UUID event,Api.RegistrationStatus status) {
        return db.count(RegistrationEntity.class,"e.eventId=:event and e.status=:status",Map.of("event",event,"status",status));
    }
    public RegistrationEntity viewerRegistration(UUID event) {
        UUID viewer=access.viewerId();
        return viewer==null?null:db.first(RegistrationEntity.class,"e.eventId=:event and e.userId=:user",Map.of("event",event,"user",viewer)).orElse(null);
    }
    public Api.RegistrationStatus viewerStatus(UUID event) { var r=viewerRegistration(event); return r==null?null:r.status; }
    public Integer spots(EventEntity e) { return e.maxParticipants==null?null:Math.max(0,e.maxParticipants-(int)registrations(e.id,Api.RegistrationStatus.CONFIRMED)); }
    public Api.Event event(EventEntity e) {
        Api.OrganizerSummary org;
        if(e.organizerUserId!=null) {
            var u=db.get(UserEntity.class,e.organizerUserId);
            org=new Api.OrganizerSummary(Api.OrganizerType.USER,u.id,u.displayName,AvatarImages.forUser(u,true));
        } else {
            var o=db.get(OrganizationEntity.class,e.organizerOrganizationId);
            org=new Api.OrganizerSummary(Api.OrganizerType.ORGANIZATION,o.id,o.name,o.avatarUrl!=null?o.avatarUrl:AvatarImages.forUser(db.get(UserEntity.class,o.createdBy),o.status==Api.OrganizationStatus.APPROVED));
        }
        return dto(Api.Event.class,fields("id",e.id,"title",e.title,"description",e.description,"eventKind",e.eventKind,
            "customSportName",e.customSportName,"sport",sport(db.get(SportEntity.class,e.sportId)),"startsAt",e.startsAt,"endsAt",e.endsAt,
            "location",new Api.Location(e.city,e.address,e.latitude,e.longitude),"skillLevel",e.skillLevel,"requirements",e.requirements,
            "joinMode",e.joinMode,"maxParticipants",e.maxParticipants,"confirmedCount",registrations(e.id,Api.RegistrationStatus.CONFIRMED),
            "pendingCount",registrations(e.id,Api.RegistrationStatus.PENDING),"spotsLeft",spots(e),"organizer",org,"status",e.status,
            "moderationReason",null,"viewerRegistrationStatus",viewerStatus(e.id),"viewerIsOrganizer",access.owns(e),
            "createdAt",e.createdAt,"updatedAt",e.updatedAt));
    }
    public Api.EventCard card(EventEntity e) {
        var detail=event(e);
        return new Api.EventCard(detail.id(),detail.title(),detail.eventKind(),detail.sport(),detail.startsAt(),detail.location(),detail.skillLevel(),detail.joinMode(),detail.organizer(),detail.maxParticipants(),detail.confirmedCount(),detail.spotsLeft(),detail.viewerRegistrationStatus(),detail.customSportName());
    }
    public Api.Registration registration(RegistrationEntity r) {
        return new Api.Registration(r.id,r.eventId,eventUser(r.userId,db.get(EventEntity.class,r.eventId)),r.status,r.message,r.decisionReason,r.createdAt,r.updatedAt,r.decidedAt);
    }
    public Api.PublicUser eventUser(UUID userId,EventEntity event) {
        UUID owner=event.organizerUserId!=null?event.organizerUserId:db.get(OrganizationEntity.class,event.organizerOrganizationId).createdBy;
        return user(db.get(UserEntity.class,userId),userId.equals(owner));
    }
    public Api.Comment comment(CommentEntity c) {
        return new Api.Comment(c.id,c.eventId,eventUser(c.authorId,db.get(EventEntity.class,c.eventId)),c.text,c.status,c.createdAt,c.updatedAt,c.mentions.stream().map(m -> new Api.Mention(m.userId,m.nickname,m.startIndex,m.endIndex)).toList());
    }
    public Api.RatingLedgerEntry ledger(LedgerEntity l) { return new Api.RatingLedgerEntry(l.id,l.userId,l.eventId,l.registrationId,l.points,l.reason,l.verifiedBy,l.createdAt); }
    public Api.Membership membership(MembershipEntity m) { return new Api.Membership(m.organizationId,user(m.userId),m.status,m.joinedAt); }
    public Api.Message message(MessageEntity m) { return new Api.Message(m.id,m.conversationId,user(m.authorId),m.text,m.createdAt,m.mentions.stream().map(x -> new Api.Mention(x.userId,x.nickname,x.startIndex,x.endIndex)).toList()); }
    public Api.Conversation conversation(ConversationEntity c) {
        List<Api.PublicUser> participants;
        if(c.type==Api.ConversationType.DIRECT) participants=List.of(user(c.userLowId),user(c.userHighId));
        else participants=db.list(MembershipEntity.class,"e.organizationId=:org and e.status=:status",Map.of("org",c.organizationId,"status",Api.MembershipStatus.ACTIVE)).stream().map(m -> user(m.userId)).toList();
        return new Api.Conversation(c.id,c.type,c.title,c.organizationId,participants,c.lastMessageAt,c.createdAt);
    }
}
