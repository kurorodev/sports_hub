package ru.dvizh.service;

import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.dvizh.api.*;
import ru.dvizh.domain.*;
import ru.dvizh.persistence.Store;

@Service @Transactional(readOnly=true)
public class NotificationService {
    private final Store db;
    private final Access access;
    private final Clock clock;
    public NotificationService(Store db,Access access,Clock clock){this.db=db;this.access=access;this.clock=clock;}

    public Api.NotificationPage list(int page,int size) {
        int offset=PageResult.offset(page,size);var now=clock.instant();
        var params=Map.of("user",access.user().id,"since",now.minus(Duration.ofDays(30)),"now",now);
        String where="e.recipientId=:user and e.createdAt>=:since and e.createdAt<=:now";
        long total=db.count(NotificationEntity.class,where,params);
        return new Api.NotificationPage(db.list(NotificationEntity.class,where,params,"e.createdAt desc,e.id desc",offset,size).stream().map(this::dto).toList(),page,size,total,(int)((total+size-1)/size),db.count(NotificationEntity.class,where+" and e.readAt is null",params),now);
    }
    @Transactional public Api.Notification read(UUID id) {
        var user=access.user();var n=db.lock(NotificationEntity.class,id);
        if(!n.recipientId.equals(user.id) || n.createdAt.isBefore(clock.instant().minus(Duration.ofDays(30))))throw Problem.notFound();
        if(n.readAt==null){n.readAt=clock.instant();n.updatedAt=n.readAt;}
        return dto(n);
    }
    @Transactional public void readAll(Instant through) {
        // A conditional update preserves the first read timestamp under concurrent requests.
        var user=access.user();
        var now=clock.instant();if(through.isAfter(now))through=now;
        db.execute("update NotificationEntity e set e.readAt=:now,e.updatedAt=:now,e.version=e.version+1 where e.recipientId=:user and e.readAt is null and e.createdAt>=:since and e.createdAt<=:through",
            Map.of("user",user.id,"now",now,"since",now.minus(Duration.ofDays(30)),"through",through));
    }
    private Api.Notification dto(NotificationEntity n){return new Api.Notification(n.id,n.type,n.title,n.text,n.reason,n.href,n.createdAt,n.readAt);}

    // Called inside the business mutation transaction; rejected/rolled back actions produce no notification.
    @Transactional public void send(UUID recipient,Api.NotificationType type,String title,String text,String reason,String href,String key) {
        if(db.count(NotificationEntity.class,"e.recipientId=:user and e.dedupeKey=:key",Map.of("user",recipient,"key",key))>0)return;
        var n=new NotificationEntity();n.recipientId=recipient;n.type=type;n.title=title;n.text=text;n.reason=reason;n.href=href;n.dedupeKey=key;
        n.createdAt=clock.instant();n.updatedAt=n.createdAt;db.add(n);
    }
    public UUID owner(EventEntity e){return e.organizerUserId!=null?e.organizerUserId:db.get(OrganizationEntity.class,e.organizerOrganizationId).createdBy;}
    public Set<UUID> attendees(EventEntity e) {
        return new HashSet<>(db.list(RegistrationEntity.class,"e.eventId=:event and e.status in :statuses",Map.of("event",e.id,"statuses",List.of(Api.RegistrationStatus.CONFIRMED,Api.RegistrationStatus.PENDING,Api.RegistrationStatus.WAITLISTED))).stream().map(r -> r.userId).toList());
    }
    @Transactional public void registration(EventEntity e,RegistrationEntity r,boolean newlyJoined) {
        String title=switch(r.status){case CONFIRMED -> "Участие подтверждено";case PENDING -> "Заявка отправлена";case REJECTED -> "Заявка отклонена";case WAITLISTED -> "Вы в листе ожидания";case CANCELLED -> "Участие отменено";};
        // A rejoin is a separate transition even when the registration row is reused.
        String key="registration:"+r.id+":"+r.status+":"+UUID.randomUUID();
        send(r.userId,Api.NotificationType.REGISTRATION_STATUS,title,e.title,r.decisionReason,"/events/"+e.id,key);
        UUID owner=owner(e);
        if(newlyJoined && !owner.equals(r.userId))send(owner,Api.NotificationType.NEW_REGISTRATION,r.status==Api.RegistrationStatus.PENDING?"Новая заявка на участие":r.status==Api.RegistrationStatus.WAITLISTED?"Новая запись в лист ожидания":"Новый участник",e.title,null,"/events/"+e.id,key);
    }
    @Transactional public void unpublished(EventEntity e,String reason) {
        UUID owner=owner(e);
        send(owner,Api.NotificationType.EVENT_UNPUBLISHED,"Мероприятие снято с публикации",e.title,reason,"/events/"+e.id,"unpublished:"+e.id);
        for(UUID user:attendees(e))if(!user.equals(owner))send(user,Api.NotificationType.EVENT_UNPUBLISHED,"Мероприятие снято с публикации",e.title+". Запись и обсуждение закрыты.",null,"/events/"+e.id,"unpublished:"+e.id);
    }
    @Transactional public void updated(EventEntity e) {
        for(UUID user:attendees(e))if(!user.equals(owner(e)))send(user,Api.NotificationType.EVENT_UPDATED,"Изменились время или место встречи",e.title+". Проверьте актуальные условия.",null,"/events/"+e.id,"updated:"+e.id+":"+UUID.randomUUID());
    }
    @Transactional public void reminders() {
        var now=clock.instant();
        // Lock the same event row as join/edit/moderation. Multiple server instances recheck the dedupe key under this lock.
        for(var candidate:db.list(EventEntity.class,"e.status=:status and e.startsAt>:now and e.startsAt<=:until",Map.of("status",Api.EventStatus.PUBLISHED,"now",now,"until",now.plusSeconds(3600)))) {
            var e=db.refreshLocked(candidate);
            if(e.status!=Api.EventStatus.PUBLISHED || !e.startsAt.isAfter(now) || e.startsAt.isAfter(now.plusSeconds(3600)))continue;
            var recipients=new HashSet<UUID>();recipients.add(owner(e));
            db.list(RegistrationEntity.class,"e.eventId=:event and e.status=:status",Map.of("event",e.id,"status",Api.RegistrationStatus.CONFIRMED)).forEach(r -> recipients.add(r.userId));
            for(UUID user:recipients)send(user,Api.NotificationType.EVENT_STARTING,"Встреча скоро начнётся",e.title+". Начало — в течение часа.",null,"/events/"+e.id,"starting:"+e.id+":"+e.startsAt);
        }
    }
}
