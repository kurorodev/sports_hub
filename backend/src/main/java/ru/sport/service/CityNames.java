package ru.sport.service;

import java.io.IOException;
import java.util.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.io.ClassPathResource;
import ru.sport.api.Problem;

/** The same licensed city directory is used by the frontend suggestions. */
public final class CityNames {
    private static final Map<String,String> NAMES=load();
    private CityNames() {}
    private static String key(String value) {
        return value.strip().replaceAll("\\s+"," ").toLowerCase(Locale.ROOT).replace('ё','е');
    }
    private static Map<String,String> load() {
        try(var input=new ClassPathResource("russian-cities.json").getInputStream()) {
            var names=new HashMap<String,String>();
            for(var city:new ObjectMapper().readTree(input).path("cities"))names.put(key(city.asText()),city.asText());
            if(names.isEmpty())throw new IllegalStateException("City directory is empty");
            return Map.copyOf(names);
        } catch(IOException error) { throw new IllegalStateException("Cannot load city directory",error); }
    }
    public static String required(String value) {
        var name=value==null?null:NAMES.get(key(value));
        if(name==null)throw Problem.invalid("Выберите город из подсказок");
        return name;
    }
    public static String optional(String value) {
        return value==null || value.isBlank()?null:required(value);
    }
}
