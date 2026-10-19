package ru.dvizh.service;

import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.dvizh.api.*;
import ru.dvizh.domain.*;
import ru.dvizh.persistence.Store;

@Service @Transactional(readOnly=true)
public class SupportService {
    private final Store db;
    private final Access access;
    private final Views views;
    private final NotificationService notifications;
    private final Clock clock;
    private final SportsMapService maps;
    public SupportService(Store db,Access access,Views views,NotificationService notifications,Clock clock,SportsMapService maps) {
        this.db=db;this.access=access;this.views=views;this.notifications=notifications;this.clock=clock;this.maps=maps;
    }
    public PageResult<SupportApi.Ticket> list(boolean admin,String q,SupportApi.Status status,SupportApi.Category category,int page,int size) {
        int offset=PageResult.offset(page,size);var user=access.user();if(admin)access.requireAdmin();else if(user.admin)throw Problem.forbidden();
        var params=new HashMap<String,Object>();String where="1=1";
        if(!admin){where+=" and e.authorId=:user";params.put("user",user.id);}
        if(status!=null){where+=" and e.status=:status";params.put("status",status);}
        if(category!=null){where+=" and e.category=:category";params.put("category",category);}
        if(q!=null && !q.isBlank()) {
            if(q.length()>160)throw Problem.invalid("Поисковый запрос слишком длинный");
            where+=" and (lower(e.title) like :q escape '!' or lower(e.description) like :q escape '!')";
            params.put("q","%"+q.strip().toLowerCase(Locale.ROOT).replace("!","!!").replace("%","!%").replace("_","!_")+"%");
        }
        long total=db.count(SupportTicketEntity.class,where,params);
        return PageResult.of(db.list(SupportTicketEntity.class,where,params,"e.updatedAt desc,e.id desc",offset,size).stream().map(this::dto).toList(),page,size,total);
    }
    private SupportTicketEntity accessible(UUID id,boolean lock) {
        var user=access.user();var ticket=lock?db.lock(SupportTicketEntity.class,id):db.get(SupportTicketEntity.class,id);
        if(!ticket.authorId.equals(user.id) && !user.admin)throw Problem.notFound();
        return ticket;
    }
    public SupportApi.Ticket get(UUID id){return dto(accessible(id,false));}
    @Transactional public SupportApi.Ticket publishVenue(UUID id,Api.VenueCreate input) {
        access.requireAdmin();var t=accessible(id,true);var user=access.user();
        if(t.category!=SupportApi.Category.VENUE_SUGGESTION)throw Problem.invalid("Добавить площадку можно только из её предложения");
        // The ticket lock makes retries and simultaneous reviews of this proposal idempotent.
        if(t.publishedVenueId!=null)return dto(t);
        var venue=maps.createReviewed(input);
        String previous=t.venueCity+", "+t.venueAddress+" ("+t.venueLatitude+", "+t.venueLongitude+")";
        t.publishedVenueId=venue.id();t.status=SupportApi.Status.RESOLVED;t.assignedTo=user.id;t.updatedAt=clock.instant();
        t.venueCity=venue.location().city();t.venueAddress=venue.location().address();t.venueLatitude=venue.location().latitude();t.venueLongitude=venue.location().longitude();
        addMessage(t,user,SupportApi.MessageKind.STATUS,"Площадка «"+venue.name()+"» добавлена в список доступных площадок. Обращение решено. Адрес: "+t.venueCity+", "+t.venueAddress+". Исходное предложение: "+previous);
        notifications.send(t.authorId,Api.NotificationType.SUPPORT_STATUS,"Ваша площадка добавлена",t.title,null,href(t),"support-venue:"+t.id);
        return dto(t);
    }
    @Transactional public SupportApi.Ticket create(SupportApi.Create input) {
        var viewer=access.user();if(viewer.admin)throw Problem.forbidden();
        var user=db.lock(UserEntity.class,viewer.id);
        if(db.count(SupportTicketEntity.class,"e.authorId=:user and e.createdAt>:since",Map.of("user",user.id,"since",clock.instant().minusSeconds(3600)))>=10)
            throw new Problem(429,Api.ErrorCode.RATE_LIMITED,"Можно создать не больше 10 обращений в час. Дополните существующее.");
        var t=new SupportTicketEntity();t.authorId=user.id;t.category=input.category();t.title=input.title();t.description=input.description();
        if(input.category()==SupportApi.Category.COMMENT_REPORT) {
            if(input.commentId()==null || input.reportReason()==null)throw Problem.invalid("Укажите комментарий и причину жалобы");
            var comment=db.get(CommentEntity.class,input.commentId());access.eventVisible(db.get(EventEntity.class,comment.eventId));
            if(comment.status!=Api.CommentStatus.VISIBLE)throw Problem.notFound();
            if(db.count(SupportTicketEntity.class,"e.authorId=:user and e.commentId=:comment and e.status in :active",Map.of("user",user.id,"comment",comment.id,"active",List.of(SupportApi.Status.OPEN,SupportApi.Status.IN_PROGRESS,SupportApi.Status.WAITING_USER)))>0)
                throw new Problem(409,Api.ErrorCode.CONFLICT,"Вы уже сообщили об этом комментарии. Откройте обращение в поддержке.");
            t.commentId=comment.id;t.activeCommentId=comment.id;t.eventId=comment.eventId;t.commentText=comment.text;t.commentAuthor=db.get(UserEntity.class,comment.authorId).displayName;t.reportReason=input.reportReason();
        } else if(input.commentId()!=null || input.reportReason()!=null)throw Problem.invalid("Комментарий указывается только для жалобы");
        if(input.category()==SupportApi.Category.VENUE_SUGGESTION) {
            if(input.venueCity()==null || input.venueCity().isBlank() || input.venueAddress()==null || input.venueAddress().isBlank())throw Problem.invalid("Укажите город и адрес площадки");
            if((input.venueLatitude()==null)!=(input.venueLongitude()==null))throw Problem.invalid("Укажите обе координаты площадки");
            t.venueCity=input.venueCity();t.venueAddress=input.venueAddress();t.venueLatitude=input.venueLatitude();t.venueLongitude=input.venueLongitude();
        } else if(input.venueCity()!=null || input.venueAddress()!=null || input.venueLatitude()!=null || input.venueLongitude()!=null)throw Problem.invalid("Место указывается только для предложения площадки");
        t.createdAt=clock.instant();t.updatedAt=t.createdAt;db.add(t);
        notifyAdmins(t,user.id,Api.NotificationType.SUPPORT_NEW,t.category==SupportApi.Category.COMMENT_REPORT?"Новая жалоба на комментарий":"Новое обращение в поддержку","support-new:"+t.id);
        return dto(t);
    }
    public PageResult<SupportApi.Message> messages(UUID id,int page,int size) {
        accessible(id,false);int offset=PageResult.offset(page,size);var params=Map.of("ticket",id);
        long total=db.count(SupportMessageEntity.class,"e.ticketId=:ticket",params);
        return PageResult.of(db.list(SupportMessageEntity.class,"e.ticketId=:ticket",params,"e.createdAt desc,e.id desc",offset,size).stream().map(this::messageDto).toList(),page,size,total);
    }
    @Transactional public SupportApi.Message reply(UUID id,SupportApi.Reply input) {
        var t=accessible(id,true);var user=access.user();
        if(terminal(t.status))throw new Problem(409,Api.ErrorCode.INVALID_STATUS_TRANSITION,"Откройте обращение повторно, чтобы продолжить переписку");
        if(db.count(SupportMessageEntity.class,"e.ticketId=:ticket and e.authorId=:user and e.createdAt>:since",Map.of("ticket",id,"user",user.id,"since",clock.instant().minusSeconds(3600)))>=60)
            throw new Problem(429,Api.ErrorCode.RATE_LIMITED,"Слишком много сообщений. Попробуйте позже.");
        var m=addMessage(t,user,SupportApi.MessageKind.MESSAGE,input.text());
        if(user.admin){t.assignedTo=user.id;t.status=SupportApi.Status.WAITING_USER;}
        else t.status=SupportApi.Status.OPEN;
        t.updatedAt=clock.instant();
        if(!user.id.equals(t.authorId))notifications.send(t.authorId,Api.NotificationType.SUPPORT_REPLY,"Ответ службы поддержки",t.title,null,href(t),"support-message:"+m.id);
        else notifyAdmins(t,user.id,Api.NotificationType.SUPPORT_REPLY,"Пользователь дополнил обращение","support-message:"+m.id);
        return messageDto(m);
    }
    @Transactional public SupportApi.Ticket update(UUID id,SupportApi.Update input) {
        var t=accessible(id,true);var user=access.user();
        if(input.status()==null && input.priority()==null)throw Problem.invalid("Укажите статус или приоритет");
        if(!user.admin) {
            if(input.priority()!=null || (input.status()!=SupportApi.Status.CLOSED && !(input.status()==SupportApi.Status.OPEN && terminal(t.status))))throw Problem.forbidden();
        }
        boolean statusChanged=input.status()!=null && input.status()!=t.status;
        boolean priorityChanged=input.priority()!=null && input.priority()!=t.priority;
        if(!statusChanged && !priorityChanged)return dto(t);
        if(statusChanged && t.commentId!=null) {
            db.lock(UserEntity.class,t.authorId);
            if(!terminal(input.status()) && db.count(SupportTicketEntity.class,"e.authorId=:user and e.activeCommentId=:comment and e.id<>:id",Map.of("user",t.authorId,"comment",t.commentId,"id",t.id))>0)
                throw new Problem(409,Api.ErrorCode.CONFLICT,"Уже есть открытая жалоба на этот комментарий");
            t.activeCommentId=terminal(input.status())?null:t.commentId;
        }
        if(statusChanged)t.status=input.status();if(priorityChanged)t.priority=input.priority();
        if(user.admin)t.assignedTo=user.id;
        t.updatedAt=clock.instant();
        String text=(statusChanged?"Статус: "+statusLabel(t.status):"")+(priorityChanged?(statusChanged?". ":"")+"Приоритет: "+priorityLabel(t.priority):"");
        var m=addMessage(t,user,SupportApi.MessageKind.STATUS,text);
        if(!user.id.equals(t.authorId))notifications.send(t.authorId,Api.NotificationType.SUPPORT_STATUS,"Обновление обращения",t.title+". "+text,null,href(t),"support-status:"+m.id);
        else notifyAdmins(t,user.id,Api.NotificationType.SUPPORT_STATUS,"Обновление обращения","support-status:"+m.id);
        return dto(t);
    }
    private SupportMessageEntity addMessage(SupportTicketEntity t,UserEntity user,SupportApi.MessageKind kind,String text) {
        var m=new SupportMessageEntity();m.ticketId=t.id;m.authorId=user.id;m.fromSupport=user.admin;m.kind=kind;m.text=text;m.createdAt=clock.instant();m.updatedAt=m.createdAt;return db.add(m);
    }
    private void notifyAdmins(SupportTicketEntity t,UUID actor,Api.NotificationType type,String title,String key) {
        for(var admin:db.list(UserEntity.class,"e.admin=true",Map.of()))if(!admin.id.equals(actor))notifications.send(admin.id,type,title,t.title,null,href(t),key);
    }
    private String href(SupportTicketEntity t){return "/support/"+t.id;}
    private boolean terminal(SupportApi.Status status){return status==SupportApi.Status.CLOSED || status==SupportApi.Status.RESOLVED;}
    private String statusLabel(SupportApi.Status status){return switch(status){case OPEN->"Открыто";case IN_PROGRESS->"В работе";case WAITING_USER->"Ожидаем вашего ответа";case RESOLVED->"Решено";case CLOSED->"Закрыто";};}
    private String priorityLabel(SupportApi.Priority priority){return switch(priority){case NORMAL->"Обычный";case HIGH->"Высокий";case URGENT->"Срочный";};}
    private SupportApi.Ticket dto(SupportTicketEntity t){return new SupportApi.Ticket(t.id,views.user(t.authorId),t.assignedTo==null?null:views.user(t.assignedTo),t.category,t.status,t.priority,t.title,t.description,t.commentId,t.eventId,t.commentText,t.commentAuthor,t.reportReason,t.venueCity,t.venueAddress,t.venueLatitude,t.venueLongitude,t.publishedVenueId,t.createdAt,t.updatedAt);}
    private SupportApi.Message messageDto(SupportMessageEntity m){return new SupportApi.Message(m.id,m.ticketId,views.user(m.authorId),m.fromSupport,m.kind,m.text,m.createdAt);}
}
