package ru.sport.service;

import java.time.Clock;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.sport.api.*;
import ru.sport.domain.*;
import ru.sport.persistence.Store;

@Service @Transactional(readOnly=true)
public class DiscussionService {
    private final Store db;private final Access access;private final Views view;private final OrganizationService organizations;private final Clock clock;private final MentionService mentions;private final NotificationService notifications;
    public DiscussionService(Store db,Access access,Views view,OrganizationService organizations,Clock clock,MentionService mentions,NotificationService notifications){this.db=db;this.access=access;this.view=view;this.organizations=organizations;this.clock=clock;this.mentions=mentions;this.notifications=notifications;}
    public PageResult<Api.Comment> list(UUID eventId,boolean admin,int page,int size) {
        return list(eventId,admin,null,false,false,page,size);
    }
    public PageResult<Api.Comment> adminComments(UUID eventId,UUID authorId,boolean latest,boolean last24Hours,int page,int size) {
        return list(eventId,true,authorId,latest,last24Hours,page,size);
    }
    private PageResult<Api.Comment> list(UUID eventId,boolean admin,UUID authorId,boolean latest,boolean last24Hours,int page,int size) {
        if(admin)access.requireAdmin();else {if(eventId==null)throw Problem.notFound();access.eventVisible(db.get(EventEntity.class,eventId));}
        PageResult.offset(page,size);
        var p=new HashMap<String,Object>();String condition="1=1";
        if(eventId!=null){db.get(EventEntity.class,eventId);condition+=" and e.eventId=:event";p.put("event",eventId);}
        if(authorId!=null){db.get(UserEntity.class,authorId);condition+=" and e.authorId=:author";p.put("author",authorId);}
        if(last24Hours){condition+=" and e.createdAt>=:since";p.put("since",clock.instant().minus(java.time.Duration.ofHours(24)));}
        if(!admin && !access.admin()){condition+=" and e.status=:status";p.put("status",Api.CommentStatus.VISIBLE);}
        long total=db.count(CommentEntity.class,condition,p);
        if(latest){size=Math.min(size,10);total=Math.min(total,10);}
        int offset=PageResult.offset(page,size);
        int limit=(int)Math.min(size,Math.max(0,total-offset));
        var items=limit==0?List.<Api.Comment>of():db.list(CommentEntity.class,condition,p,admin?"e.createdAt desc,e.id desc":"e.createdAt asc,e.id asc",offset,limit).stream().map(view::comment).toList();
        return PageResult.of(items,page,size,total);
    }
    @Transactional public Api.Comment create(UUID eventId,Api.CommentCreate request) {
        var u=access.participant();var e=db.lock(EventEntity.class,eventId);access.eventVisible(e);
        if(e.status!=Api.EventStatus.PUBLISHED)throw Problem.conflict(Api.ErrorCode.EVENT_NOT_AVAILABLE,"Обсуждение доступно только у опубликованного события");
        var c=new CommentEntity();c.eventId=eventId;c.authorId=u.id;c.text=request.text().strip();c.mentions=mentions.resolve(c.text);c.createdAt=clock.instant();c.updatedAt=c.createdAt;db.add(c);
        c.mentions.stream().map(m -> m.userId).distinct().filter(id -> !id.equals(u.id)).forEach(id -> notifications.send(id,Api.NotificationType.MENTION,"Вас упомянули в обсуждении",e.title,null,"/events/"+e.id,"mention:"+c.id));
        return view.comment(c);
    }
    @Transactional public Api.Comment hide(UUID id,Api.ModerationRequest request) {
        access.requireAdmin();var candidate=db.get(CommentEntity.class,id);db.lock(EventEntity.class,candidate.eventId);var c=db.refreshLocked(candidate);
        if(c.status!=Api.CommentStatus.VISIBLE)throw Problem.transition();c.status=Api.CommentStatus.HIDDEN;c.moderationReason=request.reason();c.updatedAt=clock.instant();
        organizations.audit(c.id,"COMMENT_HIDDEN",request.reason());notifications.commentHidden(c);return view.comment(c);
    }
    @Transactional public Api.Event unpublish(UUID id,Api.ModerationRequest request) {
        access.requireAdmin();var e=db.lock(EventEntity.class,id);if(e.status!=Api.EventStatus.PUBLISHED)throw Problem.transition();
        e.status=Api.EventStatus.UNPUBLISHED;e.moderationReason=request.reason();e.updatedAt=clock.instant();
        // Registrations remain as an audit trail. Previously granted points are retained;
        // new verification is forbidden. This policy is documented in decisions.md.
        organizations.audit(e.id,"EVENT_UNPUBLISHED",request.reason());notifications.unpublished(e,request.reason());return view.event(e);
    }
}
