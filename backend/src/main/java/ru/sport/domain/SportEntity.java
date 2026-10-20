package ru.sport.domain;

import java.time.Instant;
import java.util.*;
import jakarta.persistence.*;
import ru.sport.api.Api;

@Entity
@Table(name="sports")
public class SportEntity extends BaseEntity {
    @Column(nullable=false,length=80) public String name;
    @Column(nullable=false,length=80,unique=true) public String normalizedName;
    @Column(nullable=false) public boolean isCustom;
    @Column(length=11) public String registryCode;
    public UUID canonicalId;
    @Column(nullable=false) public boolean adminCreated;
    @Column(columnDefinition="bytea") public byte[] imageData;
    @Column(length=20) public String imageContentType;
}
