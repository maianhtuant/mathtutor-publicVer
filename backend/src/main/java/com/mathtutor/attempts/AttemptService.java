package com.mathtutor.attempts;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mathtutor.common.ApiException;
import com.mathtutor.common.Json;
import com.mathtutor.common.Rational;
import com.mathtutor.practice.RuleGeneration;
import com.mathtutor.mathservice.MathModels.Item;
import com.mathtutor.mathservice.MathServiceClient;
import com.mathtutor.templates.TemplateService;

/**
 * Practice attempts (design §4.3/§4.4). Every operation locks rows in the shared order
 * enrollment -> assignment -> attempt, and re-checks that the assignment is active.
 */
@Service
public class AttemptService {

    public record AnswerRequest(String rawAnswer, UUID selectedOptionId) {}

    private record SetRow(UUID id, UUID courseId, String kind, String status, BigDecimal passPercent,
                          Integer timeLimitSeconds, Integer maxAttempts) {}

    private record AttemptRow(UUID id, UUID assessmentId, UUID userId, UUID courseId, String status,
                              OffsetDateTime expiresAt) {
        boolean deadlinePassed() {
            return expiresAt != null && !OffsetDateTime.now().isBefore(expiresAt);
        }
    }

    private static final SecureRandom RANDOM = new SecureRandom();

    private final JdbcClient jdbc;
    private final Json json;
    private final MathServiceClient math;
    private final TemplateService templates;

    public AttemptService(JdbcClient jdbc, Json json, MathServiceClient math, TemplateService templates) {
        this.jdbc = jdbc;
        this.json = json;
        this.math = math;
        this.templates = templates;
    }

    // ------------------------------------------------------------------ start / resume

    @Transactional
    public Map<String, Object> startOrResume(UUID userId, UUID setId) {
        SetRow set = jdbc.sql("""
                SELECT id, course_id, kind, status, pass_percent, time_limit_seconds, max_attempts
                FROM assessments WHERE id = :id
                """).param("id", setId)
                .query((rs, n) -> new SetRow(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class), rs.getString(3),
                        rs.getString(4), rs.getBigDecimal(5), (Integer) rs.getObject(6), (Integer) rs.getObject(7)))
                .optional().orElseThrow(() -> ApiException.notFound("Practice set"));

        lockEnrollment(userId, set.courseId());
        lockActiveAssignment(userId, setId);

        var open = jdbc.sql("""
                SELECT id, assessment_id, user_id, course_id, status, expires_at FROM assessment_attempts
                WHERE assessment_id = :a AND user_id = :u AND status = 'in_progress' FOR UPDATE
                """).param("a", setId).param("u", userId).query(this::attemptRow).optional();
        if (open.isPresent()) {
            AttemptRow a = open.get();
            if (a.deadlinePassed()) {
                grade(a.id(), "expired");
            }
            return view(a.id(), userId, false);
        }

        if (!"published".equals(set.status())) {
            throw ApiException.conflict("set_not_available", "This practice set is not open for new attempts");
        }
        int used = jdbc.sql("SELECT count(*) FROM assessment_attempts WHERE assessment_id = :a AND user_id = :u")
                .param("a", setId).param("u", userId).query(Integer.class).single();
        if (set.maxAttempts() != null && used >= set.maxAttempts()) {
            throw ApiException.conflict("attempt_limit_reached", "You have used all " + set.maxAttempts() + " attempts");
        }

        var rules = jdbc.sql("""
                SELECT r.id, r.position, r.question_count, r.points_per_question, r.variable_overrides::text,
                       v.id, v.status, COALESCE(r.answer_mode, v.answer_mode), t.active, t.topic_code, t.label
                FROM practice_set_rules r
                JOIN math_template_versions v ON v.id = r.template_version_id
                JOIN math_templates t ON t.id = v.template_id
                WHERE r.assessment_id = :a AND r.removed_at IS NULL ORDER BY r.position
                """).param("a", setId).query((rs, n) -> new Object[] {
                    rs.getObject(1, UUID.class), rs.getInt(2), rs.getInt(3), rs.getBigDecimal(4), rs.getString(5),
                    rs.getObject(6, UUID.class), rs.getString(7), rs.getString(8), rs.getBoolean(9),
                    rs.getString(10), rs.getString(11)}).list();

