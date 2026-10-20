package ru.sport.api;

import java.util.UUID;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import ru.sport.service.SportManagementService;

@RestController @RequestMapping("/api/v1")
public class SportManagementController {
    public record Create(@NotBlank @Size(min=2,max=80) String name,@Size(max=2800000) String imageData) {}
    public record Image(@com.fasterxml.jackson.annotation.JsonProperty(required=true) @Size(max=2800000) String imageData) {}
    private final SportManagementService sports;
    public SportManagementController(SportManagementService sports){this.sports=sports;}
    @PostMapping("/admin/sports") @ResponseStatus(HttpStatus.CREATED)
    public Api.Sport create(@Valid @RequestBody Create input){return sports.create(input.name(),input.imageData());}
    @PatchMapping("/admin/sports/{sportId}")
    public Api.Sport update(@PathVariable UUID sportId,@RequestBody com.fasterxml.jackson.databind.JsonNode input){return sports.update(sportId,input);}
    @DeleteMapping("/admin/sports/{sportId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID sportId){sports.delete(sportId);}
    @PutMapping("/admin/sports/{sportId}/image")
    public Api.Sport image(@PathVariable UUID sportId,@Valid @RequestBody Image input){return sports.image(sportId,input.imageData());}
    @GetMapping("/sports/{sportId}/image")
    public ResponseEntity<byte[]> image(@PathVariable UUID sportId){
        var image=sports.image(sportId);
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(image.type()))
            .cacheControl(CacheControl.noStore()).header("X-Content-Type-Options","nosniff").body(image.bytes());
    }
}
