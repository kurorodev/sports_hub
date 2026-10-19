package ru.dvizh.domain;

import java.time.Instant;
import java.util.*;
import jakarta.persistence.*;
import ru.dvizh.api.Api;

@Entity
@Table(name="chat_messages")
public class MessageEntity extends BaseEntity {
    @Column(nullable=false) public UUID conversationId;
    @Column(nullable=false) public UUID authorId;
    @Column(nullable=false,length=3000) public String text;
    @ElementCollection @CollectionTable(name="message_mentions",joinColumns=@JoinColumn(name="message_id"))
    @OrderColumn(name="mention_index") public List<MentionRef> mentions=new ArrayList<>();
}
