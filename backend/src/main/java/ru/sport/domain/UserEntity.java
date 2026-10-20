package ru.sport.domain;

import java.time.Instant;
import java.util.*;
import jakarta.persistence.*;
import ru.sport.api.Api;

@Entity
@Table(name="users")
public class UserEntity extends BaseEntity {
    @Column(nullable=false,unique=true,length=40) public String nickname;
    @Column(nullable=false,length=40,unique=true) public String normalizedNickname;
    @Column(nullable=false,length=100) public String displayName;
    @Column(length=80) public String firstName;
    @Column(length=80) public String lastName;
    @Column(length=1000) public String bio;
    @Column(length=2048) public String avatarUrl;
    @Column(length=100) public String city;
    @Column(length=20) public String preferredTime;
    @Column(nullable=false,length=20) public String questionnaireStatus = "PENDING";
    public Instant questionnaireCompletedAt;
    @Column(nullable=false,length=64) public String recommendationTimeZone = "UTC";
    @Column(nullable=false) public boolean admin;
    @Column(unique=true,length=80) public String demoAccount;
    @Column(length=255) public String passwordHash;
    @ElementCollection @CollectionTable(name="user_sport_roles",joinColumns=@JoinColumn(name="user_id"))
    @Column(name="sports_role",length=30) @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.VARCHAR) @Enumerated(EnumType.STRING)
    public Set<Api.SportsRole> sportsRoles = new HashSet<>();
    @ElementCollection @CollectionTable(name="user_sport_preferences",joinColumns=@JoinColumn(name="user_id"))
    public List<SportPreference> sportsPreferences = new ArrayList<>();
}
