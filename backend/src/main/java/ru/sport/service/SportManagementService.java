package ru.sport.service;

import java.io.*;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.*;
import javax.imageio.ImageIO;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.sport.api.*;
import ru.sport.domain.SportEntity;
import ru.sport.persistence.Store;

@Service @Transactional(readOnly=true)
public class SportManagementService {
    public record Image(byte[] bytes,String type) {}
    private final Access access;private final Store db;private final Views views;private final PatchValidator validator;
    public SportManagementService(Access access,Store db,Views views,PatchValidator validator){this.access=access;this.db=db;this.views=views;this.validator=validator;}
    @Transactional public Api.Sport create(String name,String data) {
        access.requireAdmin();name=name.strip().replaceAll("\\s+"," ");
        if(name.length()<2 || name.length()>80)throw Problem.invalid("Название: от 2 до 80 символов");
        String normalized=name.toLowerCase(Locale.ROOT).replace('ё','е');
        // Serialize category creation, including case-insensitive duplicate checks.
        db.first(SportEntity.class,"e.isCustom=true",Map.of()).ifPresent(other -> db.lock(SportEntity.class,other.id));
        if(db.count(SportEntity.class,"e.normalizedName=:name",Map.of("name",normalized))>0)
            throw Problem.conflict(Api.ErrorCode.CONFLICT,"Такой вид спорта уже существует");
        var s=new SportEntity();s.name=name;s.normalizedName=normalized;s.isCustom=false;s.adminCreated=true;
        setImage(s,data);db.add(s);db.flush();return views.sport(s);
    }
    @Transactional public Api.Sport update(UUID id,JsonNode input) {
        access.requireAdmin();validator.validate("SportCategoryPatch",input);
        lockCatalog();var sport=editable(id);
        if(input.has("name")) {
            String name=input.path("name").asText().strip().replaceAll("\\s+"," ");
            if(name.length()<2 || name.length()>80)throw Problem.invalid("Название: от 2 до 80 символов");
            if(sport.isCustom && !name.equals(sport.name))throw Problem.invalid("Общую категорию Другое нельзя переименовать");
            String normalized=name.toLowerCase(Locale.ROOT).replace('ё','е');
            if(db.count(SportEntity.class,"e.normalizedName=:name and e.id<>:id",Map.of("name",normalized,"id",id))>0)
                throw Problem.conflict(Api.ErrorCode.CONFLICT,"Такой вид спорта уже существует");
            sport.name=name;sport.normalizedName=normalized;
        }
        if(input.has("imageData"))setImage(sport,input.path("imageData").isNull()?null:input.path("imageData").asText());
        sport.updatedAt=java.time.Instant.now();db.flush();return views.sport(sport);
    }
    @Transactional public void delete(UUID id) {
        access.requireAdmin();lockCatalog();var sport=db.lock(SportEntity.class,id);
        if(sport.canonicalId!=null)throw Problem.notFound();
        if(sport.isCustom)throw Problem.invalid("Общую категорию Другое нельзя удалить");
        // Preserve references from events, venues, organizations and profiles.
        sport.archived=true;sport.updatedAt=java.time.Instant.now();
    }
    private void lockCatalog() {
        db.first(SportEntity.class,"e.isCustom=true and e.canonicalId is null",Map.of()).ifPresent(other -> db.lock(SportEntity.class,other.id));
    }
    private SportEntity editable(UUID id) {
        var sport=db.lock(SportEntity.class,id);
        if(sport.archived || sport.canonicalId!=null)throw Problem.notFound();
        return sport;
    }
    @Transactional public Api.Sport image(UUID id,String data){access.requireAdmin();var s=editable(id);setImage(s,data);s.updatedAt=java.time.Instant.now();return views.sport(s);}
    public Image image(UUID id){var s=db.get(SportEntity.class,id);if(s.imageData==null)throw Problem.notFound();return new Image(s.imageData,s.imageContentType);}
    private void setImage(SportEntity sport,String data) {
        if(data==null || data.isBlank()){sport.imageData=null;sport.imageContentType=null;return;}
        try {
            if(!data.startsWith("data:image/png;base64,") && !data.startsWith("data:image/jpeg;base64,"))throw new IOException();
            byte[] bytes=Base64.getDecoder().decode(data.substring(data.indexOf(',')+1));
            if(bytes.length>2*1024*1024 || bytes.length==0)throw new IOException();
            try(var stream=ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
                var readers=ImageIO.getImageReaders(stream);if(!readers.hasNext())throw new IOException();
                var reader=readers.next();
                try {
                    reader.setInput(stream);String format=reader.getFormatName().toLowerCase(Locale.ROOT);
                    if(!Set.of("png","jpeg").contains(format) || reader.getWidth(0)>4096 || reader.getHeight(0)>4096)throw new IOException();
                    var image=reader.read(0);var output=new ByteArrayOutputStream();
                    if(!ImageIO.write(image,format,output) || output.size()>2*1024*1024)throw new IOException();
                    sport.imageData=output.toByteArray();sport.imageContentType="image/"+format;
                } finally {reader.dispose();}
            }
        } catch(IOException|IllegalArgumentException e){throw Problem.invalid("Выберите PNG или JPEG до 2 МБ, не более 4096×4096 пикселей");}
    }
}
