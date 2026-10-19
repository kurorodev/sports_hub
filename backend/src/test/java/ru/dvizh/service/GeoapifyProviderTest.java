package ru.dvizh.service;

import java.net.URLDecoder;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;
import ru.dvizh.api.Problem;

class GeoapifyProviderTest {
    final HttpClient http=mock(HttpClient.class);
    @SuppressWarnings("unchecked") final HttpResponse<String> response=mock(HttpResponse.class);
    final GeoapifyProvider provider=new GeoapifyProvider("test-secret",new ObjectMapper(),http);
    void reply(int status,String body) throws Exception {
        when(response.statusCode()).thenReturn(status);when(response.body()).thenReturn(body);
        when(http.send(any(HttpRequest.class),org.mockito.ArgumentMatchers.<HttpResponse.BodyHandler<String>>any())).thenReturn(response);
    }
    @Test void normalizesAddressesAndEncodesQueryWithCityContext() throws Exception {
        reply(200,"{\"results\":[{\"place_id\":\"p\",\"city\":\"Самара\",\"address_line1\":\"площадь Куйбышева\",\"formatted\":\"Самара, площадь Куйбышева\",\"lat\":53.195561,\"lon\":50.101022}]}");
        var item=provider.suggest("площадь Куйбышева","Самара",5).getFirst();assertThat(item.latitude()).isEqualTo(53.195561);assertThat(item.longitude()).isEqualTo(50.101022);
        var request=ArgumentCaptor.forClass(HttpRequest.class);verify(http).send(request.capture(),org.mockito.ArgumentMatchers.<HttpResponse.BodyHandler<String>>any());
        assertThat(URLDecoder.decode(request.getValue().uri().getRawQuery(),StandardCharsets.UTF_8)).contains("format=json","lang=ru","text=Самара, площадь Куйбышева","limit=5");
        assertThat(request.getValue().timeout()).contains(Duration.ofSeconds(4));
    }
    @Test void reverseKeepsTheSelectedPointAndMissingAddressReturnsNull() throws Exception {
        reply(200,"{\"results\":[{\"city\":\"Самара\",\"address_line1\":\"площадь Куйбышева\",\"lat\":53.195561,\"lon\":50.101022}]}");
        var location=provider.reverse(53.196,50.102);assertThat(location.latitude()).isEqualTo(53.196);assertThat(location.longitude()).isEqualTo(50.102);
        reply(200,"{\"results\":[]}");assertThat(provider.reverse(53.196,50.102)).isNull();
    }
    @Test void providerFailuresAre503WithoutSecrets() throws Exception {
        for(int status:new int[]{429,502,503}) {
            reply(status,"{\"message\":\"test-secret\"}");
            assertThatThrownBy(()->provider.suggest("Самара",null,5)).isInstanceOfSatisfying(Problem.class,e->{assertThat(e.status).isEqualTo(503);assertThat(e.getMessage()).doesNotContain("test-secret","apiKey");});
        }
        when(http.send(any(HttpRequest.class),org.mockito.ArgumentMatchers.<HttpResponse.BodyHandler<String>>any())).thenThrow(new HttpTimeoutException("test-secret"));
        assertThatThrownBy(()->provider.reverse(53,50)).isInstanceOfSatisfying(Problem.class,e->{assertThat(e.status).isEqualTo(503);assertThat(e.getMessage()).doesNotContain("test-secret");});
    }
}
