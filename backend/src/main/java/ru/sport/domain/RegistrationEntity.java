package ru.sport.domain;

import java.time.Instant;
import java.util.*;
import jakarta.persistence.*;
import ru.sport.api.Api;

@Entity
@Table(name="event_registrations")
public class RegistrationEntity extends BaseEntity {
    @Column(nullable=false) public UUID eventId;
    @Column(nullable=false) public UUID userId;
    @Column(nullable=false,length=30) @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.VARCHAR) @Enumerated(EnumType.STRING) public Api.RegistrationStatus status;
    @Column(length=1000) public String message;
    @Column(length=1000) public String decisionReason;
    public Instant decidedAt;
    public UUID decidedBy;
}
