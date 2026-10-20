package ru.sport.domain;

import java.time.Instant;
import java.util.*;
import jakarta.persistence.*;
import ru.sport.api.Api;

@Entity
@Table(name="community_members")
public class MembershipEntity extends BaseEntity {
    @Column(nullable=false) public UUID organizationId;
    @Column(nullable=false) public UUID userId;
    @Column(nullable=false,length=30) @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.VARCHAR) @Enumerated(EnumType.STRING) public Api.MembershipStatus status = Api.MembershipStatus.ACTIVE;
    @Column(nullable=false) public Instant joinedAt = Instant.now();
}
