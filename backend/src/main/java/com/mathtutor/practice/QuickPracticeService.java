package com.mathtutor.practice;

import java.math.BigInteger;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

import com.mathtutor.attempts.Grader;
import com.mathtutor.common.ApiException;
import com.mathtutor.common.Rational;
import com.mathtutor.mathservice.MathServiceClient;
import com.mathtutor.templates.TemplateModels.VersionView;
import com.mathtutor.templates.TemplateService;

import jakarta.validation.constraints.NotBlank;

/**
 * Ungraded "try a problem" widget used on video and lesson pages: one fresh question at a time from a
 * template's latest published version. Expected answers stay on the server (in memory, 30 minutes) and
 * are revealed only after the student answers. Nothing is stored as an assessment attempt.
 */
@Service
public class QuickPracticeService {

    public record CheckRequest(@NotBlank String token, String answer, Integer optionIndex) {}

    private record Pending(UUID userId, String scope, Rational expected, List<Boolean> optionCorrect, VersionView version,
                           Instant expires) {}

    private static final int MAX_PENDING = 20_000;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final JdbcClient jdbc;
    private final TemplateService templates;
    private final MathServiceClient math;
    private final Map<String, Pending> pending = new ConcurrentHashMap<>();

    public QuickPracticeService(JdbcClient jdbc, TemplateService templates, MathServiceClient math) {
        this.jdbc = jdbc;
        this.templates = templates;
        this.math = math;
    }

    /**
     * @param scope identifies where the question was asked (e.g. "video:{id}"); checks must use the same scope.
     */
    public Map<String, Object> question(UUID userId, String scope, UUID templateId) {
        if (templateId == null) {
            throw ApiException.notFound("Practice for this lesson");
        }
        UUID versionId = jdbc.sql("""
                SELECT v.id FROM math_template_versions v JOIN math_templates t ON t.id = v.template_id
                WHERE v.template_id = :t AND v.status = 'published' AND t.active AND v.answer_mode <> 'display_only'
                ORDER BY v.version_no DESC LIMIT 1
                """).param("t", templateId).query(UUID.class).optional()
                .orElseThrow(() -> ApiException.conflict("no_published_version", "The linked template has no published version"));
        VersionView version = templates.version(versionId);
        var item = math.generate(templates.toConfig(version), 1, UUID.randomUUID().toString(), version.id(), null)
                .items().getFirst();

        evictExpired();
        if (pending.size() >= MAX_PENDING) {
            throw ApiException.conflict("busy", "Too many open practice questions; try again shortly");
        }
        String token = HexFormat.of().formatHex(RANDOM.generateSeed(16));
        Rational expected = new Rational(new BigInteger(item.expectedNumerator()), new BigInteger(item.expectedDenominator()));
        pending.put(token, new Pending(userId, scope, expected, item.options().stream().map(o -> o.isCorrect()).toList(),
                version, Instant.now().plusSeconds(1800)));

        String label = jdbc.sql("SELECT label FROM math_templates WHERE id = :t").param("t", templateId)
                .query(String.class).single();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("token", token);
        out.put("label", label);
        out.put("promptLatex", item.promptLatex());
        out.put("figureSvg", item.figureSvg());
        out.put("answerMode", version.answerMode());
        out.put("options", item.options().stream().map(o -> o.latex()).toList());
        return out;
    }

    public Map<String, Object> check(UUID userId, String scope, CheckRequest req) {
        Pending q = pending.remove(req.token());
        if (q == null || !q.userId().equals(userId) || !q.scope().equals(scope) || q.expires().isBefore(Instant.now())) {
            throw ApiException.conflict("question_expired", "This question expired; load a new one");
        }
        boolean correct;
        if (!q.optionCorrect().isEmpty()) {
            Integer i = req.optionIndex();
            if (i == null || i < 0 || i >= q.optionCorrect().size()) {
                pending.put(req.token(), q);
                throw ApiException.badRequest("invalid_answer", "Select one of the options");
            }
            correct = q.optionCorrect().get(i);
        } else {
            Rational response;
            try {
                response = Rational.parse(req.answer());
            } catch (IllegalArgumentException | ArithmeticException e) {
                pending.put(req.token(), q); // let the student fix a typo
                throw ApiException.badRequest("invalid_answer", "Invalid number: " + e.getMessage());
            }
            VersionView v = q.version();
            correct = Grader.isCorrect(response, q.expected(), v.relativeTolerancePercent(), v.absoluteTolerance(),
                    v.decimalPlaces(), v.acceptRoundedDecimal());
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("correct", correct);
        out.put("correctAnswer", q.expected().display());
        out.put("correctOptionIndex", q.optionCorrect().indexOf(Boolean.TRUE));
        return out;
    }

    private void evictExpired() {
        Instant now = Instant.now();
        pending.entrySet().removeIf(e -> e.getValue().expires().isBefore(now));
    }
}
