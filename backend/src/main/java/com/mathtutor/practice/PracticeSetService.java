package com.mathtutor.practice;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mathtutor.common.ApiException;
import com.mathtutor.common.Json;
import com.mathtutor.mathservice.MathServiceClient;
import com.mathtutor.practice.PracticeModels.CreateQuestionRequest;
import com.mathtutor.practice.PracticeModels.CreateSetRequest;
import com.mathtutor.practice.PracticeModels.FixedQuestionInput;
import com.mathtutor.practice.PracticeModels.RuleInput;
import com.mathtutor.practice.PracticeModels.UpdateSetRequest;
import com.mathtutor.templates.TemplateService;

@Service
public class PracticeSetService {

    private final JdbcClient jdbc;
    private final Json json;
    private final TemplateService templates;
    private final MathServiceClient math;

    public PracticeSetService(JdbcClient jdbc, Json json, TemplateService templates, MathServiceClient math) {
        this.jdbc = jdbc;
        this.json = json;
        this.templates = templates;
        this.math = math;
    }

    /** Who created the practice set (teachers may only change their own). */
    public UUID creatorOf(UUID setId) {
        return jdbc.sql("SELECT created_by FROM assessments WHERE id = :id").param("id", setId).query(UUID.class)
                .optional().orElseThrow(() -> ApiException.notFound("Practice set"));
    }

    public List<Map<String, Object>> list(UUID courseId) {
        return jdbc.sql("""
                SELECT a.id, a.title, a.kind, a.status, a.course_id AS "courseId", c.title AS "courseTitle",
                       a.pass_percent AS "passPercent", a.time_limit_seconds AS "timeLimitSeconds",
                       a.max_attempts AS "maxAttempts", a.created_at AS "createdAt", a.created_by AS "createdBy",
                       (SELECT full_name FROM users WHERE id = a.created_by) AS "createdByName",
                       (SELECT COALESCE(sum(question_count), 0) FROM practice_set_rules r WHERE r.assessment_id = a.id AND r.removed_at IS NULL)
                         + (SELECT count(*) FROM assessment_questions q WHERE q.assessment_id = a.id AND q.removed_at IS NULL) AS "questionCount",
                       (SELECT COALESCE(sum(question_count * points_per_question), 0) FROM practice_set_rules r
                         WHERE r.assessment_id = a.id AND r.removed_at IS NULL)
                         + (SELECT COALESCE(sum(points), 0) FROM assessment_questions q WHERE q.assessment_id = a.id AND q.removed_at IS NULL) AS "maxScore",
                       (SELECT count(*) FROM practice_assignments p WHERE p.assessment_id = a.id AND p.status = 'active')
                         AS "activeAssignments"
                FROM assessments a JOIN courses c ON c.id = a.course_id
                WHERE (CAST(:course AS uuid) IS NULL OR a.course_id = :course)
                ORDER BY c.title, a.created_at
                """).param("course", courseId).query().listOfRows();
    }

    public Map<String, Object> get(UUID id) {
        var rows = jdbc.sql("""
                SELECT a.id, a.title, a.kind, a.status, a.course_id AS "courseId", c.title AS "courseTitle",
                       c.subject_id AS "courseSubjectId",
                       a.pass_percent AS "passPercent", a.time_limit_seconds AS "timeLimitSeconds",
                       a.max_attempts AS "maxAttempts", a.created_at AS "createdAt", a.created_by AS "createdBy",
                       (SELECT full_name FROM users WHERE id = a.created_by) AS "createdByName"
                FROM assessments a JOIN courses c ON c.id = a.course_id WHERE a.id = :id
                """).param("id", id).query().listOfRows();
        if (rows.isEmpty()) {
            throw ApiException.notFound("Practice set");
        }
        Map<String, Object> set = new LinkedHashMap<>(rows.getFirst());
        set.put("rules", rules(id));
        set.put("questions", jdbc.sql("""
                SELECT aq.question_id AS "questionId", aq.position, aq.points, q.prompt, q.topic_code AS "topicCode"
                FROM assessment_questions aq JOIN questions q ON q.id = aq.question_id
                WHERE aq.assessment_id = :id AND aq.removed_at IS NULL ORDER BY aq.position
                """).param("id", id).query().listOfRows());
        return set;
    }

