package ru.sport.api;

import org.springframework.web.bind.annotation.*;
import ru.sport.service.GeocodingService;

@RestController @RequestMapping("/api/v1")
public class GeoController {
    private final GeocodingService service;
    public GeoController(GeocodingService service){this.service=service;}
    @GetMapping("/geo/suggest") public Api.GeoSuggestions suggest(@RequestParam String q,@RequestParam(required=false) String city,@RequestParam(defaultValue="5") int limit){return service.suggest(q,city,limit);}
    @GetMapping("/geo/reverse") public Api.GeoReverseResponse reverse(@RequestParam double latitude,@RequestParam double longitude){return service.reverse(latitude,longitude);}
}
