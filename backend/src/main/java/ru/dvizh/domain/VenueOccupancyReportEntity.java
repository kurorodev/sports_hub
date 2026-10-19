package ru.dvizh.domain;

import java.util.UUID;
import jakarta.persistence.*;
import ru.dvizh.api.Api;

@Entity @Table(name="venue_occupancy_reports")
public class VenueOccupancyReportEntity extends BaseEntity {
    @Column(nullable=false) public UUID venueId;
    @Column(nullable=false) public UUID userId;
    @Enumerated(EnumType.STRING) @Column(nullable=false,length=10)
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.VARCHAR)
    public Api.ReportedOccupancyLevel level;
    public Integer peopleCount;
}
