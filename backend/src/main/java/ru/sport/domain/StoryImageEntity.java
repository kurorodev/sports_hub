package ru.sport.domain;

import jakarta.persistence.*;

@Entity @Table(name="story_images")
public class StoryImageEntity extends BaseEntity {
    @Column(nullable=false,columnDefinition="bytea") public byte[] bytes;
    @Column(nullable=false,length=20) public String contentType;
}
