package ru.sport.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.*;
import ru.sport.service.NotificationService;

@Configuration @EnableScheduling
@ConditionalOnProperty(name="app.notifications.scheduling",havingValue="true",matchIfMissing=true)
public class NotificationSchedule {
    private final NotificationService notifications;
    public NotificationSchedule(NotificationService notifications){this.notifications=notifications;}
    @Scheduled(fixedDelayString="${app.notifications.interval-ms:60000}",initialDelayString="${app.notifications.initial-delay-ms:10000}")
    public void remind(){notifications.reminders();}
}
