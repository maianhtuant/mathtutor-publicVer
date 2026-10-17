package com.mathtutor.common;

import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/** Small helper for jsonb columns, which are read and written as text. */
@Component
public class Json {
    private static final TypeReference<Map<String, Object>> MAP = new TypeReference<>() {};
    private static final TypeReference<List<Object>> LIST = new TypeReference<>() {};

    private final JsonMapper mapper;

    public Json(JsonMapper mapper) {
        this.mapper = mapper;
    }

    public String write(Object value) {
        return mapper.writeValueAsString(value);
    }

    public Map<String, Object> map(Object text) {
        return text == null ? Map.of() : mapper.readValue(text.toString(), MAP);
    }

    public List<Object> list(Object text) {
        return text == null ? List.of() : mapper.readValue(text.toString(), LIST);
    }

    public <T> T convert(Object value, Class<T> type) {
        return mapper.convertValue(value, type);
    }
}
