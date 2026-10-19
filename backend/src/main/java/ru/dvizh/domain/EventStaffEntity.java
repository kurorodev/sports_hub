package ru.dvizh.domain;

import java.time.Instant;
import java.util.*;
import jakarta.persistence.*;
import ru.dvizh.api.Api;

@Entity
@Table(name="event_staff")
public class EventStaffEntity extends BaseEntity {
    @Column(nullable=false) public UUID eventId;
    @Column(nullable=false) public UUID userId;
    @Column(nullable=false) public UUID assignedBy;
}
