package ru.dvizh.api;

import java.util.UUID;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import ru.dvizh.service.NotificationService;

@RestController @RequestMapping("/api/v1")
public class NotificationController {
    private final NotificationService notifications;
    public NotificationController(NotificationService notifications){this.notifications=notifications;}
    @GetMapping("/me/notifications") public Api.NotificationPage list(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return notifications.list(page,size);}
    @PostMapping("/me/notifications/{notificationId}/read") public Api.Notification read(@PathVariable UUID notificationId){return notifications.read(notificationId);}
    @PostMapping("/me/notifications/read-all") @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void readAll(@Valid @RequestBody Api.NotificationsReadRequest request){notifications.readAll(request.through());}
}
