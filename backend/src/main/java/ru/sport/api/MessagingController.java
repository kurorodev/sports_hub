package ru.sport.api;

import java.util.UUID;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import ru.sport.service.MessagingService;

@RestController @RequestMapping("/api/v1")
public class MessagingController {
    private final MessagingService messaging;
    public MessagingController(MessagingService messaging){this.messaging=messaging;}
    @GetMapping("/conversations") public PageResult<Api.Conversation> list(@RequestParam(required=false) Api.ConversationType type,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return messaging.list(type,page,size);}
    @PostMapping("/conversations") public ResponseEntity<Api.Conversation> create(@Valid @RequestBody Api.ConversationCreate request){var result=messaging.create(request);return ResponseEntity.status(result.created()?201:200).body(result.conversation());}
    @GetMapping("/conversations/{conversationId}") public Api.Conversation get(@PathVariable UUID conversationId){return messaging.get(conversationId);}
    @GetMapping("/conversations/{conversationId}/messages") public PageResult<Api.Message> messages(@PathVariable UUID conversationId,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return messaging.messages(conversationId,page,size);}
    @PostMapping("/conversations/{conversationId}/messages") @ResponseStatus(HttpStatus.CREATED) public Api.Message send(@PathVariable UUID conversationId,@Valid @RequestBody Api.MessageCreate request){return messaging.send(conversationId,request);}
    @PostMapping("/organizations/{organizationId}/memberships") @ResponseStatus(HttpStatus.CREATED) public Api.Membership join(@PathVariable UUID organizationId){return messaging.join(organizationId);}
    @GetMapping("/organizations/{organizationId}/memberships") public PageResult<Api.Membership> members(@PathVariable UUID organizationId,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return messaging.members(organizationId,page,size);}
    @DeleteMapping("/organizations/{organizationId}/memberships/me") @ResponseStatus(HttpStatus.NO_CONTENT) public void leave(@PathVariable UUID organizationId){messaging.leave(organizationId);}
}
