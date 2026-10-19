package ru.dvizh.domain;

import java.util.UUID;
import jakarta.persistence.*;

@Entity @Table(name="sport_venues")
public class VenueEntity extends BaseEntity {
    @Column(nullable=false,length=120) public String name;
    @Column(nullable=false,length=120) public String normalizedName;
    public UUID sportId;
    @Column(nullable=false,length=120) public String city;
    @Column(nullable=false,length=300) public String address;
    @Column(nullable=false) public double latitude;
    @Column(nullable=false) public double longitude;
    @Column(nullable=false) public UUID createdBy;
}
