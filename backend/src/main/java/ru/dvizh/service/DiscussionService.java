package ru.dvizh.service;

import java.time.Clock;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.dvizh.api.*;
import ru.dvizh.domain.*;
import ru.dvizh.persistence.Store;

@Service @Transactional(readOnly=true)
public class DiscussionService {
    private final Store db;private final Access access;private final Views view;private final OrganizationService organizations;private final Clock clock;private final MentionService mentions;
    public DiscussionService(Store db,Access access,Views view,OrganizationService organizations,Clock clock,MentionService mentions){this.db=db;this.access=access;this.view=view;this.organizations=organizations;this.clock=clock;this.mentions=mentions;}
    public PageResult<Api.Comment> list(UUID eventId,boolean admin,int page,int size) {
        if(admin)access.requireAdmin();else {if(eventId==null)throw Problem.notFound();access.eventVisible(db.get(EventEntity.class,eventId));}
        var p=new HashMap<String,Object>();String condition="1=1";
        if(eventId!=null){db.get(EventEntity.class,eventId);condition+=" and e.eventId=:event";p.put("event",eventId);}
        if(!admin && !access.admin()){condition+=" and e.status=:status";p.put("status",Api.CommentStatus.VISIBLE);}
        return PageResult.of(db.list(CommentEntity.class,condition,p,"e.createdAt asc,e.id asc",PageResult.offset(page,size),size).stream().map(view::comment).toList(),page,size,db.count(CommentEntity.class,condition,p));
    }
    @Transactional public Api.Comment create(UUID eventId,Api.CommentCreate request) {
        var u=access.user();var e=db.lock(EventEntity.class,eventId);access.eventVisible(e);
        if(e.status!=Api.EventStatus.PUBLISHED)throw Problem.conflict(Api.ErrorCode.EVENT_NOT_AVAILABLE,"Обсуждение доступно только у опубликованного события");
        var c=new CommentEntity();c.eventId=eventId;c.authorId=u.id;c.text=request.text().strip();c.mentions=mentions.resolve(c.text);c.createdAt=clock.instant();c.updatedAt=c.createdAt;db.add(c);return view.comment(c);
    }
    @Transactional public Api.Comment hide(UUID id,Api.ModerationRequest request) {
        access.requireAdmin();var c=db.lock(CommentEntity.class,id);
        if(c.status!=Api.CommentStatus.VISIBLE)throw Problem.transition();c.status=Api.CommentStatus.HIDDEN;c.moderationReason=request.reason();c.updatedAt=clock.instant();
        organizations.audit(c.id,"COMMENT_HIDDEN",request.reason());return view.comment(c);
    }
    @Transactional public Api.Event unpublish(UUID id,Api.ModerationRequest request) {
        access.requireAdmin();var e=db.lock(EventEntity.class,id);if(e.status!=Api.EventStatus.PUBLISHED)throw Problem.transition();
        e.status=Api.EventStatus.UNPUBLISHED;e.moderationReason=request.reason();e.updatedAt=clock.instant();
        // Registrations remain as an audit trail. Previously granted points are retained;
        // new verification is forbidden. This policy is documented in decisions.md.
        organizations.audit(e.id,"EVENT_UNPUBLISHED",request.reason());return view.event(e);
    }
}