        String seed = HexFormat.of().formatHex(RANDOM.generateSeed(16));
        List<RuleGeneration.Row> rows = new ArrayList<>();
        for (Object[] r : rules) {
            if (!"published".equals(r[6]) || !(Boolean) r[8] || "display_only".equals(r[7])) {
                throw ApiException.conflict("template_unavailable",
                        "Template '" + r[10] + "' is inactive or unpublished; contact your administrator");
            }
            rows.add(new RuleGeneration.Row((UUID) r[5], json.map(r[4]), (Integer) r[2], (String) r[7], (Integer) r[1]));
        }
        var fixed = jdbc.sql("""
                SELECT aq.question_id, aq.points, q.topic_code, q.prompt, q.explanation
                FROM assessment_questions aq JOIN questions q ON q.id = aq.question_id
                WHERE aq.assessment_id = :a AND aq.removed_at IS NULL ORDER BY aq.position
                """).param("a", setId).query((rs, n) -> new Object[] {
                    rs.getObject(1, UUID.class), rs.getBigDecimal(2), rs.getString(3), rs.getString(4), rs.getString(5)})
                .list();
        if (rows.isEmpty() && fixed.isEmpty()) {
            throw ApiException.conflict("empty_set", "This practice set has no questions");
        }

        // Generation failure throws before anything is inserted, so no attempt is consumed.
        // Rows of the same template are generated together so an attempt never repeats a question.
        var plan = rows.isEmpty() ? null : RuleGeneration.plan(rows, seed, templates);
        var batch = plan == null ? null : math.generateBatch(plan.requests());
        String engineVersion = batch == null ? "fixed-only" : batch.engineVersion();
        List<List<Item>> perRow = plan == null ? List.of() : plan.split(batch.groups());

        BigDecimal maxScore = BigDecimal.ZERO;
        for (int i = 0; i < rules.size(); i++) {
            maxScore = maxScore.add(((BigDecimal) rules.get(i)[3])
                    .multiply(BigDecimal.valueOf(perRow.get(i).size())));
        }
        for (Object[] q : fixed) {
            maxScore = maxScore.add((BigDecimal) q[1]);
        }

        UUID attemptId = jdbc.sql("""
                INSERT INTO assessment_attempts (assessment_id, user_id, course_id, attempt_no, generation_seed,
                    engine_version, expires_at, max_score)
                VALUES (:a, :u, :c, :no, :seed, :ev,
                    CASE WHEN CAST(:tl AS integer) IS NULL THEN NULL ELSE now() + make_interval(secs => CAST(:tl AS integer)) END,
                    :max)
                RETURNING id
                """).param("a", setId).param("u", userId).param("c", set.courseId()).param("no", used + 1)
                .param("seed", seed).param("ev", engineVersion).param("tl", set.timeLimitSeconds())
                .param("max", maxScore).query(UUID.class).single();

