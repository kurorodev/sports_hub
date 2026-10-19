package ru.dvizh.domain;

import java.time.Instant;
import java.util.*;
import jakarta.persistence.*;
import ru.dvizh.api.Api;

@Entity
@Table(name="conversations")
public class ConversationEntity extends BaseEntity {
    @Column(nullable=false,length=30) @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.VARCHAR) @Enumerated(EnumType.STRING) public Api.ConversationType type;
    @Column(length=120) public String title;
    public UUID organizationId;
    public UUID userLowId;
    public UUID userHighId;
    @Column(length=80,unique=true) public String directKey;
    public Instant lastMessageAt;
}
