package ru.sport.service;

import java.time.*;
import java.util.*;
import java.util.stream.Collectors;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.sport.api.*;
import ru.sport.domain.*;
import ru.sport.persistence.Store;

@Service @Transactional
public class SportsMapService {
    private final Store db; private final Access access; private final Views views; private final Clock clock; private final SportsCatalog catalog;
    @PersistenceContext private EntityManager em;
    public SportsMapService(Store db,Access access,Views views,Clock clock,SportsCatalog catalog) { this.db=db;this.access=access;this.views=views;this.clock=clock;this.catalog=catalog; }
    @Transactional(readOnly=true)
    public Api.MapEventsResponse events(String bbox, UUID sportId, int limit, Instant from, Instant to) {
        return events(bbox,sportId,limit,from,to,Map.of());
    }
    @Transactional(readOnly=true)
    public Api.MapEventsResponse events(String bbox, UUID sportId, int limit, Instant from, Instant to,Map<String,String> filters) {
        var bounds=MapBounds.parse(bbox); MapBounds.limit(limit);
        Instant now=clock.instant();
        if(from!=null && to!=null && !from.isBefore(to)) throw Problem.invalid("from должен быть раньше to");
        var params=bounds.parameters(); params.put("status",Api.EventStatus.PUBLISHED); params.put("from",from==null||from.isBefore(now)?now:from);
        String condition=MapBounds.CONDITION+" and e.status=:status and e.startsAt>=:from";
        if(to!=null) {condition+=" and e.startsAt<=:to"; params.put("to",to);}
        if(sportId!=null) {condition+=" and e.sportId=:sport"; params.put("sport",catalog.resolve(sportId).id);}
        condition+=EventDistance.condition(filters,params);
        var rows=db.list(EventEntity.class,condition,params,"e.startsAt asc,e.id asc",0,limit+1);
        return new Api.MapEventsResponse(rows.stream().limit(limit).map(views::card).toList(),rows.size()>limit);
    }
    @Transactional(readOnly=true)
    public Api.MapVenuesResponse venues(String bbox, UUID sportId,int limit) {
        var params=MapBounds.parse(bbox).parameters(); MapBounds.limit(limit);
        String condition=MapBounds.CONDITION;
        if(sportId!=null){condition+=" and e.sportId=:sport";params.put("sport",catalog.resolve(sportId).id);}
        var rows=db.list(VenueEntity.class,condition,params,"e.id asc",0,limit+1);
        return new Api.MapVenuesResponse(items(rows.stream().limit(limit).toList()),rows.size()>limit);
    }
    public Api.VenueMapItem create(Api.VenueCreate input) {
        return create(input,false);
    }
    public Api.VenueMapItem createReviewed(Api.VenueCreate input) {
        access.requireAdmin();return create(input,true);
    }
    private Api.VenueMapItem create(Api.VenueCreate input,boolean reviewed) {
        var user=db.lock(UserEntity.class,(reviewed?access.user():access.participant()).id);
        Instant now=clock.instant();
        if(!reviewed && db.count(VenueEntity.class,"e.createdBy=:user and e.createdAt>:since",Map.of("user",user.id,"since",now.minus(Duration.ofHours(1))))>=3)
            throw new Problem(429,Api.ErrorCode.RATE_LIMITED,"Можно добавить не более 3 площадок за час",3600);
        String name=input.name().trim().replaceAll("\\s+"," ");
        if(name.length()<3) throw Problem.invalid("Название — от 3 символов");
        String normalized=name.toLowerCase(Locale.ROOT);
        var loc=input.location(); MapBounds.coordinates(loc.latitude(),loc.longitude());
        UUID category=input.sportId()==null?null:catalog.resolve(input.sportId()).id;
        var matches=db.list(VenueEntity.class,"e.normalizedName=:name and e.latitude between :south and :north",
            Map.of("name",normalized,"south",loc.latitude()-0.0003,"north",loc.latitude()+0.0003));
        for(var v:matches) if(distance(v.latitude,v.longitude,loc.latitude(),loc.longitude())<=30)
            throw Problem.conflict(Api.ErrorCode.CONFLICT,"Такая площадка уже есть рядом");
        var v=new VenueEntity();v.name=name;v.normalizedName=normalized;v.sportId=category;
        v.city=loc.city().trim();v.address=loc.address().trim();v.latitude=loc.latitude();v.longitude=loc.longitude();v.createdBy=user.id;
        v.createdAt=now;v.updatedAt=now;db.add(v);db.flush();
        return items(List.of(v)).getFirst();
    }
    public Api.VenueMapItem report(UUID venueId,Api.OccupancyReportCreate input) {
        UUID user=access.participant().id;var venue=db.lock(VenueEntity.class,venueId);Instant now=clock.instant();
        if(db.count(VenueOccupancyReportEntity.class,"e.venueId=:venue and e.userId=:user and e.createdAt>:since",
            Map.of("venue",venueId,"user",user,"since",now.minus(Duration.ofMinutes(10))))>0)
            throw new Problem(429,Api.ErrorCode.RATE_LIMITED,"Повторную оценку можно оставить через 10 минут",600);
        var r=new VenueOccupancyReportEntity();r.venueId=venueId;r.userId=user;r.level=input.level();r.peopleCount=input.peopleCount();
        r.createdAt=now;r.updatedAt=now;db.add(r);db.flush();
        return items(List.of(venue)).getFirst();
    }
    private List<Api.VenueMapItem> items(List<VenueEntity> venues) {
        if(venues.isEmpty())return List.of();
        Instant now=clock.instant();var ids=venues.stream().map(v->v.id).toList();
        var reports=db.list(VenueOccupancyReportEntity.class,"e.venueId in :ids and e.createdAt>:since and e.createdAt<=:now",
            Map.of("ids",ids,"since",now.minus(Occupancy.TTL),"now",now)).stream().collect(Collectors.groupingBy(r->r.venueId));
        Map<UUID,Instant> last=new HashMap<>();
        em.createQuery("select r.venueId,max(r.createdAt) from VenueOccupancyReportEntity r where r.venueId in :ids and r.createdAt<=:now group by r.venueId",Object[].class)
            .setParameter("ids",ids).setParameter("now",now).getResultList().forEach(row->last.put((UUID)row[0],(Instant)row[1]));
        var sportIds=venues.stream().map(v->v.sportId).filter(Objects::nonNull).distinct().toList();
        Map<UUID,String> sports=sportIds.isEmpty()?Map.of():db.list(SportEntity.class,"e.id in :ids",Map.of("ids",sportIds)).stream().collect(Collectors.toMap(s->s.id,s->s.name));
        return venues.stream().map(v->new Api.VenueMapItem(v.id,v.name,v.sportId,v.sportId==null?null:sports.get(v.sportId),
            new Api.VenueLocation(v.city,v.address,v.latitude,v.longitude),Occupancy.summarize(reports.getOrDefault(v.id,List.of()),last.get(v.id),now))).toList();
    }
    private static double distance(double a,double b,double c,double d) {
        double x=Math.sin(Math.toRadians(c-a)/2),y=Math.sin(Math.toRadians(d-b)/2);
        return 6371000*2*Math.asin(Math.min(1,Math.sqrt(x*x+Math.cos(Math.toRadians(a))*Math.cos(Math.toRadians(c))*y*y)));
    }
}
