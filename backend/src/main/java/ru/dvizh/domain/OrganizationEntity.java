package ru.dvizh.domain;

import java.time.Instant;
import java.util.*;
import jakarta.persistence.*;
import ru.dvizh.api.Api;

@Entity
@Table(name="organizations")
public class OrganizationEntity extends BaseEntity {
    @Column(nullable=false,length=160) public String name;
    @Column(nullable=false,length=2000) public String description;
    @Column(length=2048) public String avatarUrl;
    @Column(nullable=false) public UUID createdBy;
    @Column(nullable=false,length=30) @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.VARCHAR) @Enumerated(EnumType.STRING) public Api.OrganizationStatus status = Api.OrganizationStatus.PENDING;
    @Column(length=1000) public String decisionReason;
    public Instant decidedAt;
    public UUID decidedBy;
    @ElementCollection @CollectionTable(name="organization_sports",joinColumns=@JoinColumn(name="organization_id"))
    @Column(name="sport_id") public Set<UUID> sports = new HashSet<>();
}
