package ru.sport.service;

import java.io.*;
import java.time.*;
import java.util.*;
import javax.imageio.ImageIO;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.sport.api.*;
import ru.sport.domain.*;
import ru.sport.persistence.Store;

@Service @Transactional(readOnly=true)
public class StoryService {
    private final Store db;private final Access access;private final Clock clock;private final PatchValidator validator;
    public StoryService(Store db,Access access,Clock clock,PatchValidator validator){this.db=db;this.access=access;this.clock=clock;this.validator=validator;}

    public StoryApi.Feed list() {
        var user=access.user();var now=clock.instant();
        var stories=db.list(StoryEntity.class,"e.deletedAt is null and e.createdAt<=:now and e.expiresAt>:now",Map.of("now",now),"e.createdAt desc,e.id desc",0,Integer.MAX_VALUE);
        var viewed=new HashMap<UUID,Instant>();
        if(!stories.isEmpty())db.list(StoryViewEntity.class,"e.userId=:user and e.storyId in :ids",Map.of("user",user.id,"ids",stories.stream().map(s -> s.id).toList())).forEach(v -> viewed.put(v.storyId,v.createdAt));
        return new StoryApi.Feed(stories.stream().map(s -> dto(s,viewed.get(s.id))).toList(),now);
    }
    @Transactional public StoryApi.Story create(JsonNode input) {
        access.requireAdmin();validator.validate("StoryCreate",input);
        var story=new StoryEntity();story.authorId=access.user().id;
        story.title=input.path("title").asText().strip();story.text=input.path("text").asText().strip();
        // Срок всегда 24 часа по серверным часам; клиент не задаёт дату окончания.
        story.createdAt=clock.instant();story.updatedAt=story.createdAt;story.expiresAt=story.createdAt.plus(Duration.ofHours(24));
        StoryImageEntity image=null;
        if(input.hasNonNull("imageData"))image=decode(input.path("imageData").asText());
        story.hasImage=image!=null;db.add(story);db.flush();
        if(image!=null){image.id=story.id;image.createdAt=story.createdAt;image.updatedAt=story.createdAt;db.add(image);}
        return dto(story,null);
    }
    @Transactional public void delete(UUID id) {
        access.requireAdmin();var story=db.lock(StoryEntity.class,id);
        if(story.deletedAt!=null)return;
        story.deletedAt=clock.instant();story.updatedAt=story.deletedAt;
        // execute() сохраняет deletedAt до очистки контекста JPA; иначе отметка удаления потеряется.
        db.execute("delete from StoryImageEntity e where e.id=:id",Map.of("id",id));
    }
    @Transactional public StoryApi.Story view(UUID id) {
        var user=access.user();var story=db.lock(StoryEntity.class,id);active(story);
        // Просмотр и удаление блокируют одну сторис: повторный запрос не создаст вторую отметку пользователя.
        var previous=db.first(StoryViewEntity.class,"e.storyId=:story and e.userId=:user",Map.of("story",id,"user",user.id));
        if(previous.isPresent())return dto(story,previous.get().createdAt);
        var view=new StoryViewEntity();view.storyId=id;view.userId=user.id;view.createdAt=clock.instant();view.updatedAt=view.createdAt;db.add(view);
        return dto(story,view.createdAt);
    }
    public StoryImageEntity image(UUID id) {
        access.user();active(db.get(StoryEntity.class,id));return db.get(StoryImageEntity.class,id);
    }
    private void active(StoryEntity story) {
        // Срок проверяем и при прямом запросе картинки, чтобы URL не обходил истечение сторис.
        var now=clock.instant();
        if(story.deletedAt!=null || story.createdAt.isAfter(now) || !story.expiresAt.isAfter(now))throw Problem.notFound();
    }
    private StoryApi.Story dto(StoryEntity s,Instant readAt){return new StoryApi.Story(s.id,s.title,s.text,s.hasImage?"/api/v1/stories/"+s.id+"/image":null,s.createdAt,s.expiresAt,readAt);}
    private StoryImageEntity decode(String data) {
        try {
            if(!data.startsWith("data:image/png;base64,") && !data.startsWith("data:image/jpeg;base64,"))throw new IOException();
            byte[] bytes=Base64.getDecoder().decode(data.substring(data.indexOf(',')+1));
            if(bytes.length==0 || bytes.length>2*1024*1024)throw new IOException();
            // Размеры проверяем до декодирования, а повторное сохранение убирает исходные метаданные файла.
            try(var stream=ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
                var readers=ImageIO.getImageReaders(stream);if(!readers.hasNext())throw new IOException();var reader=readers.next();
                try {
                    reader.setInput(stream);String format=reader.getFormatName().toLowerCase(Locale.ROOT);
                    if(!Set.of("png","jpeg").contains(format) || reader.getWidth(0)>4096 || reader.getHeight(0)>4096)throw new IOException();
                    var image=reader.read(0);var output=new ByteArrayOutputStream();
                    if(!ImageIO.write(image,format,output) || output.size()>2*1024*1024)throw new IOException();
                    var result=new StoryImageEntity();result.bytes=output.toByteArray();result.contentType="image/"+format;return result;
                } finally {reader.dispose();}
            }
        } catch(IOException|IllegalArgumentException e){throw Problem.invalid("Выберите PNG или JPEG до 2 МБ, не более 4096×4096 пикселей");}
    }
}
