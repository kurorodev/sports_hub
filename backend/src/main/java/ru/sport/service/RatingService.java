package ru.sport.service;

import java.util.*;
import org.springframework.stereotype.Service;
import ru.sport.api.*;

/** Compatibility endpoints for retired gamification. No writes or awards are performed. */
@Service
public class RatingService {
    private final Access access;
    public RatingService(Access access){this.access=access;}
    public Map<String,Object> assign(UUID eventId,Api.AssignRefereeRequest request) { throw retired(); }
    public Api.RatingLedgerEntry verify(UUID eventId,UUID registrationId,Api.VerifyParticipationRequest request) { throw retired(); }
    private Problem retired() {
        access.user();
        return new Problem(410,Api.ErrorCode.INVALID_STATUS_TRANSITION,"Судейство и начисление очков отключены");
    }
}
