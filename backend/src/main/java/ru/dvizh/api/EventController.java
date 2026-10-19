package ru.dvizh.api;

import java.util.*;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import ru.dvizh.service.EventService;

@RestController @RequestMapping("/api/v1")
public class EventController {
    private final EventService events;
    public EventController(EventService events){this.events=events;}
    @GetMapping("/sports") public List<Api.Sport> sports(@RequestParam(required=false) String q){return events.sports(q);}
    @GetMapping("/events") public PageResult<Api.EventCard> search(@RequestParam Map<String,String> filters,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return events.search(filters,page,size);}
    @PostMapping("/events") @ResponseStatus(HttpStatus.CREATED) public Api.Event create(@Valid @RequestBody Api.EventCreate request){return events.create(request);}
    @GetMapping("/events/{eventId}") public Api.Event get(@PathVariable UUID eventId){return events.get(eventId);}
    @PatchMapping("/events/{eventId}") public Api.Event patch(@PathVariable UUID eventId,@RequestBody JsonNode request){return events.patch(eventId,request);}
    @PostMapping("/events/{eventId}/publish") public Api.Event publish(@PathVariable UUID eventId){return events.publish(eventId);}
    @GetMapping("/me/events") public PageResult<Api.Event> mine(@RequestParam(required=false) Api.EventStatus status,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return events.mine(status,page,size);}
    @GetMapping("/events/recommended") public PageResult<Api.RecommendedEvent> recommended(@RequestParam(required=false) String city,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return events.recommendations(city,page,size);}
}
