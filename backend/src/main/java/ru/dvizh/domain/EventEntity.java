package ru.dvizh.domain;

import java.time.Instant;
import java.util.*;
import jakarta.persistence.*;
import ru.dvizh.api.Api;

@Entity
@Table(name="events")
public class EventEntity extends BaseEntity {
    @Column(nullable=false,length=160) public String title;
    @Column(nullable=false,length=5000) public String description;
    @Column(nullable=false) public UUID sportId;
    @Column(length=80) public String customSportName;
    @Column(nullable=false,length=30) @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.VARCHAR) @Enumerated(EnumType.STRING) public Api.EventKind eventKind = Api.EventKind.ACTIVITY;
    @Column(nullable=false) public Instant startsAt;
    public Instant endsAt;
    @Column(nullable=false,length=120) public String city;
    @Column(nullable=false,length=300) public String address;
    public Double latitude;
    public Double longitude;
    @Column(nullable=false,length=30) @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.VARCHAR) @Enumerated(EnumType.STRING) public Api.EventSkillLevel skillLevel = Api.EventSkillLevel.ANY;
    @Column(length=2000) public String requirements;
    @Column(nullable=false,length=30) @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.VARCHAR) @Enumerated(EnumType.STRING) public Api.JoinMode joinMode;
    public Integer maxParticipants;
    public UUID organizerUserId;
    public UUID organizerOrganizationId;
    @Column(nullable=false,length=30) @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.VARCHAR) @Enumerated(EnumType.STRING) public Api.EventStatus status;
    @Column(length=1000) public String moderationReason;
}
