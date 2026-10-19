package ru.dvizh;

import java.util.*;
import com.fasterxml.jackson.databind.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.assertj.core.api.Assertions.*;

abstract class ApiTestSupport {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    record Actor(MockHttpSession session,String csrf,String id) {}
    Actor login(String account) throws Exception {
        var result=mvc.perform(post("/api/v1/demo/session").contentType("application/json").content(mapper.writeValueAsString(Map.of("accountId",account)))).andReturn();
        assertThat(result.getResponse().getStatus()).as(result.getResponse().getContentAsString()).isEqualTo(200);
        var json=json(result);
        return new Actor((MockHttpSession)result.getRequest().getSession(false),json.path("csrfToken").asText(),json.path("user").path("id").asText());
    }
    MvcResult call(Actor actor,String method,String path,Object body,int expected) throws Exception {
        var request=switch(method){case "GET"->get(api(path));case "POST"->post(api(path));case "PATCH"->patch(api(path));case "DELETE"->delete(api(path));default->throw new IllegalArgumentException();};
        if(actor!=null)request.session(actor.session).header("X-CSRF-Token",actor.csrf);
        if(body!=null)request.contentType("application/json").content(body instanceof String s?s:mapper.writeValueAsString(body));
        var result=mvc.perform(request).andReturn();
        assertThat(result.getResponse().getStatus()).as(method+" "+path+" "+result.getResponse().getContentAsString()).isEqualTo(expected);return result;
    }
    JsonNode json(MvcResult result) throws Exception {return mapper.readTree(result.getResponse().getContentAsString());}
    JsonNode getJson(Actor actor,String path) throws Exception{return json(call(actor,"GET",path,null,200));}
    String createEvent(Actor actor,String mode,int capacity) throws Exception {
        Map<String,Object> body=new LinkedHashMap<>();
        body.put("title","Тестовая встреча "+UUID.randomUUID());body.put("description","Совместная спортивная активность для проверки API");
        body.put("sport",Map.of("customName","Флорбол"));body.put("startsAt",java.time.Instant.now().plusSeconds(864000).toString());
        body.put("location",Map.of("city","Самара","address","Спортивная площадка"));body.put("joinMode",mode);
        body.put("organizer",Map.of("type","USER","id",actor.id));body.put("maxParticipants",capacity);
        return json(call(actor,"POST","/events",body,201)).path("id").asText();
    }
    // All application paths are under /api/v1; tests can use concise resource paths.
    String api(String path){return path.startsWith("/api/")?path:"/api/v1"+path;}
}
