package ru.sport.service;

import java.time.Clock;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.sport.api.*;
import ru.sport.domain.*;
import ru.sport.persistence.Store;

@Service @Transactional(readOnly=true)
public class MessagingService {
    private final Store db;private final Access access;private final Views view;private final Clock clock;private final MentionService mentions;
    public MessagingService(Store db,Access access,Views view,Clock clock,MentionService mentions){this.db=db;this.access=access;this.view=view;this.clock=clock;this.mentions=mentions;}
    public record Created(Api.Conversation conversation,boolean created) {}
    @Transactional public Created create(Api.ConversationCreate request) {
        var actor=access.user();var c=new ConversationEntity();c.type=request.type();
        if(request.type()==Api.ConversationType.DIRECT) {
            if(request.peerUserId()==null || request.organizationId()!=null || request.title()!=null || request.peerUserId().equals(actor.id))throw Problem.invalid("Укажите другого peerUserId для DIRECT");
            UUID low=actor.id.toString().compareTo(request.peerUserId().toString())<0?actor.id:request.peerUserId();
            UUID high=low.equals(actor.id)?request.peerUserId():actor.id;
            db.lock(UserEntity.class,low);db.lock(UserEntity.class,high);
            c.userLowId=low;c.userHighId=high;c.directKey=low+":"+high;
            var existing=db.first(ConversationEntity.class,"e.directKey=:key",Map.of("key",c.directKey));
            if(existing.isPresent())return new Created(view.conversation(existing.get()),false);
        } else {
            if(request.organizationId()==null || request.peerUserId()!=null || request.title()==null || request.title().isBlank())throw Problem.invalid("Укажите organizationId и title для COMMUNITY");
            var org=db.lock(OrganizationEntity.class,request.organizationId());
            if(!access.represents(org))throw Problem.forbidden();access.approved(org);
            if(!activeMember(org.id,actor.id))throw new Problem(403,Api.ErrorCode.NOT_CONVERSATION_MEMBER,"Сначала вступите в организацию");
            c.organizationId=org.id;c.title=request.title().strip();
        }
        c.createdAt=clock.instant();c.updatedAt=c.createdAt;db.add(c);return new Created(view.conversation(c),true);
    }
    public PageResult<Api.Conversation> list(Api.ConversationType type,int page,int size) {
        var user=access.user();Map<String,Object> p=new HashMap<>(Map.<String,Object>of("user",user.id,"active",Api.MembershipStatus.ACTIVE,"approved",Api.OrganizationStatus.APPROVED));
        String condition="((e.userLowId=:user or e.userHighId=:user) or (e.organizationId in (select m.organizationId from MembershipEntity m where m.userId=:user and m.status=:active) and e.organizationId in (select o.id from OrganizationEntity o where o.status=:approved)))";
        if(type!=null){condition+=" and e.type=:type";p.put("type",type);}
        return PageResult.of(db.list(ConversationEntity.class,condition,p,"coalesce(e.lastMessageAt,e.createdAt) desc,e.id desc",PageResult.offset(page,size),size).stream().map(view::conversation).toList(),page,size,db.count(ConversationEntity.class,condition,p));
    }
    public Api.Conversation get(UUID id) {var c=db.get(ConversationEntity.class,id);requireMember(c);return view.conversation(c);}
    public PageResult<Api.Message> messages(UUID id,int page,int size) {
        var c=db.get(ConversationEntity.class,id);requireMember(c);var p=Map.of("conversation",id);String condition="e.conversationId=:conversation";
        return PageResult.of(db.list(MessageEntity.class,condition,p,"e.createdAt desc,e.id desc",PageResult.offset(page,size),size).stream().map(view::message).toList(),page,size,db.count(MessageEntity.class,condition,p));
    }
    @Transactional public Api.Message send(UUID id,Api.MessageCreate request) {
        var c=db.lock(ConversationEntity.class,id);
        // Serialize community sends with leave/rejoin so membership cannot be bypassed by a race.
        if(c.organizationId!=null)db.lock(OrganizationEntity.class,c.organizationId);
        requireMember(c);var m=new MessageEntity();m.conversationId=id;m.authorId=access.user().id;m.text=request.text().strip();m.mentions=mentions.resolve(m.text);
        m.createdAt=clock.instant();m.updatedAt=m.createdAt;c.lastMessageAt=m.createdAt;c.updatedAt=m.createdAt;db.add(m);return view.message(m);
    }
    private boolean activeMember(UUID organization,UUID user) {
        return db.count(MembershipEntity.class,"e.organizationId=:org and e.userId=:user and e.status=:active",Map.of("org",organization,"user",user,"active",Api.MembershipStatus.ACTIVE))>0;
    }
    private void requireMember(ConversationEntity c) {
        UUID user=access.user().id;boolean permitted;
        if(c.type==Api.ConversationType.DIRECT)permitted=user.equals(c.userLowId)||user.equals(c.userHighId);
        else permitted=db.get(OrganizationEntity.class,c.organizationId).status==Api.OrganizationStatus.APPROVED && activeMember(c.organizationId,user);
        if(!permitted)throw new Problem(403,Api.ErrorCode.NOT_CONVERSATION_MEMBER,"Вы не участник беседы");
    }
    @Transactional public Api.Membership join(UUID organizationId) {
        var org=db.lock(OrganizationEntity.class,organizationId);access.approved(org);UUID user=access.user().id;
        var existing=db.first(MembershipEntity.class,"e.organizationId=:org and e.userId=:user",Map.of("org",organizationId,"user",user));
        if(existing.isPresent() && existing.get().status==Api.MembershipStatus.ACTIVE)throw Problem.conflict(Api.ErrorCode.CONFLICT,"Вы уже состоите в организации");
        var m=existing.orElseGet(MembershipEntity::new);m.organizationId=organizationId;m.userId=user;m.status=Api.MembershipStatus.ACTIVE;m.joinedAt=clock.instant();m.updatedAt=clock.instant();
        if(existing.isEmpty())db.add(m);return view.membership(m);
    }
    public PageResult<Api.Membership> members(UUID organizationId,int page,int size) {
        var org=db.get(OrganizationEntity.class,organizationId);access.approved(org);
        if(!activeMember(organizationId,access.user().id))throw Problem.forbidden();
        var p=Map.of("org",organizationId,"status",Api.MembershipStatus.ACTIVE);String condition="e.organizationId=:org and e.status=:status";
        return PageResult.of(db.list(MembershipEntity.class,condition,p,"e.joinedAt asc,e.id asc",PageResult.offset(page,size),size).stream().map(view::membership).toList(),page,size,db.count(MembershipEntity.class,condition,p));
    }
    @Transactional public void leave(UUID organizationId) {
        db.lock(OrganizationEntity.class,organizationId);UUID user=access.user().id;
        var m=db.first(MembershipEntity.class,"e.organizationId=:org and e.userId=:user",Map.of("org",organizationId,"user",user)).orElseThrow(Problem::notFound);
        if(m.status!=Api.MembershipStatus.ACTIVE)throw Problem.transition();m.status=Api.MembershipStatus.LEFT;m.updatedAt=clock.instant();
    }
}
