package ru.sport.service;

import java.time.Clock;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.sport.api.*;
import ru.sport.domain.*;
import ru.sport.persistence.Store;

@Service @Transactional(readOnly=true)
public class OrganizationService {
    private final Store db;private final Access access;private final Views view;private final SportsCatalog catalog;private final Clock clock;private final NotificationService notifications;
    public OrganizationService(Store db,Access access,Views view,Clock clock,SportsCatalog catalog,NotificationService notifications){this.db=db;this.access=access;this.view=view;this.clock=clock;this.catalog=catalog;this.notifications=notifications;}
    @Transactional public Api.Organization create(Api.OrganizationCreate r) {
        var org=new OrganizationEntity();org.createdBy=access.user().id;org.name=r.name().strip();org.description=r.description().strip();org.avatarUrl=r.avatarUrl();safeAvatar(org.avatarUrl);
        if(r.sports()!=null) for(UUID sport:r.sports()){if(sport==null)throw Problem.invalid("sports не может содержать null");org.sports.add(catalog.resolve(sport).id);}
        org.createdAt=clock.instant();org.updatedAt=org.createdAt;db.add(org);return view.organization(org);
    }
    public Api.Organization get(UUID id){var org=db.get(OrganizationEntity.class,id);access.organizationVisible(org);return view.organization(org);}
    public List<Api.Organization> mine(){return db.list(OrganizationEntity.class,"e.createdBy=:user",Map.of("user",access.user().id)).stream().map(view::organization).toList();}
    public PageResult<Api.Organization> list(String q,Api.OrganizationStatus status,boolean admin,int page,int size) {
        if(admin)access.requireAdmin();else status=Api.OrganizationStatus.APPROVED;
        String condition="(lower(e.name) like :q or lower(e.description) like :q)";Map<String,Object> p=new HashMap<>(Map.of("q",EventService.like(q)));
        if(status!=null){condition+=" and e.status=:status";p.put("status",status);}
        return PageResult.of(db.list(OrganizationEntity.class,condition,p,"e.createdAt desc,e.id asc",PageResult.offset(page,size),size).stream().map(view::organization).toList(),page,size,db.count(OrganizationEntity.class,condition,p));
    }
    @Transactional public Api.Organization decide(UUID id,Api.OrganizationDecisionRequest request) {
        access.requireAdmin();var org=db.lock(OrganizationEntity.class,id);
        if(org.status!=Api.OrganizationStatus.PENDING)throw Problem.transition();
        if(request.decision()==Api.Decision.REJECT && (request.reason()==null || request.reason().strip().length()<3))throw Problem.invalid("Укажите причину отказа (от 3 символов)");
        org.status=request.decision()==Api.Decision.APPROVE?Api.OrganizationStatus.APPROVED:Api.OrganizationStatus.REJECTED;
        org.decisionReason=request.reason();org.decidedAt=clock.instant();org.decidedBy=access.user().id;org.updatedAt=clock.instant();
        audit(org.id,"ORGANIZATION_"+org.status,request.reason());
        if(org.status==Api.OrganizationStatus.APPROVED) {
            var m=new MembershipEntity();m.organizationId=org.id;m.userId=org.createdBy;m.joinedAt=clock.instant();db.add(m);
        }
        notifications.send(org.createdBy,Api.NotificationType.ORGANIZATION_STATUS,org.status==Api.OrganizationStatus.APPROVED?"Организация одобрена":"Заявка организации отклонена",org.name,request.reason(),"/organization","organization:"+org.id);
        return view.organization(org);
    }
    public void audit(UUID target,String action,String reason) {
        var audit=new ModerationEntity();audit.actorId=access.user().id;audit.targetId=target;audit.action=action;audit.reason=reason;audit.createdAt=clock.instant();audit.updatedAt=audit.createdAt;db.add(audit);
    }
    static void safeAvatar(String url) {
        if(url==null)return;
        try {var uri=java.net.URI.create(url);if(url.length()>2048 || !("http".equals(uri.getScheme()) || "https".equals(uri.getScheme())) || uri.getHost()==null || uri.getUserInfo()!=null)throw Problem.invalid("Недопустимый avatarUrl");}
        catch(IllegalArgumentException ex){throw Problem.invalid("Недопустимый avatarUrl");}
    }
}
