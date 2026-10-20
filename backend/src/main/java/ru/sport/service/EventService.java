package ru.sport.service;

import java.time.*;
import java.util.*;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.sport.api.*;
import ru.sport.domain.*;
import ru.sport.persistence.Store;

@Service @Transactional(readOnly=true)
public class EventService {
    private final Store db;private final Access access;private final Views view;private final PatchValidator validator;private final Clock clock;private final SportsCatalog catalog;private final NotificationService notifications;
    public EventService(Store db,Access access,Views view,PatchValidator validator,Clock clock,SportsCatalog catalog,NotificationService notifications) { this.db=db;this.access=access;this.view=view;this.validator=validator;this.clock=clock;this.catalog=catalog;this.notifications=notifications; }
    public List<Api.Sport> sports(String q) {
        return db.list(SportEntity.class,"e.canonicalId is null and lower(e.name) like :q",Map.of("q",like(q)),"e.isCustom asc,e.name asc,e.id asc",0,Integer.MAX_VALUE).stream().map(view::sport).toList();
    }
    @Transactional public Api.Event create(Api.EventCreate r) {
        var actor=access.user();
        var e=new EventEntity();
        if(r.organizer().type()==Api.OrganizerType.USER) {
            if(!actor.id.equals(r.organizer().id()))throw Problem.forbidden();
            e.organizerUserId=actor.id;
        } else {
            var org=db.get(OrganizationEntity.class,r.organizer().id());
            if(!access.represents(org))throw Problem.forbidden();access.approved(org);e.organizerOrganizationId=org.id;
        }
        e.title=r.title().strip();e.description=r.description().strip();e.sportId=resolveSport(r.sport()).id;
        if(r.sport().customName()!=null)e.customSportName=r.sport().customName().strip().replaceAll("\\s+"," ");
        e.eventKind=r.eventKind()==null?Api.EventKind.ACTIVITY:r.eventKind();e.startsAt=r.startsAt();e.endsAt=r.endsAt();
        e.skillLevel=r.skillLevel()==null?Api.EventSkillLevel.ANY:r.skillLevel();e.requirements=r.requirements();e.joinMode=r.joinMode();
        e.maxParticipants=r.maxParticipants();location(e,r.location());
        validateTime(e);e.status=Boolean.FALSE.equals(r.publishNow())?Api.EventStatus.DRAFT:Api.EventStatus.PUBLISHED;
        e.createdAt=clock.instant();e.updatedAt=e.createdAt;db.add(e);if(e.status==Api.EventStatus.PUBLISHED)publishedNotification(e);db.flush();return view.event(e);
    }
    private SportEntity resolveSport(Api.SportInput input) {
        if((input.sportId()==null)==(input.customName()==null))throw Problem.invalid("Укажите sportId либо customName");
        if(input.sportId()!=null)return catalog.resolve(input.sportId());
        String name=input.customName().strip().replaceAll("\\s+"," ");
        if(name.length()<2 || name.length()>80)throw Problem.invalid("Название спорта: от 2 до 80 символов");
        return catalog.other();
    }
    private void location(EventEntity e,Api.Location l) { e.city=l.city().strip();e.address=l.address().strip();e.latitude=l.latitude();e.longitude=l.longitude(); }
    private void validateTime(EventEntity e) {
        if(!e.startsAt.isAfter(clock.instant()))throw Problem.invalid("Дата начала должна быть в будущем");
        if(e.endsAt!=null && !e.endsAt.isAfter(e.startsAt))throw Problem.invalid("Дата окончания должна быть позже начала");
        if(e.eventKind==Api.EventKind.COMPETITION && e.endsAt==null)throw Problem.invalid("Для соревнования укажите endsAt");
    }
    public Api.Event get(UUID id) { var e=db.get(EventEntity.class,id);access.eventVisible(e);return view.event(e); }
    @Transactional public Api.Event patch(UUID id,JsonNode patch) {
        validator.validate("EventPatch",patch);
        var e=db.lock(EventEntity.class,id);access.requireOwner(e);
        if(e.status!=Api.EventStatus.DRAFT && e.status!=Api.EventStatus.PUBLISHED)throw Problem.transition();
        if(!e.startsAt.isAfter(clock.instant()))throw Problem.transition();
        var oldTime=e.startsAt;var oldPlace=Arrays.asList(e.city,e.address,e.latitude,e.longitude);
        if(patch.has("title"))e.title=patch.path("title").asText().strip();
        if(patch.has("description"))e.description=patch.path("description").asText().strip();
        if(patch.has("startsAt"))e.startsAt=OffsetDateTime.parse(patch.path("startsAt").asText()).toInstant();
        if(patch.has("endsAt"))e.endsAt=patch.path("endsAt").isNull()?null:OffsetDateTime.parse(patch.path("endsAt").asText()).toInstant();
        if(patch.has("requirements"))e.requirements=ProfileService.text(patch,"requirements");
        if(patch.has("skillLevel"))e.skillLevel=Api.EventSkillLevel.valueOf(patch.path("skillLevel").asText());
        if(patch.has("location")) {
            var l=patch.path("location");e.city=l.path("city").asText().strip();e.address=l.path("address").asText().strip();
            e.latitude=l.path("latitude").isMissingNode()||l.path("latitude").isNull()?null:l.path("latitude").asDouble();
            e.longitude=l.path("longitude").isMissingNode()||l.path("longitude").isNull()?null:l.path("longitude").asDouble();
        }
        if(patch.has("maxParticipants")) {
            Integer max=patch.path("maxParticipants").isNull()?null:patch.path("maxParticipants").asInt();
            if(max!=null && max<view.registrations(e.id,Api.RegistrationStatus.CONFIRMED))throw Problem.conflict(Api.ErrorCode.EVENT_FULL,"Лимит меньше числа участников");
            if(e.joinMode==Api.JoinMode.OPEN && view.registrations(e.id,Api.RegistrationStatus.WAITLISTED)>0 && !Objects.equals(max,e.maxParticipants))
                throw Problem.conflict(Api.ErrorCode.CONFLICT,"Сначала освободите очередь ожидания; изменение лимита при наличии очереди запрещено");
            e.maxParticipants=max;
        }
        validateTime(e);e.updatedAt=clock.instant();
        if(e.status==Api.EventStatus.PUBLISHED && (!oldTime.equals(e.startsAt) || !oldPlace.equals(Arrays.asList(e.city,e.address,e.latitude,e.longitude))))notifications.updated(e);
        return view.event(e);
    }
    @Transactional public Api.Event publish(UUID id) {
        var e=db.lock(EventEntity.class,id);access.requireOwner(e);
        if(e.status!=Api.EventStatus.DRAFT)throw Problem.transition();validateTime(e);
        e.status=Api.EventStatus.PUBLISHED;e.updatedAt=clock.instant();publishedNotification(e);return view.event(e);
    }
    private void publishedNotification(EventEntity e) {
        notifications.send(notifications.owner(e),Api.NotificationType.EVENT_STATUS,"Мероприятие опубликовано",e.title,null,"/events/"+e.id,"published:"+e.id);
    }
    public PageResult<Api.EventCard> search(Map<String,String> filters,int page,int size) {
        var query=filters(filters);
        return cards(query.where,query.params,sort(filters.get("sort")),page,size);
    }
    private record Query(String where,Map<String,Object> params) {}
    private Query filters(Map<String,String> f) {
        Set<String> allowed=Set.of("q","sportId","sport","city","from","to","skillLevel","joinMode","eventKind","organizerType","hasSpots","includePast","sort","page","size","originLatitude","originLongitude","radiusMeters");
        for(String key:f.keySet())if(!allowed.contains(key))throw Problem.invalid("Неизвестный фильтр: "+key);
        StringBuilder where=new StringBuilder("e.status=:published");var p=new HashMap<String,Object>();p.put("published",Api.EventStatus.PUBLISHED);
        if(!bool(f,"includePast",false)) { where.append(" and e.startsAt>=:now");p.put("now",clock.instant()); }
        if(has(f,"q")) { where.append(" and (lower(e.title) like :q or lower(e.description) like :q or lower(e.customSportName) like :q)");p.put("q",like(f.get("q"))); }
        if(has(f,"sportId")) { where.append(" and e.sportId=:sportId");p.put("sportId",catalog.resolve(uuid(f.get("sportId"))).id); }
        if(has(f,"sport")) { where.append(" and (e.sportId in (select s.id from SportEntity s where lower(s.name) like :sport) or lower(e.customSportName) like :sport)");p.put("sport",like(f.get("sport"))); }
        if(has(f,"city")) { where.append(" and lower(e.city)=:city");p.put("city",f.get("city").strip().toLowerCase(Locale.ROOT)); }
        Instant from=has(f,"from")?instant(f.get("from")):null,to=has(f,"to")?instant(f.get("to")):null;
        if(from!=null && to!=null && from.isAfter(to))throw Problem.invalid("from должен быть раньше to");
        if(from!=null){where.append(" and e.startsAt>=:from");p.put("from",from);}
        if(to!=null){where.append(" and e.startsAt<=:to");p.put("to",to);}
        if(has(f,"skillLevel")){where.append(" and e.skillLevel=:skill");p.put("skill",enumValue(Api.EventSkillLevel.class,f.get("skillLevel")));}
        if(has(f,"joinMode")){where.append(" and e.joinMode=:mode");p.put("mode",enumValue(Api.JoinMode.class,f.get("joinMode")));}
        if(has(f,"eventKind")){where.append(" and e.eventKind=:kind");p.put("kind",enumValue(Api.EventKind.class,f.get("eventKind")));}
        if(has(f,"organizerType")){where.append(enumValue(Api.OrganizerType.class,f.get("organizerType"))==Api.OrganizerType.USER?" and e.organizerUserId is not null":" and e.organizerOrganizationId is not null");}
        if(has(f,"hasSpots")) {
            boolean available=bool(f,"hasSpots",true);
            where.append(available?" and (e.maxParticipants is null or e.maxParticipants > (select count(r) from RegistrationEntity r where r.eventId=e.id and r.status=:confirmed))":" and (e.maxParticipants is not null and e.maxParticipants <= (select count(r) from RegistrationEntity r where r.eventId=e.id and r.status=:confirmed))");
            p.put("confirmed",Api.RegistrationStatus.CONFIRMED);
        }
        where.append(EventDistance.condition(f,p));
        return new Query(where.toString(),p);
    }
    public PageResult<Api.Event> mine(Api.EventStatus status,int page,int size) {
        UUID user=access.user().id;
        String condition="(e.organizerUserId=:user or e.organizerOrganizationId in (select o.id from OrganizationEntity o where o.createdBy=:user))";
        Map<String,Object> p=new HashMap<>(Map.of("user",user));
        if(status!=null){condition+=" and e.status=:status";p.put("status",status);}
        return details(condition,p,"e.createdAt desc,e.id asc",page,size);
    }
    public PageResult<Api.Event> admin(String q,Api.EventStatus status,int page,int size) {
        access.requireAdmin();String condition="(lower(e.title) like :q or lower(e.description) like :q or lower(e.customSportName) like :q)";Map<String,Object> p=new HashMap<>(Map.of("q",like(q)));
        if(status!=null){condition+=" and e.status=:status";p.put("status",status);}
        return details(condition,p,"e.createdAt desc,e.id asc",page,size);
    }
    public PageResult<Api.EventCard> organization(UUID id,int page,int size) {
        var org=db.get(OrganizationEntity.class,id);access.organizationVisible(org);
        String condition="e.organizerOrganizationId=:org";Map<String,Object> p=new HashMap<>(Map.of("org",id));
        if(!access.represents(org) && !access.admin()){condition+=" and e.status=:status";p.put("status",Api.EventStatus.PUBLISHED);}
        return cards(condition,p,"e.startsAt asc,e.id asc",page,size);
    }
    public PageResult<Api.EventCard> cards(String condition,Map<String,?> p,String order,int page,int size) {
        int offset=PageResult.offset(page,size);
        return PageResult.of(db.list(EventEntity.class,condition,p,order,offset,size).stream().map(view::card).toList(),page,size,db.count(EventEntity.class,condition,p));
    }
    public PageResult<Api.Event> details(String condition,Map<String,?> p,String order,int page,int size) {
        int offset=PageResult.offset(page,size);
        return PageResult.of(db.list(EventEntity.class,condition,p,order,offset,size).stream().map(view::event).toList(),page,size,db.count(EventEntity.class,condition,p));
    }
    public PageResult<Api.RecommendedEvent> recommendations(String city,int page,int size) {
        var u=access.user();int offset=PageResult.offset(page,size);
        Map<String,String> f=city==null?Map.of():Map.of("city",city);var query=filters(f);
        List<Api.RecommendedEvent> ranked=db.list(EventEntity.class,query.where,query.params).stream().map(e -> {
            var reasons=new ArrayList<Api.MatchReason>();int score=0;
            var preference=u.sportsPreferences.stream().filter(p -> p.sportId.equals(e.sportId)).findFirst();
            if(preference.isPresent()){score+=50;reasons.add(Api.MatchReason.FAVORITE_SPORT);}
            if(e.skillLevel==Api.EventSkillLevel.ANY || preference.map(p -> p.level.name().equals(e.skillLevel.name())).orElse(false)) {score+=20;reasons.add(Api.MatchReason.SUITABLE_LEVEL);}
            int hour=e.startsAt.atZone(ZoneOffset.UTC).getHour();
            String time=hour<6?"EVENING":hour<12?"MORNING":hour<18?"DAY":"EVENING";
            if(u.preferredTime!=null && (u.preferredTime.equals("ANY") || u.preferredTime.equals(time))){score+=20;reasons.add(Api.MatchReason.PREFERRED_TIME);}
            Integer spots=view.spots(e);if(spots==null || spots>0){score+=10;reasons.add(Api.MatchReason.AVAILABLE_SPOTS);}
            return new Api.RecommendedEvent(view.card(e),score,reasons);
        }).sorted(Comparator.comparingInt((Api.RecommendedEvent r) -> r.score()).reversed().thenComparing(r -> r.event().startsAt()).thenComparing(r -> r.event().id().toString())).toList();
        return PageResult.of(ranked.stream().skip(offset).limit(size).toList(),page,size,ranked.size());
    }
    private String sort(String value) {
        if(value==null)return "e.startsAt asc,e.id asc";
        return switch(value){case "startsAt,asc" -> "e.startsAt asc,e.id asc";case "startsAt,desc" -> "e.startsAt desc,e.id asc";case "createdAt,desc" -> "e.createdAt desc,e.id asc";default -> throw Problem.invalid("Неизвестная сортировка");};
    }
    public static String like(String value) { return "%"+(value==null?"":value.strip().toLowerCase(Locale.ROOT))+"%"; }
    private boolean has(Map<String,String> f,String key){return f.containsKey(key)&&!f.get(key).isBlank();}
    private boolean bool(Map<String,String> f,String key,boolean fallback){if(!f.containsKey(key))return fallback;if(!Set.of("true","false").contains(f.get(key)))throw Problem.invalid("Некорректный boolean: "+key);return Boolean.parseBoolean(f.get(key));}
    private Instant instant(String value){try{return OffsetDateTime.parse(value).toInstant();}catch(java.time.DateTimeException ex){throw Problem.invalid("Укажите время ISO 8601 с часовым поясом");}}
    private UUID uuid(String value){try{return UUID.fromString(value);}catch(IllegalArgumentException ex){throw Problem.invalid("Некорректный UUID");}}
    private <T extends Enum<T>> T enumValue(Class<T> type,String value){try{return Enum.valueOf(type,value);}catch(IllegalArgumentException ex){throw Problem.invalid("Неизвестное значение фильтра");}}
}
