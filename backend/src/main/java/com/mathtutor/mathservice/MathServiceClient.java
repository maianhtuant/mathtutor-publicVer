package com.mathtutor.mathservice;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import com.mathtutor.common.ApiException;
import com.mathtutor.common.Json;
import com.mathtutor.mathservice.MathModels.BatchRequest;
import com.mathtutor.mathservice.MathModels.BatchResponse;
import com.mathtutor.mathservice.MathModels.GenerateRequest;
import com.mathtutor.mathservice.MathModels.GenerateResponse;
import com.mathtutor.mathservice.MathModels.TemplateConfig;
import com.mathtutor.mathservice.MathModels.ValidateRequest;
import com.mathtutor.mathservice.MathModels.ValidateResponse;
import com.mathtutor.security.AppProperties;

/** HTTP client for the SymPy math-service, which generates questions and exact answers. */
@Component
public class MathServiceClient {
    private static final Logger log = LoggerFactory.getLogger(MathServiceClient.class);

    private final RestClient client;
    private final Json json;

    public MathServiceClient(RestClient.Builder builder, AppProperties props, Json json) {
        var cfg = props.mathService();
        var http = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(5)).build();
        var factory = new JdkClientHttpRequestFactory(http);
        factory.setReadTimeout(Duration.ofSeconds(cfg.timeoutSeconds()));
        RestClient.Builder b = builder.baseUrl(cfg.url()).requestFactory(factory);
        if (cfg.apiKey() != null && !cfg.apiKey().isBlank()) {
            b = b.defaultHeader("X-API-Key", cfg.apiKey());
        }
        this.client = b.build();
        this.json = json;
    }

    public GenerateResponse generate(TemplateConfig template, int count, String seed, String salt,
                                     Map<String, Object> overrides) {
        return call(() -> client.post().uri("/v1/generate")
                .body(new GenerateRequest(template, count, seed, salt, overrides == null ? Map.of() : overrides))
                .retrieve().body(GenerateResponse.class));
    }

    public BatchResponse generateBatch(List<GenerateRequest> groups) {
        return call(() -> client.post().uri("/v1/generate/batch").body(new BatchRequest(groups))
                .retrieve().body(BatchResponse.class));
    }

    public ValidateResponse validate(TemplateConfig template, int sampleCount) {
        return call(() -> client.post().uri("/v1/templates/validate").body(new ValidateRequest(template, sampleCount))
                .retrieve().body(ValidateResponse.class));
    }

    private <T> T call(java.util.function.Supplier<T> request) {
        try {
            return request.get();
        } catch (HttpClientErrorException e) {
            Map<String, Object> body = safeBody(e);
            if (e.getStatusCode().value() == 422 && body.containsKey("error")) {
                throw ApiException.unprocessable(String.valueOf(body.get("error")),
                        String.valueOf(body.getOrDefault("message", "Generation failed")), null);
            }
            log.warn("math-service rejected request: {} {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw ApiException.unprocessable("math_service_rejected", "Template configuration was rejected", body);
        } catch (RestClientResponseException | ResourceAccessException e) {
            log.error("math-service unavailable", e);
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "math_service_unavailable",
                    "The math service is unavailable. Try again later.");
        }
    }

    private Map<String, Object> safeBody(RestClientResponseException e) {
        try {
            return json.map(e.getResponseBodyAsString());
        } catch (RuntimeException ex) {
            return Map.of();
        }
    }
}
