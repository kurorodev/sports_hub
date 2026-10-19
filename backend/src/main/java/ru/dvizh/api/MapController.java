package ru.dvizh.api;

import java.time.Instant;
import java.util.UUID;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import ru.dvizh.service.SportsMapService;

@RestController @RequestMapping("/api/v1")
public class MapController {
    private final SportsMapService service;
    public MapController(SportsMapService service){this.service=service;}
    @GetMapping("/map/events") public Api.MapEventsResponse events(@RequestParam String bbox,@RequestParam(required=false) UUID sportId,
        @RequestParam(defaultValue="300") int limit,@RequestParam(required=false) Instant from,@RequestParam(required=false) Instant to) {
        return service.events(bbox,sportId,limit,from,to);
    }
    @GetMapping("/map/venues") public Api.MapVenuesResponse venues(@RequestParam String bbox,@RequestParam(required=false) UUID sportId,@RequestParam(defaultValue="300") int limit) {
        return service.venues(bbox,sportId,limit);
    }
    @PostMapping("/map/venues") @ResponseStatus(HttpStatus.CREATED)
    public Api.VenueMapItem create(@Valid @RequestBody Api.VenueCreate input){return service.create(input);}
    @PostMapping("/map/venues/{venueId}/reports") @ResponseStatus(HttpStatus.CREATED)
    public Api.VenueMapItem report(@PathVariable UUID venueId,@Valid @RequestBody Api.OccupancyReportCreate input){return service.report(venueId,input);}
}
