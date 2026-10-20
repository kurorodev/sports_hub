package ru.sport.api;

import java.io.IOException;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;

/** Signup fields must follow the contract's JSON string type instead of Jackson scalar coercion. */
public class StrictStringDeserializer extends JsonDeserializer<String> {
    @Override public String deserialize(JsonParser parser,DeserializationContext context) throws IOException {
        if(!parser.hasToken(JsonToken.VALUE_STRING))return context.reportInputMismatch(String.class,"Ожидается строка");
        return parser.getText();
    }
}
