package ru.sport.api;

import java.util.*;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import ru.sport.service.*;

@RestController @RequestMapping("/api/v1")
public class OrganizationController {
    private final OrganizationService organizations;private final EventService events;
    public OrganizationController(OrganizationService organizations,EventService events){this.organizations=organizations;this.events=events;}
    @GetMapping("/organizations") public PageResult<Api.Organization> list(@RequestParam(required=false) String q,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return organizations.list(q,null,false,page,size);}
    @PostMapping("/organizations") @ResponseStatus(HttpStatus.CREATED) public Api.Organization create(@Valid @RequestBody Api.OrganizationCreate request){return organizations.create(request);}
    @GetMapping("/me/organizations") public List<Api.Organization> mine(){return organizations.mine();}
    @GetMapping("/organizations/{organizationId}") public Api.Organization get(@PathVariable UUID organizationId){return organizations.get(organizationId);}
    @GetMapping("/organizations/{organizationId}/events") public PageResult<Api.EventCard> events(@PathVariable UUID organizationId,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return events.organization(organizationId,page,size);}
}
