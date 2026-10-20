package ru.sport.domain;

import java.time.Instant;
import java.util.UUID;
import jakarta.persistence.*;
import ru.sport.api.Api;

@Entity @Table(name="notifications", uniqueConstraints=@UniqueConstraint(columnNames={"recipient_id","dedupe_key"}))
public class NotificationEntity extends BaseEntity {
    @Column(nullable=false) public UUID recipientId;
    @Column(nullable=false,length=40) @Enumerated(EnumType.STRING) @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.VARCHAR) public Api.NotificationType type;
    @Column(nullable=false,length=200) public String title;
    @Column(nullable=false,length=2000) public String text;
    @Column(length=2000) public String commentText;
    @Column(length=1000) public String reason;
    @Column(length=200) public String href;
    @Column(nullable=false,length=240) public String dedupeKey;
    public Instant readAt;
}
