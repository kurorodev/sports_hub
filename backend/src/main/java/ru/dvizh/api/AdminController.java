package ru.dvizh.api;

import java.util.UUID;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import ru.dvizh.service.*;

@RestController @RequestMapping("/api/v1/admin")
public class AdminController {
    private final OrganizationService organizations;private final EventService events;private final DiscussionService discussions;
    public AdminController(OrganizationService organizations,EventService events,DiscussionService discussions){this.organizations=organizations;this.events=events;this.discussions=discussions;}
    @GetMapping("/organizations") public PageResult<Api.Organization> organizations(@RequestParam(required=false) String q,@RequestParam(required=false) Api.OrganizationStatus status,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return organizations.list(q,status,true,page,size);}
    @PostMapping("/organizations/{organizationId}/decision") public Api.Organization decide(@PathVariable UUID organizationId,@Valid @RequestBody Api.OrganizationDecisionRequest request){return organizations.decide(organizationId,request);}
    @GetMapping("/events") public PageResult<Api.Event> events(@RequestParam(required=false) String q,@RequestParam(required=false) Api.EventStatus status,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return events.admin(q,status,page,size);}
    @PostMapping("/events/{eventId}/unpublish") public Api.Event unpublish(@PathVariable UUID eventId,@Valid @RequestBody Api.ModerationRequest request){return discussions.unpublish(eventId,request);}
    @GetMapping("/comments") public PageResult<Api.Comment> comments(@RequestParam(required=false) UUID eventId,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return discussions.list(eventId,true,page,size);}
    @PostMapping("/comments/{commentId}/hide") public Api.Comment hide(@PathVariable UUID commentId,@Valid @RequestBody Api.ModerationRequest request){return discussions.hide(commentId,request);}
}
