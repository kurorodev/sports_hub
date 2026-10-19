package ru.dvizh.service;

import java.time.Clock;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.dvizh.api.*;
import ru.dvizh.domain.*;
import ru.dvizh.persistence.Store;

@Service @Transactional(readOnly=true)
public class RatingService {
    private final Store db;private final Access access;private final Views view;private final Clock clock;private final int points;
    public RatingService(Store db,Access access,Views view,Clock clock,@Value("${app.rating.points-per-participation}") int points){this.db=db;this.access=access;this.view=view;this.clock=clock;this.points=points;}
    @Transactional public Map<String,Object> assign(UUID eventId,Api.AssignRefereeRequest request) {
        var e=db.lock(EventEntity.class,eventId);access.requireOwner(e);
        if(e.eventKind!=Api.EventKind.COMPETITION || e.status!=Api.EventStatus.PUBLISHED)throw Problem.transition();
        var referee=db.get(UserEntity.class,request.userId());
        if(!referee.sportsRoles.contains(Api.SportsRole.REFEREE))throw new Problem(422,Api.ErrorCode.NOT_A_REFEREE,"У пользователя нет спортивной роли REFEREE");
        if(db.count(EventStaffEntity.class,"e.eventId=:event and e.userId=:user",Map.of("event",eventId,"user",referee.id))==0) {
            var staff=new EventStaffEntity();staff.eventId=eventId;staff.userId=referee.id;staff.assignedBy=access.user().id;db.add(staff);
        }
        return Views.fields("eventId",eventId,"referee",view.user(referee));
    }
    @Transactional public Api.RatingLedgerEntry verify(UUID eventId,UUID registrationId,Api.VerifyParticipationRequest request) {
        var actor=access.user();var e=db.lock(EventEntity.class,eventId);
        boolean appointed=db.count(EventStaffEntity.class,"e.eventId=:event and e.userId=:user",Map.of("event",eventId,"user",actor.id))>0;
        if(!access.owns(e) && !appointed)throw Problem.forbidden();
        if(e.eventKind!=Api.EventKind.COMPETITION || e.status!=Api.EventStatus.PUBLISHED || e.endsAt==null || e.endsAt.isAfter(clock.instant()))throw Problem.transition();
        var r=db.get(RegistrationEntity.class,registrationId);
        if(!r.eventId.equals(eventId))throw Problem.notFound();
        if(r.userId.equals(actor.id))throw Problem.forbidden();
        if(r.status!=Api.RegistrationStatus.CONFIRMED)throw Problem.transition();
        String key="verification:"+registrationId;
        var existing=db.first(LedgerEntity.class,"e.idempotencyKey=:key",Map.of("key",key));
        if(existing.isPresent())return view.ledger(existing.get());
        var p=db.first(ParticipationEntity.class,"e.registrationId=:reg",Map.of("reg",registrationId)).orElseGet(() -> {
            var participation=new ParticipationEntity();participation.registrationId=r.id;participation.eventId=e.id;participation.userId=r.userId;return db.add(participation);
        });
        p.status="VERIFIED";p.verifiedBy=actor.id;p.verifiedAt=clock.instant();p.note=request.note();p.updatedAt=clock.instant();
        var ledger=new LedgerEntity();ledger.userId=r.userId;ledger.eventId=e.id;ledger.registrationId=r.id;ledger.participationId=p.id;ledger.points=points;
        ledger.reason="VERIFIED_COMPETITION_PARTICIPATION";ledger.verifiedBy=actor.id;ledger.idempotencyKey=key;ledger.createdAt=clock.instant();ledger.updatedAt=ledger.createdAt;
        db.add(ledger);db.flush();return view.ledger(ledger);
    }
}
