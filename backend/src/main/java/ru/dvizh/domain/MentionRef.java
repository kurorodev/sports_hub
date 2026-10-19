package ru.dvizh.domain;

import java.util.UUID;
import jakarta.persistence.*;

@Embeddable
public class MentionRef {
    @Column(nullable=false) public UUID userId;
    @Column(nullable=false,length=40) public String nickname;
    @Column(nullable=false) public int startIndex;
    @Column(nullable=false) public int endIndex;
    public MentionRef() {}
    public MentionRef(UUID userId,String nickname,int start,int end){this.userId=userId;this.nickname=nickname;this.startIndex=start;this.endIndex=end;}
}
