package ru.sport.domain;

import java.time.Instant;
import java.util.*;
import jakarta.persistence.*;
import ru.sport.api.Api;

@Entity
@Table(name="competition_participations")
public class ParticipationEntity extends BaseEntity {
    @Column(nullable=false,unique=true) public UUID registrationId;
    @Column(nullable=false) public UUID eventId;
    @Column(nullable=false) public UUID userId;
    @Column(nullable=false,length=30) public String status;
    public UUID verifiedBy;
    public Instant verifiedAt;
    @Column(length=300) public String note;
}
