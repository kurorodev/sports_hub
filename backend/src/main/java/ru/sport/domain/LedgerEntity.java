package ru.sport.domain;

import java.time.Instant;
import java.util.*;
import jakarta.persistence.*;
import ru.sport.api.Api;

@Entity
@Table(name="rating_ledger")
public class LedgerEntity extends BaseEntity {
    @Column(nullable=false) public UUID userId;
    @Column(nullable=false) public UUID eventId;
    @Column(nullable=false) public UUID registrationId;
    @Column(nullable=false) public UUID participationId;
    @Column(nullable=false) public int points;
    @Column(nullable=false,length=80) public String reason;
    @Column(nullable=false) public UUID verifiedBy;
    @Column(nullable=false,length=160,unique=true) public String idempotencyKey;
}
