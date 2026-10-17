package com.mathtutor;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.boot.web.servlet.support.SpringBootServletInitializer;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Runs standalone ({@code bootRun}) or as ROOT.war deployed to WildFly / JBoss EAP.
 */
@SpringBootApplication
@EnableScheduling
@ConfigurationPropertiesScan
public class MathTutorApplication extends SpringBootServletInitializer {

    public static void main(String[] args) {
        SpringApplication.run(MathTutorApplication.class, args);
    }

    @Override
    protected SpringApplicationBuilder configure(SpringApplicationBuilder builder) {
        return builder.sources(MathTutorApplication.class);
    }
}
