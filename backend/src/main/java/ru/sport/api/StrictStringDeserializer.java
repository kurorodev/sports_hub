package ru.sport.api;

import java.io.IOException;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;

/** Числа и логические значения не превращаем в строки регистрации: типы заданы контрактом. */
public class StrictStringDeserializer extends JsonDeserializer<String> {
    @Override public String deserialize(JsonParser parser,DeserializationContext context) throws IOException {
        if(!parser.hasToken(JsonToken.VALUE_STRING))return context.reportInputMismatch(String.class,"Ожидается строка");
        return parser.getText();
    }
}
