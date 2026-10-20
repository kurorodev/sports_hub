package ru.sport.domain;

import java.util.UUID;
import jakarta.persistence.*;
import ru.sport.api.SupportApi;

@Entity @Table(name="support_tickets")
public class SupportTicketEntity extends BaseEntity {
    @Column(nullable=false) public UUID authorId;
    public UUID assignedTo;
    @Column(nullable=false,length=30) @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.VARCHAR) @Enumerated(EnumType.STRING) public SupportApi.Category category;
    @Column(nullable=false,length=30) @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.VARCHAR) @Enumerated(EnumType.STRING) public SupportApi.Status status=SupportApi.Status.OPEN;
    @Column(nullable=false,length=20) @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.VARCHAR) @Enumerated(EnumType.STRING) public SupportApi.Priority priority=SupportApi.Priority.NORMAL;
    @Column(nullable=false,length=160) public String title;
    @Column(nullable=false,length=5000) public String description;
    public UUID commentId;
    public UUID activeCommentId;
    public UUID eventId;
    @Column(length=2000) public String commentText;
    @Column(length=100) public String commentAuthor;
    @Column(length=20) @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.VARCHAR) @Enumerated(EnumType.STRING) public SupportApi.ReportReason reportReason;
    @Column(length=120) public String venueCity;
    @Column(length=300) public String venueAddress;
    public Double venueLatitude;
    public Double venueLongitude;
    public UUID publishedVenueId;
}
