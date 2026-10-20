package ru.sport.api;

import java.util.*;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import ru.sport.service.RegistrationService;

@RestController @RequestMapping("/api/v1")
public class RegistrationController {
    private final RegistrationService registrations;
    public RegistrationController(RegistrationService registrations){this.registrations=registrations;}
    @GetMapping("/events/{eventId}/my-registration") public Api.Registration mine(@PathVariable UUID eventId){return registrations.mine(eventId);}
    @GetMapping("/me/registrations") public PageResult<Api.Registration> myRegistrations(@RequestParam(required=false) Api.RegistrationStatus status,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return registrations.myRegistrations(status,page,size);}
    @PostMapping("/events/{eventId}/registrations") @ResponseStatus(HttpStatus.CREATED)
    public Api.Registration join(@PathVariable UUID eventId,@Valid @RequestBody Api.RegistrationCreate request){return registrations.join(eventId,request,false);}
    @GetMapping("/events/{eventId}/registrations") public PageResult<Api.Registration> list(@PathVariable UUID eventId,@RequestParam(required=false) Api.RegistrationStatus status,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return registrations.registrations(eventId,status,page,size);}
    @GetMapping("/events/{eventId}/participants") public PageResult<Api.PublicUser> participants(@PathVariable UUID eventId,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return registrations.participants(eventId,page,size);}
    @PostMapping("/events/{eventId}/registrations/{registrationId}/decision") public Api.Registration decide(@PathVariable UUID eventId,@PathVariable UUID registrationId,@Valid @RequestBody Api.RegistrationDecisionRequest request){return registrations.decide(eventId,registrationId,request);}
    @DeleteMapping("/events/{eventId}/registrations/me") public Api.Registration cancel(@PathVariable UUID eventId){return registrations.cancel(eventId,false);}
    @GetMapping("/events/{eventId}/team") public Api.TeamStatus team(@PathVariable UUID eventId){return registrations.team(eventId);}
    @PostMapping("/events/{eventId}/waitlist") @ResponseStatus(HttpStatus.CREATED) public Api.Registration waitlist(@PathVariable UUID eventId,@Valid @RequestBody Api.RegistrationCreate request){return registrations.join(eventId,request,true);}
    @DeleteMapping("/events/{eventId}/waitlist/me") public Api.Registration cancelWaitlist(@PathVariable UUID eventId){return registrations.cancel(eventId,true);}
}