    private List<Map<String, Object>> rules(UUID setId) {
        var rows = jdbc.sql("""
                SELECT r.id, r.position, r.question_count AS "questionCount", r.points_per_question AS "pointsPerQuestion",
                       r.variable_overrides::text AS overrides, r.template_version_id AS "templateVersionId",
                       v.version_no AS "versionNo", v.status AS "versionStatus", v.answer_mode AS "templateAnswerMode",
                       r.answer_mode AS "answerMode",
                       jsonb_array_length(v.wrong_answer_formulas) AS "wrongAnswerCount",
                       t.id AS "templateId", t.label, t.topic_code AS "topicCode", t.active AS "templateActive"
                FROM practice_set_rules r
                JOIN math_template_versions v ON v.id = r.template_version_id
                JOIN math_templates t ON t.id = v.template_id
                WHERE r.assessment_id = :id AND r.removed_at IS NULL ORDER BY r.position
                """).param("id", setId).query().listOfRows();
        List<Map<String, Object>> out = new ArrayList<>();
        for (var r : rows) {
            Map<String, Object> m = new LinkedHashMap<>(r);
            m.put("variableOverrides", json.map(m.remove("overrides")));
            out.add(m);
        }
        return out;
    }

    @Transactional
    public Map<String, Object> create(UUID adminId, CreateSetRequest req) {
        jdbc.sql("SELECT id FROM courses WHERE id = :id").param("id", req.courseId()).query(UUID.class).optional()
                .orElseThrow(() -> ApiException.notFound("Course"));
        UUID id = jdbc.sql("""
                INSERT INTO assessments (course_id, title, kind, pass_percent, time_limit_seconds, max_attempts, created_by)
                VALUES (:course, :title, :kind, :pass, :tl, :ma, :by) RETURNING id
                """).param("course", req.courseId()).param("title", req.title().strip())
                .param("kind", req.kind() == null ? "practice" : req.kind())
                .param("pass", req.passPercent() == null ? new BigDecimal("60") : req.passPercent())
                .param("tl", req.timeLimitSeconds()).param("ma", req.maxAttempts()).param("by", adminId)
                .query(UUID.class).single();
        return get(id);
    }

    @Transactional
    public Map<String, Object> update(UUID id, UpdateSetRequest req) {
        requireEditable(id);
        jdbc.sql("""
                UPDATE assessments SET title = COALESCE(:title, title), pass_percent = COALESCE(:pass, pass_percent),
                  time_limit_seconds = CASE WHEN :clearTl THEN NULL ELSE COALESCE(:tl, time_limit_seconds) END,
                  max_attempts = CASE WHEN :clearMa THEN NULL ELSE COALESCE(:ma, max_attempts) END
                WHERE id = :id
                """).param("title", req.title()).param("pass", req.passPercent()).param("tl", req.timeLimitSeconds())
                .param("ma", req.maxAttempts()).param("clearTl", Boolean.TRUE.equals(req.clearTimeLimit()))
                .param("clearMa", Boolean.TRUE.equals(req.clearMaxAttempts())).param("id", id).update();
        return get(id);
    }

