package ru.sport.domain;

import java.util.UUID;
import jakarta.persistence.*;

@Entity @Table(name="story_views",uniqueConstraints=@UniqueConstraint(columnNames={"story_id","user_id"}))
public class StoryViewEntity extends BaseEntity {
    @Column(nullable=false) public UUID storyId;
    @Column(nullable=false) public UUID userId;
}
