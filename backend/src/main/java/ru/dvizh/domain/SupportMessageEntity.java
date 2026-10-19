package ru.dvizh.domain;

import java.util.UUID;
import jakarta.persistence.*;
import ru.dvizh.api.SupportApi;

@Entity @Table(name="support_messages")
public class SupportMessageEntity extends BaseEntity {
    @Column(nullable=false) public UUID ticketId;
    @Column(nullable=false) public UUID authorId;
    @Column(nullable=false) public boolean fromSupport;
    @Column(nullable=false,length=20) @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.VARCHAR) @Enumerated(EnumType.STRING) public SupportApi.MessageKind kind=SupportApi.MessageKind.MESSAGE;
    @Column(nullable=false,length=5000) public String text;
}
