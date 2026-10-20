package ru.sport.service;

import java.io.IOException;
import java.net.URI;
import java.time.OffsetDateTime;
import java.util.*;
import com.fasterxml.jackson.databind.*;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import ru.sport.api.Problem;

/** Validates partial updates against the original OpenAPI properties, including explicit null. */
@Component
public class PatchValidator {
    private final JsonNode schemas;
    public PatchValidator(ObjectMapper mapper) throws IOException {
        try(var in=new ClassPathResource("api-schemas.json").getInputStream()) { schemas=mapper.readTree(in); }
    }
    public void validate(String name,JsonNode value) { check(schemas.path(name),value,name); }
    private void check(JsonNode schema,JsonNode value,String path) {
        if(schema.has("$ref")) { check(schemas.path(schema.path("$ref").asText().replace("#/components/schemas/","")),value,path); return; }
        if(value==null || value.isNull()) {
            if(!schema.path("nullable").asBoolean(false)) fail(path);
            return;
        }
        if(schema.has("enum")) {
            boolean found=false; for(var option:schema.path("enum")) if(option.equals(value)) found=true;
            if(!found) fail(path);
        }
        switch(schema.path("type").asText()) {
            case "object" -> {
                if(!value.isObject() || value.size()<schema.path("minProperties").asInt(0)) fail(path);
                for(var required:schema.path("required")) if(!value.has(required.asText())) fail(path+"."+required.asText());
                value.fields().forEachRemaining(entry -> {
                    JsonNode prop=schema.path("properties").get(entry.getKey());
                    if(prop==null) { if(schema.has("additionalProperties") && !schema.path("additionalProperties").asBoolean()) fail(path+"."+entry.getKey()); }
                    else check(prop,entry.getValue(),path+"."+entry.getKey());
                });
            }
            case "array" -> {
                if(!value.isArray()) fail(path);
                if(schema.path("uniqueItems").asBoolean() && new HashSet<JsonNode>(iterable(value)).size()!=value.size()) fail(path);
                for(var item:value) check(schema.path("items"),item,path);
            }
            case "string" -> {
                if(!value.isTextual()) fail(path);
                String text=value.asText();
                if(text.length()<schema.path("minLength").asInt(0) || text.length()>schema.path("maxLength").asInt(Integer.MAX_VALUE)) fail(path);
                if(schema.path("minLength").asInt(0)>0 && text.isBlank()) fail(path);
                try {
                    switch(schema.path("format").asText()) {
                        case "uri-reference" -> AvatarImages.validate(text);
                        case "uuid" -> UUID.fromString(text);
                        case "date-time" -> OffsetDateTime.parse(text);
                        case "uri" -> { URI uri=URI.create(text); if(!("http".equals(uri.getScheme()) || "https".equals(uri.getScheme())) || uri.getHost()==null || uri.getUserInfo()!=null || text.length()>2048) fail(path); }
                        default -> { }
                    }
                } catch(IllegalArgumentException | java.time.DateTimeException e) { fail(path); }
            }
            case "integer" -> { if(!value.isIntegralNumber() || !value.canConvertToInt()) fail(path); number(schema,value,path); }
            case "number" -> { if(!value.isNumber()) fail(path); number(schema,value,path); }
            case "boolean" -> { if(!value.isBoolean()) fail(path); }
            default -> { }
        }
    }
    private List<JsonNode> iterable(JsonNode value) { List<JsonNode> list=new ArrayList<>(); value.forEach(list::add);return list; }
    private void number(JsonNode schema,JsonNode value,String path) {
        if(schema.has("minimum") && value.asDouble()<schema.path("minimum").asDouble() || schema.has("maximum") && value.asDouble()>schema.path("maximum").asDouble()) fail(path);
    }
    private void fail(String path) { throw Problem.invalid("Некорректное поле: "+path); }
}
