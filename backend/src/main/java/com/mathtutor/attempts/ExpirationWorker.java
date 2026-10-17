package com.mathtutor.attempts;

import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Finishes timed attempts whose deadline passed, grading the answers saved so far. */
@Component
public class ExpirationWorker {
    private static final Logger log = LoggerFactory.getLogger(ExpirationWorker.class);

    private final JdbcClient jdbc;
    private final AttemptService attempts;

    public ExpirationWorker(JdbcClient jdbc, AttemptService attempts) {
        this.jdbc = jdbc;
        this.attempts = attempts;
    }

    @Scheduled(fixedDelayString = "${app.expiration-interval-ms:30000}", initialDelayString = "${app.expiration-interval-ms:30000}")
    public void run() {
        var due = jdbc.sql("""
                SELECT id FROM assessment_attempts WHERE status = 'in_progress' AND expires_at <= now()
                ORDER BY expires_at LIMIT 200
                """).query(UUID.class).list();
        for (UUID id : due) {
            try {
                if (attempts.expireIfDue(id)) {
                    log.info("Expired attempt {} graded", id);
                }
            } catch (RuntimeException e) {
                log.warn("Could not expire attempt {}: {}", id, e.getMessage());
            }
        }
    }
}
