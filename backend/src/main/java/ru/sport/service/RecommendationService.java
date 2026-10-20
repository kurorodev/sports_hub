package ru.sport.service;

import java.text.Normalizer;
import java.time.*;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.sport.api.*;
import ru.sport.domain.*;
import ru.sport.persistence.Store;

/** Сначала учитываем выбранные интересы; возраст проверяем по условиям встречи, не определяя по нему вид спорта. */
@Service @Transactional(readOnly=true)
public class RecommendationService {
    private final Store db;private final Access access;private final Views views;private final Clock clock;
    @PersistenceContext EntityManager em;
    public RecommendationService(Store db,Access access,Views views,Clock clock){this.db=db;this.access=access;this.views=views;this.clock=clock;}
    record Ranked(EventEntity event,int score,List<Api.MatchReason> reasons) {}
    static String normalized(String text){return Normalizer.normalize(text==null?"":text,Normalizer.Form.NFKC).strip().toLowerCase(Locale.ROOT).replace('ё','е').replaceAll("\\s+"," ");}
    static String city(String text){return normalized(text).replaceFirst("^(?:город\\s+|г\\.\\s*|г\\s+)","").strip();}

    public PageResult<Api.RecommendedEvent> recommend(String requestedCity,boolean otherCities,boolean otherSports,int page,int size) {
        var user=access.participant();int offset=PageResult.offset(page,size);var now=clock.instant();
        String selectedCity=city(requestedCity==null?user.city:requestedCity);
        var sports=db.list(SportEntity.class,null,Map.of()).stream().collect(Collectors.toMap(s -> s.id,Function.identity()));
        Map<UUID,UUID> canonical=new HashMap<>();Map<String,UUID> names=new HashMap<>();
        for(var sport:sports.values()) {
            var target=sport.canonicalId==null?sport:sports.get(sport.canonicalId);
            if(target==null || target.archived)continue;
            canonical.put(sport.id,target.id);names.put(normalized(sport.name),target.id);
        }
        Map<UUID,Api.ExperienceLevel> favorites=new HashMap<>();
        for(var pref:user.sportsPreferences)if(canonical.containsKey(pref.sportId))favorites.put(canonical.get(pref.sportId),pref.level);
        var ownedOrgs=db.list(OrganizationEntity.class,"e.createdBy=:user",Map.of("user",user.id)).stream().map(o -> o.id).collect(Collectors.toSet());
        var registered=db.list(RegistrationEntity.class,"e.userId=:user",Map.of("user",user.id)).stream().map(r -> r.eventId).collect(Collectors.toSet());
        var candidates=db.list(EventEntity.class,"e.status=:status and e.startsAt>:now",Map.of("status",Api.EventStatus.PUBLISHED,"now",now));
        // Считаем участников одним запросом, чтобы число обращений к БД не росло с каждой встречей.
        Map<UUID,Long> counts=new HashMap<>();
        for(var row:em.createQuery("select r.eventId,count(r.id) from RegistrationEntity r where r.status=:confirmed and r.eventId in (select e.id from EventEntity e where e.status=:published and e.startsAt>:now) group by r.eventId",Object[].class)
            .setParameter("confirmed",Api.RegistrationStatus.CONFIRMED).setParameter("published",Api.EventStatus.PUBLISHED).setParameter("now",now).getResultList())counts.put((UUID)row[0],(Long)row[1]);
        ZoneId zone=ZoneId.of(user.recommendationTimeZone);
        List<Ranked> ranked=new ArrayList<>();
        for(var event:candidates) {
            if(user.id.equals(event.organizerUserId) || ownedOrgs.contains(event.organizerOrganizationId) || registered.contains(event.id))continue;
            if(!otherCities && !selectedCity.isEmpty() && !selectedCity.equals(city(event.city)))continue;
            UUID sport=canonical.get(event.sportId);if(sport==null)continue;
            // Свободное название, совпавшее с категорией, должно учитываться как интерес к этой категории.
            if(sports.get(sport).isCustom && event.customSportName!=null)sport=names.getOrDefault(normalized(event.customSportName),sport);
            var level=favorites.get(sport);
            if(level==null)level=favorites.get(canonical.get(event.sportId));
            if(!otherSports && !user.sportsPreferences.isEmpty() && level==null)continue;
            if(event.maxParticipants!=null && counts.getOrDefault(event.id,0L)>=event.maxParticipants)continue;
            if(user.recommendationAge!=null && ((event.recommendedMinAge!=null && user.recommendationAge<event.recommendedMinAge) || (event.recommendedMaxAge!=null && user.recommendationAge>event.recommendedMaxAge)))continue;
            int score=5;var reasons=new ArrayList<Api.MatchReason>();reasons.add(Api.MatchReason.AVAILABLE_SPOTS);
            if(level!=null){score+=60;reasons.add(Api.MatchReason.FAVORITE_SPORT);}
            if(event.skillLevel==Api.EventSkillLevel.ANY || (level!=null && event.skillLevel.name().equals(level.name()))) {score+=15;reasons.add(Api.MatchReason.SUITABLE_LEVEL);}
            int hour=event.startsAt.atZone(zone).getHour();String period=hour<6?"NIGHT":hour<12?"MORNING":hour<18?"DAY":"EVENING";
            if(period.equals(user.preferredTime)){score+=10;reasons.add(Api.MatchReason.PREFERRED_TIME);}
            if(user.recommendationAge!=null && (event.recommendedMinAge!=null || event.recommendedMaxAge!=null)){score+=10;reasons.add(Api.MatchReason.SUITABLE_AGE);}
            ranked.add(new Ranked(event,score,reasons));
        }
        ranked.sort(Comparator.comparingInt(Ranked::score).reversed().thenComparing(r -> r.event.startsAt).thenComparing(r -> r.event.id.toString()));
        // Собираем карточки после отбора страницы, чтобы не загружать детали всей выдачи.
        return PageResult.of(ranked.stream().skip(offset).limit(size).map(r -> new Api.RecommendedEvent(views.card(r.event),r.score,r.reasons)).toList(),page,size,ranked.size());
    }
}
