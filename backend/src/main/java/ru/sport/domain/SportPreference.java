package ru.sport.domain;
import java.util.UUID;
import jakarta.persistence.*;
import ru.sport.api.Api;

@Embeddable
public class SportPreference {
    @Column(name="sport_id",nullable=false) public UUID sportId;
    @Column(nullable=false,length=30) @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.VARCHAR) @Enumerated(EnumType.STRING) public Api.ExperienceLevel level;
    public SportPreference() {}
    public SportPreference(UUID sportId, Api.ExperienceLevel level) { this.sportId=sportId; this.level=level; }
}
