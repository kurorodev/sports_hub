package ru.dvizh.domain;

import java.time.Instant;
import java.util.*;
import jakarta.persistence.*;
import ru.dvizh.api.Api;

@Entity
@Table(name="event_comments")
public class CommentEntity extends BaseEntity {
    @Column(nullable=false) public UUID eventId;
    @Column(nullable=false) public UUID authorId;
    @Column(nullable=false,length=2000) public String text;
    @Column(nullable=false,length=30) @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.VARCHAR) @Enumerated(EnumType.STRING) public Api.CommentStatus status = Api.CommentStatus.VISIBLE;
    @Column(length=1000) public String moderationReason;
}
