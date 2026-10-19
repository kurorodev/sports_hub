package ru.dvizh;

import java.util.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import ru.dvizh.api.*;
import ru.dvizh.service.*;
import static org.assertj.core.api.Assertions.*;

class ValidationRulesTest {
    final ObjectMapper mapper=new ObjectMapper();
    @Test void patchUsesContractIncludingNullAndUnknownFields() throws Exception {
        var validator=new PatchValidator(mapper);
        for(String input:List.of("{\"bio\":null}","{\"sportsRoles\":[\"ATHLETE\",\"COACH\"]}","{\"sportsPreferences\":[]}","{\"avatarUrl\":\"https://example.com/a.png\"}"))
            validator.validate("ProfilePatch",mapper.readTree(input));
        for(String input:List.of("{}","[]","null","{\"ratingPoints\":100}","{\"nickname\":null}","{\"sportsRoles\":[\"ATHLETE\",\"ATHLETE\"]}","{\"avatarUrl\":\"relative.png\"}","{\"avatarUrl\":\"javascript:alert(1)\"}","{\"avatarUrl\":\"https://user:password@example.com/a\"}"))
            assertThatThrownBy(()->validator.validate("ProfilePatch",mapper.readTree(input))).isInstanceOf(Problem.class);
        validator.validate("EventPatch",mapper.readTree("{\"startsAt\":\"2026-11-01T15:00:00+04:00\",\"maxParticipants\":null}"));
        for(String input:List.of("{\"joinMode\":\"OPEN\"}","{\"maxParticipants\":1}","{\"maxParticipants\":2.5}","{\"startsAt\":\"2026-11-01T15:00:00\"}","{\"location\":{\"city\":\"a\",\"address\":\"a\",\"latitude\":90.5}}"))
            assertThatThrownBy(()->validator.validate("EventPatch",mapper.readTree(input))).isInstanceOf(Problem.class);
    }
    @Test void rankBoundariesAndPaginationOverflow() {
        var views=new Views(null,null,mapper,30,80,160);
        int[] thresholds={0,29,30,79,80,159,160};
        var expected=List.of(Api.Rank.ROOKIE,Api.Rank.ROOKIE,Api.Rank.ACTIVE,Api.Rank.ACTIVE,Api.Rank.EXPERIENCED,Api.Rank.EXPERIENCED,Api.Rank.ELITE);
        for(int i=0;i<thresholds.length;i++)assertThat(views.rank(thresholds[i])).isEqualTo(expected.get(i));
        assertThat(PageResult.of(List.of(1,2),0,2,5).totalPages()).isEqualTo(3);
        for(int[] values:new int[][]{{-1,20},{0,0},{0,101},{Integer.MAX_VALUE,100}})
            assertThatThrownBy(()->PageResult.offset(values[0],values[1])).isInstanceOf(Problem.class);
    }
}
