package com.mathtutor.security;

import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public record AppProperties(Jwt jwt, MathService mathService, Seed seed, List<String> corsOrigins) {

    public record Jwt(String secret, long ttlMinutes) {}

    public record MathService(String url, String apiKey, int timeoutSeconds) {}

    public record Seed(boolean enabled, String adminEmail, String adminPassword, boolean demoData) {}
}
