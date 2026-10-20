package ru.sport.api;

import java.util.UUID;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import ru.sport.service.StoryService;

@RestController @RequestMapping("/api/v1")
public class StoryController {
    private final StoryService stories;
    public StoryController(StoryService stories){this.stories=stories;}
    @GetMapping("/stories") public ResponseEntity<StoryApi.Feed> list(){return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(stories.list());}
    @PostMapping("/admin/stories") @ResponseStatus(HttpStatus.CREATED)
    public StoryApi.Story create(@RequestBody JsonNode input){return stories.create(input);}
    @DeleteMapping("/admin/stories/{storyId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID storyId){stories.delete(storyId);}
    @PostMapping("/stories/{storyId}/view") public StoryApi.Story view(@PathVariable UUID storyId){return stories.view(storyId);}
    @GetMapping("/stories/{storyId}/image") public ResponseEntity<byte[]> image(@PathVariable UUID storyId){
        var image=stories.image(storyId);
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(image.contentType))
            .cacheControl(CacheControl.noStore()).header("X-Content-Type-Options","nosniff").body(image.bytes);
    }
}
