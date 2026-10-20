package ru.sport.service;

import java.util.*;

/** Поиск с одной опечаткой: шаблоны LIKE параметризованы, количество вариантов ограничено. */
final class EventTextSearch {
    private EventTextSearch() {}

    static String condition(String query, Map<String,Object> params) {
        String text=normalize(query);
        String exact=matches(List.of(literal(text)),params);
        String[] words=text.split("\\s+");
        // Длинный запрос или пунктуацию ищем буквально, чтобы ограничить размер SQL и число вариантов.
        if(text.length()>64 || words.length>4 || !text.matches("[\\p{L}\\p{N}]+(?:\\s+[\\p{L}\\p{N}]+)*"))return exact;
        var conditions=new ArrayList<String>();
        for(String word:words)conditions.add(matches(patterns(word),params));
        return "("+exact+" or ("+String.join(" and ",conditions)+"))";
    }

    private static Set<String> patterns(String word) {
        var patterns=new LinkedHashSet<String>();patterns.add(word);
        // Короткие фрагменты ищем точно: допуск опечатки давал бы слишком много посторонних встреч.
        if(word.length()<5 || word.length()>24)return patterns;
        for(int i=0;i<word.length();i++) {
            patterns.add(word.substring(0,i)+"_"+word.substring(i+1)); // замена буквы
            patterns.add(word.substring(0,i)+word.substring(i+1)); // лишняя буква в запросе
            if(i+1<word.length())patterns.add(word.substring(0,i)+word.charAt(i+1)+word.charAt(i)+word.substring(i+2));
        }
        for(int i=0;i<=word.length();i++)patterns.add(word.substring(0,i)+"_"+word.substring(i)); // пропущенная буква в запросе
        return patterns;
    }

    private static String matches(Collection<String> patterns, Map<String,Object> params) {
        var alternatives=new ArrayList<String>();
        for(String pattern:patterns) {
            String name="eventText"+params.size();params.put(name,"%"+pattern+"%");
            for(String field:List.of("title","description","customSportName"))
                alternatives.add("replace(lower(e."+field+"),'ё','е') like :"+name+" escape '!' ");
        }
        return "("+String.join(" or ",alternatives)+")";
    }

    private static String literal(String value) {
        // Пользовательские % и _ ищем как символы, а не как шаблоны SQL.
        return value.replace("!","!!").replace("%","!%").replace("_","!_");
    }
    private static String normalize(String value) {
        return value.strip().toLowerCase(Locale.ROOT).replace('ё','е');
    }
}
