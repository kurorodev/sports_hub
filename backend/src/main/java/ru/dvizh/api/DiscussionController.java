package ru.dvizh.api;

import java.util.UUID;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import ru.dvizh.service.DiscussionService;

@RestController @RequestMapping("/api/v1")
public class DiscussionController {
    private final DiscussionService discussions;
    public DiscussionController(DiscussionService discussions){this.discussions=discussions;}
    @GetMapping("/events/{eventId}/comments") public PageResult<Api.Comment> list(@PathVariable UUID eventId,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return discussions.list(eventId,false,page,size);}
    @PostMapping("/events/{eventId}/comments") @ResponseStatus(HttpStatus.CREATED) public Api.Comment create(@PathVariable UUID eventId,@Valid @RequestBody Api.CommentCreate request){return discussions.create(eventId,request);}
}