    /**
     * Replace the template rows (position = list order). Works on drafts and published sets:
     * rows that past attempts used are kept but marked removed, so those attempts stay valid;
     * changes only affect attempts started afterwards.
     */
    @Transactional
    public Map<String, Object> putRules(UUID id, List<RuleInput> rules) {
        String status = requireEditable(id);
        for (RuleInput r : rules) {
            String mode = jdbc.sql("SELECT answer_mode FROM math_template_versions WHERE id = :v")
                    .param("v", r.templateVersionId()).query(String.class).optional()
                    .orElseThrow(() -> ApiException.notFound("Template version"));
            if ("display_only".equals(mode)) {
                throw ApiException.badRequest("display_only_template", "Display-only templates cannot be used in graded sets");
            }
        }
        // Existing active rows, by id -> template version. A row is kept only if its template version is unchanged.
        Map<UUID, UUID> existing = new HashMap<>();
        jdbc.sql("SELECT id, template_version_id FROM practice_set_rules WHERE assessment_id = :id AND removed_at IS NULL")
                .param("id", id).query((rs, n) -> existing.put(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class))).list();
        Set<UUID> kept = new HashSet<>();
        for (RuleInput r : rules) {
            if (r.id() != null && r.templateVersionId().equals(existing.get(r.id())) && !kept.add(r.id())) {
                throw ApiException.badRequest("duplicate_row", "The same row appears twice");
            }
        }
        for (UUID old : existing.keySet()) {
            if (kept.contains(old)) {
                continue;
            }
            boolean used = jdbc.sql("SELECT EXISTS (SELECT 1 FROM attempt_items WHERE source_rule_id = :r)")
                    .param("r", old).query(Boolean.class).single();
            jdbc.sql(used ? "UPDATE practice_set_rules SET removed_at = now() WHERE id = :r"
                          : "DELETE FROM practice_set_rules WHERE id = :r").param("r", old).update();
        }
        // Move kept rows out of the way so the new order never collides with the unique position index.
        jdbc.sql("UPDATE practice_set_rules SET position = position + 1000000 WHERE assessment_id = :id AND removed_at IS NULL")
                .param("id", id).update();
        int pos = 1;
        for (RuleInput r : rules) {
            String overrides = json.write(r.variableOverrides() == null ? Map.of() : r.variableOverrides());
            BigDecimal points = r.pointsPerQuestion() == null ? BigDecimal.ONE : r.pointsPerQuestion();
            if (r.id() != null && kept.contains(r.id())) {
                jdbc.sql("""
                        UPDATE practice_set_rules SET position = :p, question_count = :c, points_per_question = :pts,
                            variable_overrides = CAST(:o AS jsonb), answer_mode = :m
                        WHERE id = :r
                        """).param("m", r.answerMode()).param("p", pos++).param("c", r.questionCount()).param("pts", points).param("o", overrides)
                        .param("r", r.id()).update();
            } else {
                jdbc.sql("""
                        INSERT INTO practice_set_rules (assessment_id, template_version_id, position, question_count,
                            points_per_question, variable_overrides, answer_mode)
                        VALUES (:a, :v, :p, :c, :pts, CAST(:o AS jsonb), :m)
                        """).param("m", r.answerMode()).param("a", id).param("v", r.templateVersionId()).param("p", pos++)
                        .param("c", r.questionCount()).param("pts", points).param("o", overrides).update();
            }
        }
        if ("published".equals(status)) {
            checkPublishable(id);
        }
        return get(id);
    }

    @Transactional
    public Map<String, Object> putQuestions(UUID id, List<FixedQuestionInput> questions) {
        String status = requireEditable(id);
        var wanted = questions.stream().map(FixedQuestionInput::questionId).toList();
        if (new HashSet<>(wanted).size() != wanted.size()) {
            throw ApiException.badRequest("duplicate_question", "The same question appears twice");
        }
        var current = jdbc.sql("SELECT question_id FROM assessment_questions WHERE assessment_id = :id AND removed_at IS NULL")
                .param("id", id).query(UUID.class).list();
        for (UUID q : current) {
            if (wanted.contains(q)) {
                continue;
            }
            boolean used = jdbc.sql("SELECT EXISTS (SELECT 1 FROM attempt_items WHERE assessment_id = :a AND source_question_id = :q)")
                    .param("a", id).param("q", q).query(Boolean.class).single();
            jdbc.sql(used ? "UPDATE assessment_questions SET removed_at = now() WHERE assessment_id = :a AND question_id = :q"
                          : "DELETE FROM assessment_questions WHERE assessment_id = :a AND question_id = :q")
                    .param("a", id).param("q", q).update();
        }
        jdbc.sql("UPDATE assessment_questions SET position = position + 1000000 WHERE assessment_id = :id AND removed_at IS NULL")
                .param("id", id).update();
        int pos = 1;
        for (FixedQuestionInput q : questions) {
            // A question removed earlier (kept for history) is simply brought back.
            jdbc.sql("""
                    INSERT INTO assessment_questions (assessment_id, question_id, position, points)
                    VALUES (:a, :q, :p, :pts)
                    ON CONFLICT (assessment_id, question_id)
                    DO UPDATE SET position = EXCLUDED.position, points = EXCLUDED.points, removed_at = NULL
                    """).param("a", id).param("q", q.questionId()).param("p", pos++)
                    .param("pts", q.points() == null ? BigDecimal.ONE : q.points()).update();
        }
        if ("published".equals(status)) {
            checkPublishable(id);
        }
        return get(id);
    }

    /** Admin preview: generates questions with answers; never creates an attempt. */
    public Map<String, Object> preview(UUID id) {
        Map<String, Object> set = get(id);
        @SuppressWarnings("unchecked")
        var rules = (List<Map<String, Object>>) set.get("rules");
        String seed = UUID.randomUUID().toString();
        List<RuleGeneration.Row> rows = new ArrayList<>();
        for (var r : rules) {
            @SuppressWarnings("unchecked")
            var overrides = (Map<String, Object>) r.get("variableOverrides");
            rows.add(new RuleGeneration.Row((UUID) r.get("templateVersionId"), overrides,
                    ((Number) r.get("questionCount")).intValue(),
                    RuleGeneration.effectiveMode((String) r.get("answerMode"), (String) r.get("templateAnswerMode")),
                    ((Number) r.get("position")).intValue()));
        }
        List<Map<String, Object>> sections = new ArrayList<>();
        int position = 1;
        BigDecimal maxScore = BigDecimal.ZERO;
        if (!rows.isEmpty()) {
            var plan = RuleGeneration.plan(rows, seed, templates);
            var batch = math.generateBatch(plan.requests());
            var perRow = plan.split(batch.groups());
            for (int i = 0; i < rules.size(); i++) {
                var r = rules.get(i);
                List<Map<String, Object>> items = new ArrayList<>();
                for (var item : perRow.get(i)) {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("position", position++);
                    m.put("promptLatex", item.promptLatex());
                    m.put("figureSvg", item.figureSvg());
                    m.put("variables", item.variables());
                    m.put("answerDisplay", item.answerDisplay());
                    m.put("roundedAnswer", item.roundedAnswer());
                    m.put("options", item.options());
                    items.add(m);
                }
                BigDecimal pts = (BigDecimal) r.get("pointsPerQuestion");
                maxScore = maxScore.add(pts.multiply(BigDecimal.valueOf(items.size())));
                sections.add(Map.of("label", r.get("label"), "topicCode", r.get("topicCode"),
                        "versionNo", r.get("versionNo"), "pointsPerQuestion", pts, "answerMode", rows.get(i).mode(),
                        "items", items));
            }
        }
        @SuppressWarnings("unchecked")
        var fixed = (List<Map<String, Object>>) set.get("questions");
        for (var q : fixed) {
            maxScore = maxScore.add((BigDecimal) q.get("points"));
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("seed", seed);
        out.put("sections", sections);
        out.put("fixedQuestions", fixed);
        out.put("totalQuestions", position - 1 + fixed.size());
        out.put("maxScore", maxScore);
        return out;
    }

    @Transactional
    public Map<String, Object> publish(UUID id) {
        requireDraft(id);
        checkPublishable(id);
        jdbc.sql("UPDATE assessments SET status = 'published' WHERE id = :id").param("id", id).update();
        return get(id);
    }

    /** A published set must stay usable: rows exist, templates are published and active, generation works. */
    private void checkPublishable(UUID id) {
        @SuppressWarnings("unchecked")
        var rules = (List<Map<String, Object>>) get(id).get("rules");
        long fixed = jdbc.sql("SELECT count(*) FROM assessment_questions WHERE assessment_id = :id AND removed_at IS NULL").param("id", id)
                .query(Long.class).single();
        if (rules.isEmpty() && fixed == 0) {
            throw ApiException.unprocessable("empty_set", "Add at least one template row or fixed question", null);
        }
        for (var r : rules) {
            if (!"published".equals(r.get("versionStatus"))) {
                throw ApiException.unprocessable("version_not_published",
                        r.get("label") + " v" + r.get("versionNo") + " is not a published template version", null);
            }
            if (!Boolean.TRUE.equals(r.get("templateActive"))) {
                throw ApiException.unprocessable("template_inactive", r.get("label") + " is not active", null);
            }
        }
        // Each fixed question needs >= 2 options and exactly one correct option.
        var bad = jdbc.sql("""
                SELECT q.id FROM assessment_questions aq JOIN questions q ON q.id = aq.question_id
                WHERE aq.assessment_id = :id AND aq.removed_at IS NULL
                  AND ((SELECT count(*) FROM question_options o WHERE o.question_id = q.id) < 2
                    OR (SELECT count(*) FROM question_options o WHERE o.question_id = q.id AND o.is_correct) <> 1)
                """).param("id", id).query(UUID.class).list();
        if (!bad.isEmpty()) {
            throw ApiException.unprocessable("invalid_fixed_question", "Fixed questions need at least two options and one correct option", bad);
        }
        // Generate once to prove every rule can produce its question count before students start.
        preview(id);
    }

    @Transactional
    public Map<String, Object> archive(UUID id) {
        get(id);
        jdbc.sql("UPDATE assessments SET status = 'archived' WHERE id = :id").param("id", id).update();
        return get(id);
    }

    /** Drafts and published sets can be edited; archived sets are frozen. Returns the status. */
    private String requireEditable(UUID id) {
        String status = jdbc.sql("SELECT status FROM assessments WHERE id = :id FOR UPDATE").param("id", id)
                .query(String.class).optional().orElseThrow(() -> ApiException.notFound("Practice set"));
        if ("archived".equals(status)) {
            throw ApiException.conflict("set_archived", "Archived sets cannot be changed");
        }
        return status;
    }

    private void requireDraft(UUID id) {
        String status = jdbc.sql("SELECT status FROM assessments WHERE id = :id FOR UPDATE").param("id", id)
                .query(String.class).optional().orElseThrow(() -> ApiException.notFound("Practice set"));
        if (!"draft".equals(status)) {
            throw ApiException.conflict("set_not_draft", "Published sets are frozen; create a new set to change its structure");
        }
    }

    // ------------------------------------------------------------ question bank

    public List<Map<String, Object>> listQuestions() {
        var rows = jdbc.sql("""
                SELECT q.id, q.topic_code AS "topicCode", q.prompt, q.explanation, q.created_at AS "createdAt"
                FROM questions q ORDER BY q.created_at DESC
                """).query().listOfRows();
        List<Map<String, Object>> out = new ArrayList<>();
        for (var r : rows) {
            Map<String, Object> m = new LinkedHashMap<>(r);
            m.put("options", jdbc.sql("""
                    SELECT id, position, option_text AS "text", is_correct AS "isCorrect"
                    FROM question_options WHERE question_id = :id ORDER BY position
                    """).param("id", r.get("id")).query().listOfRows());
            out.add(m);
        }
        return out;
    }

    @Transactional
    public Map<String, Object> createQuestion(UUID adminId, CreateQuestionRequest req) {
        long correct = req.options().stream().filter(PracticeModels.OptionInput::isCorrect).count();
        if (correct != 1) {
            throw ApiException.badRequest("invalid_options", "Exactly one option must be correct");
        }
        UUID id = jdbc.sql("""
                INSERT INTO questions (topic_code, prompt, explanation, created_by) VALUES (:t, :p, :e, :by) RETURNING id
                """).param("t", req.topicCode() == null || req.topicCode().isBlank() ? "general" : req.topicCode())
                .param("p", req.prompt()).param("e", req.explanation()).param("by", adminId)
                .query(UUID.class).single();
        int pos = 1;
        for (var o : req.options()) {
            jdbc.sql("INSERT INTO question_options (question_id, option_text, position, is_correct) VALUES (:q, :t, :p, :c)")
                    .param("q", id).param("t", o.text()).param("p", pos++).param("c", o.isCorrect()).update();
        }
        return Map.of("id", id);
    }
}
