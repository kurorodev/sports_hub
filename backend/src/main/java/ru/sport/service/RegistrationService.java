package ru.sport.service;

import java.time.Clock;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.sport.api.*;
import ru.sport.domain.*;
import ru.sport.persistence.Store;

@Service @Transactional(readOnly=true)
public class RegistrationService {
    private final Store db;private final Access access;private final Views view;private final Clock clock;private final NotificationService notifications;
    public RegistrationService(Store db,Access access,Views view,Clock clock,NotificationService notifications){this.db=db;this.access=access;this.view=view;this.clock=clock;this.notifications=notifications;}
    public void available(EventEntity e) {
        if(e.status!=Api.EventStatus.PUBLISHED || !e.startsAt.isAfter(clock.instant()))
            throw Problem.conflict(Api.ErrorCode.EVENT_NOT_AVAILABLE,"Запись недоступна: событие не опубликовано или уже началось");
    }
    private boolean full(EventEntity e) { return e.maxParticipants!=null && view.registrations(e.id,Api.RegistrationStatus.CONFIRMED)>=e.maxParticipants; }
    private void capacity(EventEntity e) { if(full(e))throw Problem.conflict(Api.ErrorCode.EVENT_FULL,"Свободных мест нет"); }
    @Transactional public Api.Registration join(UUID eventId,Api.RegistrationCreate request,boolean waitlist) {
        var u=access.participant();var e=db.lock(EventEntity.class,eventId);available(e);
        var existing=db.first(RegistrationEntity.class,"e.eventId=:event and e.userId=:user",Map.of("event",eventId,"user",u.id));
        if(existing.isPresent() && existing.get().status!=Api.RegistrationStatus.CANCELLED)
            throw Problem.conflict(Api.ErrorCode.ALREADY_REGISTERED,"Вы уже отправили заявку на это событие");
        if(waitlist) {
            if(e.joinMode!=Api.JoinMode.OPEN || !full(e))throw Problem.transition();
        } else if(e.joinMode==Api.JoinMode.OPEN) capacity(e);
        var r=existing.orElseGet(RegistrationEntity::new);
        r.eventId=eventId;r.userId=u.id;r.message=request.message();r.decisionReason=null;r.decidedAt=null;r.decidedBy=null;r.updatedAt=clock.instant();
        // Rejoining a cancelled registration joins at the end of the queue.
        if(existing.isEmpty())r.createdAt=clock.instant();
        r.status=waitlist?Api.RegistrationStatus.WAITLISTED:e.joinMode==Api.JoinMode.OPEN?Api.RegistrationStatus.CONFIRMED:Api.RegistrationStatus.PENDING;
        if(existing.isEmpty())db.add(r);
        if(r.status==Api.RegistrationStatus.CONFIRMED)participation(e,r);
        notifications.registration(e,r,true);db.flush();return view.registration(r);
    }
    @Transactional public Api.Registration decide(UUID eventId,UUID registrationId,Api.RegistrationDecisionRequest request) {
        var e=db.lock(EventEntity.class,eventId);access.requireOwner(e);available(e);
        var r=db.get(RegistrationEntity.class,registrationId);
        if(!eventId.equals(r.eventId))throw Problem.notFound();
        if(e.joinMode!=Api.JoinMode.APPROVAL || r.status!=Api.RegistrationStatus.PENDING)throw Problem.transition();
        if(request.decision()==Api.Decision.APPROVE){capacity(e);r.status=Api.RegistrationStatus.CONFIRMED;participation(e,r);}
        else r.status=Api.RegistrationStatus.REJECTED;
        r.decisionReason=request.reason();r.decidedBy=access.user().id;r.decidedAt=clock.instant();r.updatedAt=r.decidedAt;notifications.registration(e,r,false);return view.registration(r);
    }
    @Transactional public Api.Registration cancel(UUID eventId,boolean waitlistOnly) {
        var e=db.lock(EventEntity.class,eventId);var u=access.user();
        var r=db.first(RegistrationEntity.class,"e.eventId=:event and e.userId=:user",Map.of("event",eventId,"user",u.id)).orElseThrow(Problem::notFound);
        if(waitlistOnly && r.status!=Api.RegistrationStatus.WAITLISTED)throw Problem.transition();
        if(r.status!=Api.RegistrationStatus.PENDING && r.status!=Api.RegistrationStatus.CONFIRMED && r.status!=Api.RegistrationStatus.WAITLISTED)throw Problem.transition();
        if(!e.startsAt.isAfter(clock.instant()))throw Problem.transition();
        boolean occupied=r.status==Api.RegistrationStatus.CONFIRMED;
        r.status=Api.RegistrationStatus.CANCELLED;r.updatedAt=clock.instant();
        db.first(ParticipationEntity.class,"e.registrationId=:reg",Map.of("reg",r.id)).ifPresent(p -> p.status="CANCELLED");
        db.flush();
        if(occupied && e.joinMode==Api.JoinMode.OPEN && e.status==Api.EventStatus.PUBLISHED) {
            db.list(RegistrationEntity.class,"e.eventId=:event and e.status=:status",Map.of("event",eventId,"status",Api.RegistrationStatus.WAITLISTED),"e.updatedAt asc,e.id asc",0,1).stream().findFirst().ifPresent(next -> {
                next.status=Api.RegistrationStatus.CONFIRMED;next.updatedAt=clock.instant();next.decidedAt=clock.instant();participation(e,next);notifications.registration(e,next,false);
            });
        }
        notifications.registration(e,r,false);return view.registration(r);
    }
    private void participation(EventEntity e,RegistrationEntity r) {
        if(e.eventKind!=Api.EventKind.COMPETITION)return;
        var existing=db.first(ParticipationEntity.class,"e.registrationId=:reg",Map.of("reg",r.id));
        var p=existing.orElseGet(ParticipationEntity::new);p.eventId=e.id;p.registrationId=r.id;p.userId=r.userId;p.status="PENDING_VERIFICATION";
        if(existing.isEmpty())db.add(p);
    }
    public Api.Registration mine(UUID eventId) {
        var u=access.user();db.get(EventEntity.class,eventId);
        return view.registration(db.first(RegistrationEntity.class,"e.eventId=:event and e.userId=:user",Map.of("event",eventId,"user",u.id)).orElseThrow(Problem::notFound));
    }
    public PageResult<Api.Registration> myRegistrations(Api.RegistrationView bucket,Api.RegistrationStatus status,int page,int size) {
        Map<String,Object> p=new HashMap<>(Map.of("user",access.user().id));String condition="e.userId=:user";
        if(status!=null){condition+=" and e.status=:status";p.put("status",status);}
        if(bucket!=null) {
            String active="(e.status in (:active) and e.eventId in (select ev.id from EventEntity ev where ev.status=:published and coalesce(ev.endsAt,ev.startsAt)>:now))";
            condition+=" and "+(bucket==Api.RegistrationView.UPCOMING?active:"not "+active);
            p.put("active",List.of(Api.RegistrationStatus.CONFIRMED,Api.RegistrationStatus.PENDING,Api.RegistrationStatus.WAITLISTED));
            p.put("published",Api.EventStatus.PUBLISHED);p.put("now",clock.instant());
        }
        var items=db.list(RegistrationEntity.class,condition,p,"e.updatedAt desc,e.id asc",PageResult.offset(page,size),size).stream().map(r -> {
            var registration=view.registration(r);
            return new Api.Registration(registration.id(),r.eventId,registration.user(),r.status,r.message,r.decisionReason,r.createdAt,r.updatedAt,r.decidedAt,view.event(db.get(EventEntity.class,r.eventId)));
        }).toList();
        return PageResult.of(items,page,size,db.count(RegistrationEntity.class,condition,p));
    }
    public PageResult<Api.Registration> registrations(UUID eventId,Api.RegistrationStatus status,int page,int size) {
        var e=db.get(EventEntity.class,eventId);access.user();if(!access.owns(e) && !access.admin())throw Problem.forbidden();
        Map<String,Object> p=new HashMap<>(Map.of("event",eventId));String condition="e.eventId=:event";
        if(status!=null){condition+=" and e.status=:status";p.put("status",status);}
        return page(condition,p,page,size);
    }
    private PageResult<Api.Registration> page(String condition,Map<String,?> p,int page,int size) {
        return PageResult.of(db.list(RegistrationEntity.class,condition,p,"e.createdAt asc,e.id asc",PageResult.offset(page,size),size).stream().map(view::registration).toList(),page,size,db.count(RegistrationEntity.class,condition,p));
    }
    public PageResult<Api.PublicUser> participants(UUID eventId,int page,int size) {
        var e=db.get(EventEntity.class,eventId);access.eventVisible(e);
        var p=Map.of("event",eventId,"status",Api.RegistrationStatus.CONFIRMED);String condition="e.eventId=:event and e.status=:status";
        return PageResult.of(db.list(RegistrationEntity.class,condition,p,"e.createdAt asc,e.id asc",PageResult.offset(page,size),size).stream().map(r -> view.eventUser(r.userId,e)).toList(),page,size,db.count(RegistrationEntity.class,condition,p));
    }
    public Api.TeamStatus team(UUID eventId) {
        var e=db.get(EventEntity.class,eventId);access.eventVisible(e);boolean available=e.status==Api.EventStatus.PUBLISHED && e.startsAt.isAfter(clock.instant());
        var viewer=view.viewerStatus(e.id);boolean canJoin=!access.admin() && (viewer==null || viewer==Api.RegistrationStatus.CANCELLED);
        return new Api.TeamStatus(e.id,e.maxParticipants,(int)view.registrations(e.id,Api.RegistrationStatus.CONFIRMED),(int)view.registrations(e.id,Api.RegistrationStatus.PENDING),
            (int)view.registrations(e.id,Api.RegistrationStatus.WAITLISTED),view.spots(e),viewer==null?null:viewer.name(),available && canJoin && (e.joinMode==Api.JoinMode.APPROVAL || !full(e)),available && canJoin && e.joinMode==Api.JoinMode.OPEN && full(e));
    }
}