        int position = 1;
        for (int i = 0; i < rules.size(); i++) {
            Object[] r = rules.get(i);
            var version = templates.version((UUID) r[5]);
            for (Item item : perRow.get(i)) {
                UUID itemId = jdbc.sql("""
                        INSERT INTO attempt_items (attempt_id, assessment_id, position, source_rule_id, template_version_id,
                            topic_code, variables_snapshot, prompt_latex, answer_mode, expected_numerator,
                            expected_denominator, relative_tolerance_percent, absolute_tolerance, decimal_places,
                            accept_rounded_decimal, points, generation_fingerprint, figure_svg)
                        VALUES (:att, :a, :pos, :rule, :ver, :topic, CAST(:vars AS jsonb), :prompt, :mode,
                            CAST(:num AS numeric), CAST(:den AS numeric), :rel, :abs, :dp, :acc, :pts, :fp, :fig)
                        RETURNING id
                        """).param("att", attemptId).param("a", setId).param("pos", position++).param("rule", r[0])
                        .param("ver", r[5]).param("topic", r[9]).param("vars", json.write(item.variables()))
                        .param("prompt", item.promptLatex()).param("mode", r[7])
                        .param("num", item.expectedNumerator()).param("den", item.expectedDenominator())
                        .param("rel", version.relativeTolerancePercent()).param("abs", version.absoluteTolerance())
                        .param("dp", version.decimalPlaces()).param("acc", version.acceptRoundedDecimal())
                        .param("pts", r[3]).param("fp", item.fingerprint()).param("fig", item.figureSvg())
                        .query(UUID.class).single();
                int optPos = 1;
                for (var o : item.options()) {
                    jdbc.sql("""
                            INSERT INTO attempt_item_options (item_id, position, option_latex, is_correct)
                            VALUES (:i, :p, :l, :c)
                            """).param("i", itemId).param("p", optPos++).param("l", o.latex()).param("c", o.isCorrect())
                            .update();
                }
            }
        }
        // Fixed questions follow the template groups, in assessment_questions.position order.
        for (Object[] q : fixed) {
            UUID itemId = jdbc.sql("""
                    INSERT INTO attempt_items (attempt_id, assessment_id, position, source_question_id, topic_code,
                        prompt_latex, answer_mode, explanation_snapshot, points, generation_fingerprint)
                    VALUES (:att, :a, :pos, :q, :topic, :prompt, 'multiple_choice', :exp, :pts, :fp)
                    RETURNING id
                    """).param("att", attemptId).param("a", setId).param("pos", position++).param("q", q[0])
                    .param("topic", q[2]).param("prompt", q[3]).param("exp", q[4]).param("pts", q[1])
                    .param("fp", "question:" + q[0]).query(UUID.class).single();
            jdbc.sql("""
                    INSERT INTO attempt_item_options (item_id, position, option_latex, is_correct)
                    SELECT :i, position, option_text, is_correct FROM question_options WHERE question_id = :q
                    """).param("i", itemId).param("q", q[0]).update();
        }
        return view(attemptId, userId, false);
    }

    // ------------------------------------------------------------------ save answer

    @Transactional(noRollbackFor = ApiException.class)
    public Map<String, Object> saveAnswer(UUID userId, UUID attemptId, UUID itemId, AnswerRequest req) {
        AttemptRow a = lockOwnedAttempt(userId, attemptId);
        if (!"in_progress".equals(a.status())) {
            throw ApiException.conflict("attempt_finished", "This attempt has already been submitted");
        }
        if (a.deadlinePassed()) {
            grade(a.id(), "expired");
            throw ApiException.conflict("attempt_expired", "Time is up; the attempt was graded with your saved answers");
        }
        String mode = jdbc.sql("SELECT answer_mode FROM attempt_items WHERE id = :i AND attempt_id = :a")
                .param("i", itemId).param("a", attemptId).query(String.class).optional()
                .orElseThrow(() -> ApiException.notFound("Question"));

        String raw = req.rawAnswer() == null ? null : req.rawAnswer().strip();
        boolean clear = (raw == null || raw.isEmpty()) && req.selectedOptionId() == null;
        if (clear) {
            jdbc.sql("DELETE FROM attempt_answers WHERE attempt_id = :a AND item_id = :i")
                    .param("a", attemptId).param("i", itemId).update();
            return Map.of("itemId", itemId, "saved", true, "cleared", true);
        }
        if ("numeric".equals(mode)) {
            if (req.selectedOptionId() != null || raw == null) {
                throw ApiException.badRequest("invalid_answer", "This question needs a numeric answer");
            }
            Rational value;
            try {
                value = Rational.parse(raw);
            } catch (IllegalArgumentException | ArithmeticException e) {
                throw ApiException.badRequest("invalid_answer", "Invalid number: " + e.getMessage());
            }
            jdbc.sql("""
                    INSERT INTO attempt_answers (attempt_id, item_id, raw_answer, normalized_numerator,
                        normalized_denominator, answered_at)
                    VALUES (:a, :i, :raw, :num, :den, now())
                    ON CONFLICT (attempt_id, item_id) DO UPDATE SET raw_answer = EXCLUDED.raw_answer,
                        selected_option_id = NULL, normalized_numerator = EXCLUDED.normalized_numerator,
                        normalized_denominator = EXCLUDED.normalized_denominator, answered_at = now()
                    """).param("a", attemptId).param("i", itemId).param("raw", raw)
                    .param("num", new BigDecimal(value.numerator())).param("den", new BigDecimal(value.denominator()))
                    .update();
        } else {
            if (req.selectedOptionId() == null || (raw != null && !raw.isEmpty())) {
                throw ApiException.badRequest("invalid_answer", "Select one of the options");
            }
            boolean belongs = jdbc.sql("SELECT count(*) FROM attempt_item_options WHERE id = :o AND item_id = :i")
                    .param("o", req.selectedOptionId()).param("i", itemId).query(Long.class).single() > 0;
            if (!belongs) {
                throw ApiException.badRequest("invalid_option", "The option does not belong to this question");
            }
            jdbc.sql("""
                    INSERT INTO attempt_answers (attempt_id, item_id, selected_option_id, answered_at)
                    VALUES (:a, :i, :o, now())
                    ON CONFLICT (attempt_id, item_id) DO UPDATE SET selected_option_id = EXCLUDED.selected_option_id,
                        raw_answer = NULL, normalized_numerator = NULL, normalized_denominator = NULL, answered_at = now()
                    """).param("a", attemptId).param("i", itemId).param("o", req.selectedOptionId()).update();
        }
        return Map.of("itemId", itemId, "saved", true);
    }

    // ------------------------------------------------------------------ submit

    @Transactional
    public Map<String, Object> submit(UUID userId, UUID attemptId) {
        AttemptRow a = lockOwnedAttempt(userId, attemptId);
        if ("in_progress".equals(a.status())) {
            grade(a.id(), a.deadlinePassed() ? "expired" : "submitted");
        }
        return view(attemptId, userId, false);
    }

    /** Called by the expiration worker: lock assignment, then attempt; grade if still open and overdue. */
    @Transactional
    public boolean expireIfDue(UUID attemptId) {
        var head = jdbc.sql("SELECT user_id, assessment_id FROM assessment_attempts WHERE id = :id")
                .param("id", attemptId).query((rs, n) -> new UUID[] {rs.getObject(1, UUID.class), rs.getObject(2, UUID.class)})
                .optional();
        if (head.isEmpty()) {
            return false;
        }
        jdbc.sql("SELECT 1 FROM practice_assignments WHERE user_id = :u AND assessment_id = :a FOR UPDATE")
                .param("u", head.get()[0]).param("a", head.get()[1]).query(Integer.class).optional();
        var a = jdbc.sql("""
                SELECT id, assessment_id, user_id, course_id, status, expires_at FROM assessment_attempts
                WHERE id = :id FOR UPDATE
                """).param("id", attemptId).query(this::attemptRow).single();
        if ("in_progress".equals(a.status()) && a.deadlinePassed()) {
            grade(a.id(), "expired");
            return true;
        }
        return false;
    }

    /** Grades every item from its snapshot. Caller must hold the attempt lock. */
    private void grade(UUID attemptId, String finalStatus) {
        var items = jdbc.sql("""
                SELECT i.id, i.answer_mode, i.expected_numerator, i.expected_denominator, i.relative_tolerance_percent,
                       i.absolute_tolerance, i.decimal_places, i.accept_rounded_decimal, i.points,
                       a.item_id IS NOT NULL AS has_row, a.normalized_numerator, a.normalized_denominator,
                       o.is_correct AS option_correct, (a.raw_answer IS NOT NULL OR a.selected_option_id IS NOT NULL) AS answered
                FROM attempt_items i
                LEFT JOIN attempt_answers a ON a.attempt_id = i.attempt_id AND a.item_id = i.id
                LEFT JOIN attempt_item_options o ON o.id = a.selected_option_id
                WHERE i.attempt_id = :a ORDER BY i.position
                """).param("a", attemptId).query().listOfRows();
        BigDecimal score = BigDecimal.ZERO;
        for (var it : items) {
            boolean correct = false;
            if (Boolean.TRUE.equals(it.get("answered"))) {
                if ("numeric".equals(it.get("answer_mode"))) {
                    Rational expected = Rational.of((BigDecimal) it.get("expected_numerator"), (BigDecimal) it.get("expected_denominator"));
                    Rational response = Rational.of((BigDecimal) it.get("normalized_numerator"), (BigDecimal) it.get("normalized_denominator"));
                    correct = Grader.isCorrect(response, expected, (BigDecimal) it.get("relative_tolerance_percent"),
                            (BigDecimal) it.get("absolute_tolerance"), ((Number) it.get("decimal_places")).intValue(),
                            (Boolean) it.get("accept_rounded_decimal"));
                } else {
                    correct = Boolean.TRUE.equals(it.get("option_correct"));
                }
            }
            BigDecimal points = correct ? (BigDecimal) it.get("points") : BigDecimal.ZERO;
            score = score.add(points);
            if (Boolean.TRUE.equals(it.get("has_row"))) {
                jdbc.sql("UPDATE attempt_answers SET is_correct = :c, awarded_points = :p WHERE attempt_id = :a AND item_id = :i")
                        .param("c", correct).param("p", points).param("a", attemptId).param("i", it.get("id")).update();
            } else {
                jdbc.sql("""
                        INSERT INTO attempt_answers (attempt_id, item_id, is_correct, awarded_points) VALUES (:a, :i, false, 0)
                        """).param("a", attemptId).param("i", it.get("id")).update();
            }
        }
        jdbc.sql("""
                UPDATE assessment_attempts t SET status = :s,
                       submitted_at = CASE WHEN :s = 'expired' THEN GREATEST(now(), t.expires_at) ELSE now() END,
                       score = :score,
                       passed = (:score * 100 >= (SELECT pass_percent FROM assessments WHERE id = t.assessment_id) * t.max_score)
                WHERE id = :id
                """).param("s", finalStatus).param("score", score).param("id", attemptId).update();
    }

    // ------------------------------------------------------------------ read

    /**
     * Attempt with its questions. Correct answers, expected values and correctness flags are only
     * included once the attempt is finished (or for administrators).
     */
    @Transactional(readOnly = true)
    public Map<String, Object> view(UUID attemptId, UUID userId, boolean asAdmin) {
        var rows = jdbc.sql("""
                SELECT t.id, t.assessment_id AS "setId", a.title AS "setTitle", t.user_id AS "userId", t.attempt_no AS "attemptNo",
                       t.status, t.started_at AS "startedAt", t.expires_at AS "expiresAt", t.submitted_at AS "submittedAt",
                       t.score, t.max_score AS "maxScore", t.passed, a.pass_percent AS "passPercent",
                       t.engine_version AS "engineVersion", now() AS "serverTime"
                FROM assessment_attempts t JOIN assessments a ON a.id = t.assessment_id WHERE t.id = :id
                """).param("id", attemptId).query().listOfRows();
        if (rows.isEmpty() || (!asAdmin && !rows.getFirst().get("userId").equals(userId))) {
            throw ApiException.notFound("Attempt");
        }
        Map<String, Object> attempt = new LinkedHashMap<>(rows.getFirst());
        if (!asAdmin) {
            attempt.remove("engineVersion");
        }
        boolean finished = !"in_progress".equals(attempt.get("status"));
        boolean reveal = finished || asAdmin;

        var items = jdbc.sql("""
                SELECT i.id, i.position, i.topic_code AS "topicCode", i.prompt_latex AS "promptLatex", i.figure_svg AS "figureSvg",
                       i.answer_mode AS "answerMode", i.points, i.expected_numerator, i.expected_denominator,
                       i.decimal_places, i.explanation_snapshot AS explanation,
                       a.raw_answer AS "rawAnswer", a.selected_option_id AS "selectedOptionId",
                       a.is_correct AS "isCorrect", a.awarded_points AS "awardedPoints"
                FROM attempt_items i
                LEFT JOIN attempt_answers a ON a.attempt_id = i.attempt_id AND a.item_id = i.id
                WHERE i.attempt_id = :a ORDER BY i.position
                """).param("a", attemptId).query().listOfRows();
        var options = jdbc.sql("""
                SELECT o.id, o.item_id, o.position, o.option_latex AS latex, o.is_correct
                FROM attempt_item_options o JOIN attempt_items i ON i.id = o.item_id
                WHERE i.attempt_id = :a ORDER BY o.item_id, o.position
                """).param("a", attemptId).query().listOfRows();

        List<Map<String, Object>> out = new ArrayList<>();
        for (var it : items) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", it.get("id"));
            m.put("position", it.get("position"));
            m.put("topicCode", it.get("topicCode"));
            m.put("promptLatex", it.get("promptLatex"));
            m.put("figureSvg", it.get("figureSvg"));
            m.put("answerMode", it.get("answerMode"));
            m.put("points", it.get("points"));
            m.put("rawAnswer", it.get("rawAnswer"));
            m.put("selectedOptionId", it.get("selectedOptionId"));
            List<Map<String, Object>> opts = new ArrayList<>();
            for (var o : options) {
                if (o.get("item_id").equals(it.get("id"))) {
                    Map<String, Object> om = new LinkedHashMap<>();
                    om.put("id", o.get("id"));
                    om.put("position", o.get("position"));
                    om.put("latex", o.get("latex"));
                    if (reveal) {
                        om.put("isCorrect", o.get("is_correct"));
                    }
                    opts.add(om);
                }
            }
            m.put("options", opts);
            if (reveal) {
                m.put("isCorrect", it.get("isCorrect"));
                m.put("awardedPoints", it.get("awardedPoints"));
                m.put("explanation", it.get("explanation"));
                if (it.get("expected_numerator") != null) {
                    Rational y = Rational.of((BigDecimal) it.get("expected_numerator"), (BigDecimal) it.get("expected_denominator"));
                    m.put("correctAnswer", y.display());
                    m.put("correctAnswerRounded", y.fixed(((Number) it.get("decimal_places")).intValue()));
                }
            }
            out.add(m);
        }
        attempt.put("items", out);
        if (finished) {
            attempt.put("skills", skills(attemptId));
            attempt.put("review", review(attemptId, (UUID) attempt.get("userId"), (Number) attempt.get("passPercent")));
        }
        return attempt;
    }

    /** Results by skill for one finished attempt (design §7). */
    public List<Map<String, Object>> skills(UUID attemptId) {
        return jdbc.sql("""
                SELECT i.topic_code AS "topicCode",
                       COUNT(*) AS "totalQuestions",
                       COUNT(*) FILTER (WHERE a.is_correct IS TRUE) AS "correctQuestions",
                       ROUND(100.0 * COUNT(*) FILTER (WHERE a.is_correct IS TRUE) / COUNT(*), 2) AS "accuracyPercent",
                       SUM(COALESCE(a.awarded_points, 0)) AS score,
                       SUM(i.points) AS "maxScore"
                FROM attempt_items i
                JOIN assessment_attempts t ON t.id = i.attempt_id
                LEFT JOIN attempt_answers a ON a.attempt_id = i.attempt_id AND a.item_id = i.id
                WHERE i.attempt_id = :a AND t.status IN ('submitted', 'expired')
                GROUP BY i.topic_code ORDER BY MIN(i.position)
                """).param("a", attemptId).query().listOfRows();
    }

    /**
     * "Learn this again": every skill below the set's pass mark, with the published lessons (in courses the student
     * is enrolled in) whose section practice uses the same template, the attempt's own course first. When no lesson
     * practises it, the template's subject is given so the student still knows what to revise.
     */
    public List<Map<String, Object>> review(UUID attemptId, UUID userId, Number passPercent) {
        double bar = passPercent == null ? 70 : passPercent.doubleValue();
        List<Map<String, Object>> out = new ArrayList<>();
        for (var skill : jdbc.sql("""
                SELECT i.topic_code AS "topicCode", MIN(mt.label) AS label, MIN(sub.name) AS "subjectName",
                       COUNT(*) AS "totalQuestions",
                       COUNT(*) FILTER (WHERE a.is_correct IS TRUE) AS "correctQuestions",
                       ROUND(100.0 * COUNT(*) FILTER (WHERE a.is_correct IS TRUE) / COUNT(*)) AS "accuracyPercent"
                FROM attempt_items i
                LEFT JOIN attempt_answers a ON a.attempt_id = i.attempt_id AND a.item_id = i.id
                LEFT JOIN math_template_versions v ON v.id = i.template_version_id
                LEFT JOIN math_templates mt ON mt.id = v.template_id
                LEFT JOIN subjects sub ON sub.id = mt.subject_id
                WHERE i.attempt_id = :a
                GROUP BY i.topic_code ORDER BY MIN(i.position)
                """).param("a", attemptId).query().listOfRows()) {
            if (((Number) skill.get("accuracyPercent")).doubleValue() >= bar) {
                continue;
            }
            Map<String, Object> m = new LinkedHashMap<>(skill);
            m.put("lessons", jdbc.sql("""
                    SELECT l.id AS "lessonId", l.title AS "lessonTitle", l.position AS "lessonPosition",
                           ch.title AS "chapterTitle", ch.position AS "chapterPosition", c.title AS "courseTitle"
                    FROM lessons l
                    JOIN chapters ch ON ch.id = l.chapter_id
                    JOIN courses c ON c.id = l.course_id AND c.status = 'published'
                    JOIN enrollments e ON e.course_id = c.id AND e.user_id = :u AND e.status = 'active'
                    WHERE l.status = 'published' AND l.id IN (
                        SELECT s.lesson_id FROM lesson_sections s
                        JOIN lesson_section_templates st ON st.section_id = s.id
                        JOIN math_template_versions v ON v.template_id = st.math_template_id
                        JOIN attempt_items i ON i.template_version_id = v.id
                        WHERE i.attempt_id = :a AND i.topic_code = :topic)
                    ORDER BY (c.id = (SELECT course_id FROM assessment_attempts WHERE id = :a)) DESC,
                             c.title, ch.position, l.position
                    LIMIT 3
                    """).param("u", userId).param("a", attemptId).param("topic", skill.get("topicCode"))
                    .query().listOfRows());
            out.add(m);
        }
        return out;
    }

    // ------------------------------------------------------------------ locking helpers

    private void lockEnrollment(UUID userId, UUID courseId) {
        jdbc.sql("SELECT 1 FROM enrollments WHERE user_id = :u AND course_id = :c AND status = 'active' FOR UPDATE")
                .param("u", userId).param("c", courseId).query(Integer.class).optional()
                .orElseThrow(() -> ApiException.forbidden("You are not assigned to this practice set"));
    }

    private void lockActiveAssignment(UUID userId, UUID setId) {
        String status = jdbc.sql("""
                SELECT status FROM practice_assignments WHERE user_id = :u AND assessment_id = :a FOR UPDATE
                """).param("u", userId).param("a", setId).query(String.class).optional().orElse(null);
        if (!"active".equals(status)) {
            throw ApiException.forbidden("You are not assigned to this practice set");
        }
    }

    /** Ownership check, then assignment lock, then attempt lock. */
    private AttemptRow lockOwnedAttempt(UUID userId, UUID attemptId) {
        var head = jdbc.sql("SELECT id, assessment_id, user_id, course_id, status, expires_at FROM assessment_attempts WHERE id = :id")
                .param("id", attemptId).query(this::attemptRow).optional();
        if (head.isEmpty() || !head.get().userId().equals(userId)) {
            throw ApiException.notFound("Attempt");
        }
        lockActiveAssignment(userId, head.get().assessmentId());
        return jdbc.sql("SELECT id, assessment_id, user_id, course_id, status, expires_at FROM assessment_attempts WHERE id = :id FOR UPDATE")
                .param("id", attemptId).query(this::attemptRow).single();
    }

    private AttemptRow attemptRow(java.sql.ResultSet rs, int n) throws java.sql.SQLException {
        return new AttemptRow(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class), rs.getObject(3, UUID.class),
                rs.getObject(4, UUID.class), rs.getString(5), rs.getObject(6, OffsetDateTime.class));
    }
}
