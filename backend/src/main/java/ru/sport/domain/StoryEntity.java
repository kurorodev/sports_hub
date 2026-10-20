package ru.sport.domain;

import java.time.Instant;
import java.util.UUID;
import jakarta.persistence.*;

@Entity @Table(name="stories")
public class StoryEntity extends BaseEntity {
    @Column(nullable=false,length=80) public String title;
    @Column(nullable=false,length=1000) public String text;
    @Column(nullable=false) public UUID authorId;
    @Column(nullable=false) public boolean hasImage;
    @Column(nullable=false) public Instant expiresAt;
    public Instant deletedAt;
}
