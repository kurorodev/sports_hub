package ru.dvizh.domain;

import java.time.Instant;
import java.util.UUID;
import jakarta.persistence.*;

@MappedSuperclass
public abstract class BaseEntity {
    @Id public UUID id = UUID.randomUUID();
    @Column(nullable=false, updatable=false) public Instant createdAt = Instant.now();
    @Column(nullable=false) public Instant updatedAt = createdAt;
    @Version public long version;
}
