package ru.sport.domain;

import java.time.Instant;
import java.util.*;
import jakarta.persistence.*;
import ru.sport.api.Api;

@Entity
@Table(name="moderation_actions")
public class ModerationEntity extends BaseEntity {
    @Column(nullable=false) public UUID actorId;
    @Column(nullable=false) public UUID targetId;
    @Column(nullable=false,length=40) public String action;
    @Column(length=1000) public String reason;
}
