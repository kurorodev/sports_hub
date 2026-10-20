package ru.sport.api;

import java.util.UUID;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import ru.sport.service.SupportService;

@RestController @RequestMapping("/api/v1")
public class SupportController {
    private final SupportService service;
    public SupportController(SupportService service){this.service=service;}
    @GetMapping("/support/tickets") public PageResult<SupportApi.Ticket> mine(@RequestParam(required=false) String q,@RequestParam(required=false) SupportApi.Status status,@RequestParam(required=false) SupportApi.Category category,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return service.list(false,q,status,category,page,size);}
    @GetMapping("/admin/support/tickets") public PageResult<SupportApi.Ticket> queue(@RequestParam(required=false) String q,@RequestParam(required=false) SupportApi.Status status,@RequestParam(required=false) SupportApi.Category category,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return service.list(true,q,status,category,page,size);}
    @PostMapping("/support/tickets") @ResponseStatus(HttpStatus.CREATED) public SupportApi.Ticket create(@Valid @RequestBody SupportApi.Create input){return service.create(input);}
    @GetMapping("/support/tickets/{ticketId}") public SupportApi.Ticket get(@PathVariable UUID ticketId){return service.get(ticketId);}
    @PostMapping("/support/tickets/{ticketId}/venue") public SupportApi.Ticket publishVenue(@PathVariable UUID ticketId,@Valid @RequestBody Api.VenueCreate input){return service.publishVenue(ticketId,input);}
    @PatchMapping("/support/tickets/{ticketId}") public SupportApi.Ticket update(@PathVariable UUID ticketId,@Valid @RequestBody SupportApi.Update input){return service.update(ticketId,input);}
    @GetMapping("/support/tickets/{ticketId}/messages") public PageResult<SupportApi.Message> messages(@PathVariable UUID ticketId,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return service.messages(ticketId,page,size);}
    @PostMapping("/support/tickets/{ticketId}/messages") @ResponseStatus(HttpStatus.CREATED) public SupportApi.Message reply(@PathVariable UUID ticketId,@Valid @RequestBody SupportApi.Reply input){return service.reply(ticketId,input);}
}
