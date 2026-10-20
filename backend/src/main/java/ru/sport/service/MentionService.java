package ru.sport.service;

import java.util.*;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
import ru.sport.domain.*;
import ru.sport.persistence.Store;

@Service
public class MentionService {
    // Смещения считаем в UTF-16, как slice в JavaScript; фрагменты email и длинных ников не считаем упоминаниями.
    private static final Pattern TOKEN=Pattern.compile("(?<![\\p{L}\\p{N}_@.-])@([A-Za-z0-9_-]{3,40})(?![\\p{L}\\p{N}_-])");
    private final Store db;
    public MentionService(Store db){this.db=db;}
    public List<MentionRef> resolve(String text) {
        var result=new ArrayList<MentionRef>();var matches=TOKEN.matcher(text).results().toList();
        var names=matches.stream().map(m -> m.group(1).toLowerCase(Locale.ROOT)).distinct().toList();
        if(names.isEmpty())return result;
        var users=new HashMap<String,UserEntity>();
        for(var user:db.list(UserEntity.class,"e.normalizedNickname in :names",Map.of("names",names)))users.put(user.normalizedNickname,user);
        for(var match:matches) {
            var user=users.get(match.group(1).toLowerCase(Locale.ROOT));
            if(user!=null)result.add(new MentionRef(user.id,match.group(1),match.start(),match.end()));
        }
        return result;
    }
}
