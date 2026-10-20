package ru.sport.service;

import java.util.*;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import ru.sport.api.*;
import ru.sport.domain.*;
import ru.sport.persistence.Store;

@Component
public class Access {
    private final Store db;
    public Access(Store db) { this.db=db; }
    public UUID viewerId() {
        var authentication=SecurityContextHolder.getContext().getAuthentication();
        return authentication != null && authentication.getPrincipal() instanceof UUID id ? id : null;
    }
    public UserEntity user() {
        UUID id=viewerId();
        if(id==null) throw new Problem(401,Api.ErrorCode.UNAUTHENTICATED,"Войдите в аккаунт");
        return db.get(UserEntity.class,id);
    }
    public UserEntity participant() { var u=user(); if(u.admin)throw Problem.forbidden(); return u; }
    public boolean admin() { UUID id=viewerId(); return id != null && db.get(UserEntity.class,id).admin; }
    public void requireAdmin() { if(!user().admin) throw Problem.forbidden(); }
    public boolean represents(OrganizationEntity org) { return org.createdBy.equals(viewerId()); }
    public void approved(OrganizationEntity org) {
        if(org.status != Api.OrganizationStatus.APPROVED) throw new Problem(403,Api.ErrorCode.ORGANIZATION_NOT_APPROVED,"Организация ещё не допущена");
    }
    public boolean owns(EventEntity e) {
        UUID viewer=viewerId();
        if(viewer==null || admin()) return false;
        if(e.organizerUserId!=null) return e.organizerUserId.equals(viewer);
        var org=db.get(OrganizationEntity.class,e.organizerOrganizationId);
        return represents(org) && org.status==Api.OrganizationStatus.APPROVED;
    }
    public void requireOwner(EventEntity e) {
        participant(); if(!owns(e)) throw new Problem(403,Api.ErrorCode.NOT_EVENT_ORGANIZER,"Управлять может только организатор события");
    }
    public void eventVisible(EventEntity e) {
        if(e.status==Api.EventStatus.PUBLISHED || owns(e) || admin()) return;
        UUID id=viewerId();
        if(e.status!=Api.EventStatus.DRAFT && id!=null && db.count(RegistrationEntity.class,"e.eventId=:event and e.userId=:user",Map.of("event",e.id,"user",id))>0) return;
        throw Problem.notFound();
    }
    public void organizationVisible(OrganizationEntity org) {
        if(org.status!=Api.OrganizationStatus.APPROVED && !represents(org) && !admin()) throw Problem.notFound();
    }
}
