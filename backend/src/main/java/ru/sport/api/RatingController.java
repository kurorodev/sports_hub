package ru.sport.api;

import java.util.*;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import ru.sport.service.RatingService;

@RestController @RequestMapping("/api/v1/competitions")
public class RatingController {
    private final RatingService ratings;
    public RatingController(RatingService ratings){this.ratings=ratings;}
    @PostMapping("/{eventId}/referees") @ResponseStatus(HttpStatus.CREATED) public Map<String,Object> assign(@PathVariable UUID eventId,@Valid @RequestBody Api.AssignRefereeRequest request){return ratings.assign(eventId,request);}
    @PostMapping("/{eventId}/participations/{registrationId}/verify") public Api.RatingLedgerEntry verify(@PathVariable UUID eventId,@PathVariable UUID registrationId,@Valid @RequestBody Api.VerifyParticipationRequest request){return ratings.verify(eventId,registrationId,request);}
}
