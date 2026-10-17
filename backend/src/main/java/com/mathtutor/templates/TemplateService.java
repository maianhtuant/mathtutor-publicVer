package com.mathtutor.templates;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mathtutor.common.ApiException;
import com.mathtutor.common.Json;
import com.mathtutor.mathservice.MathModels.GenerateResponse;
import com.mathtutor.mathservice.MathModels.TemplateConfig;
import com.mathtutor.mathservice.MathModels.ValidateResponse;
import com.mathtutor.mathservice.MathServiceClient;
import com.mathtutor.templates.TemplateModels.ArchiveTemplatesRequest;
import com.mathtutor.templates.TemplateModels.CreateTemplateRequest;
import com.mathtutor.templates.TemplateModels.DeleteTemplatesRequest;
import com.mathtutor.templates.TemplateModels.MoveTemplatesRequest;
import com.mathtutor.templates.TemplateModels.PreviewRequest;
import com.mathtutor.templates.TemplateModels.TemplateView;
import com.mathtutor.templates.TemplateModels.UpdateTemplateRequest;
import com.mathtutor.templates.TemplateModels.VersionContent;
import com.mathtutor.templates.TemplateModels.VersionView;

@Service
public class TemplateService {

    private static final String VERSION_COLUMNS = """
            v.id, v.template_id, v.version_no, v.status, v.prompt_template, v.answer_formula, v.answer_mode,
            v.default_min, v.default_max, v.variables::text AS variables, v.constraints::text AS constraints,
            v.relative_tolerance_percent, v.absolute_tolerance, v.decimal_places, v.accept_rounded_decimal,
            v.engine_version, v.created_at, v.wrong_answer_formulas::text AS wrong_answer_formulas,
            v.figure::text AS figure
            """;

    /** A template's place (one subject, course, chapter or lesson) and everything above it. */
    private static final String PLACE_JOINS = """
            LEFT JOIN lessons pl ON pl.id = t.lesson_id
            LEFT JOIN chapters pch ON pch.id = COALESCE(t.chapter_id, pl.chapter_id)
            LEFT JOIN courses pc ON pc.id = COALESCE(t.course_id, pch.course_id)
            LEFT JOIN subjects s ON s.id = COALESCE(t.subject_id, pc.subject_id)
            """;
    private static final String PLACE_COLUMNS = """
            COALESCE(t.subject_id, pc.subject_id) AS "subjectId", pc.id AS "courseId", pch.id AS "chapterId",
            t.lesson_id AS "lessonId",
            CASE WHEN t.lesson_id IS NOT NULL THEN 'lesson' WHEN t.chapter_id IS NOT NULL THEN 'chapter'
                 WHEN t.course_id IS NOT NULL THEN 'course' WHEN t.subject_id IS NOT NULL THEN 'subject' END AS "placeType",
            COALESCE(t.lesson_id, t.chapter_id, t.course_id, t.subject_id) AS "placeId"
            """;

    private final JdbcClient jdbc;
    private final Json json;
    private final MathServiceClient math;

    public TemplateService(JdbcClient jdbc, Json json, MathServiceClient math) {
        this.jdbc = jdbc;
        this.json = json;
        this.math = math;
    }

    public List<Map<String, Object>> list() {
        return jdbc.sql("""
                SELECT t.id, t.label, t.topic_code AS "topicCode", COALESCE(s.name, t.subject) AS subject,
                       %s, t.active, t.created_at AS "createdAt", t.created_by AS "createdBy",
                       (SELECT full_name FROM users WHERE id = t.created_by) AS "createdByName",
                       (SELECT max(version_no) FROM math_template_versions v WHERE v.template_id = t.id) AS "latestVersion",
                       (SELECT max(version_no) FROM math_template_versions v WHERE v.template_id = t.id
                         AND v.status = 'published') AS "publishedVersion",
                       (SELECT v.answer_mode FROM math_template_versions v WHERE v.template_id = t.id
                         ORDER BY version_no DESC LIMIT 1) AS "answerMode"
                FROM math_templates t
                %s
                ORDER BY t.label
                """.formatted(PLACE_COLUMNS, PLACE_JOINS)).query().listOfRows();
    }

    /** Published versions of active templates, for the practice-set rule picker. */
    public List<Map<String, Object>> publishedVersions() {
        return jdbc.sql("""
                SELECT v.id AS "versionId", v.version_no AS "versionNo", v.answer_mode AS "answerMode",
                       v.prompt_template AS "promptTemplate", t.id AS "templateId", t.label, t.topic_code AS "topicCode",
                       %s, s.name AS "subjectName"
                FROM math_template_versions v JOIN math_templates t ON t.id = v.template_id
                %s
                WHERE v.status = 'published' AND t.active AND v.answer_mode <> 'display_only'
                ORDER BY t.label, v.version_no DESC
                """.formatted(PLACE_COLUMNS, PLACE_JOINS)).query().listOfRows();
    }

    public TemplateView get(UUID id) {
        var t = jdbc.sql("""
                SELECT t.id, t.label, t.topic_code, COALESCE(s.name, t.subject) AS subject, t.active, t.created_at,
                       t.notes, t.external_id, t.created_by AS "createdBy",
                       (SELECT full_name FROM users WHERE id = t.created_by) AS "createdByName", %s
                FROM math_templates t
                %s
                WHERE t.id = :id
                """.formatted(PLACE_COLUMNS, PLACE_JOINS))
                .param("id", id).query().listOfRows();
        if (t.isEmpty()) {
            throw ApiException.notFound("Template");
        }
        var row = t.getFirst();
        List<VersionView> versions = jdbc.sql("SELECT " + VERSION_COLUMNS
                        + " FROM math_template_versions v WHERE v.template_id = :id ORDER BY v.version_no DESC")
                .param("id", id).query(this::mapVersion).list();
        return new TemplateView(row.get("id").toString(), (String) row.get("label"), (String) row.get("topic_code"),
                (String) row.get("subject"), text(row.get("subjectId")),
                (Boolean) row.get("active"), String.valueOf(row.get("created_at")), versions,
                (String) row.get("notes"), (String) row.get("external_id"), text(row.get("placeType")),
                text(row.get("placeId")), text(row.get("courseId")), text(row.get("chapterId")), text(row.get("lessonId")),
                text(row.get("createdBy")), (String) row.get("createdByName"));
    }

    private static String text(Object o) {
        return o == null ? null : o.toString();
    }

    public VersionView version(UUID versionId) {
        return jdbc.sql("SELECT " + VERSION_COLUMNS + " FROM math_template_versions v WHERE v.id = :id")
                .param("id", versionId).query(this::mapVersion).optional()
                .orElseThrow(() -> ApiException.notFound("Template version"));
    }

    @Transactional
    public TemplateView create(UUID adminId, CreateTemplateRequest req) {
        checkContent(req.version());
        UUID id = jdbc.sql("""
                INSERT INTO math_templates (label, topic_code, subject, subject_id, course_id, chapter_id, lesson_id, active,
                    created_by)
                VALUES (:label, :topic, :subject, :sid, :cid, :chid, :lid, :active, :by) RETURNING id
                """).param("label", req.label().strip()).param("topic", req.topicCode())
                .param("subject", req.subjectId() != null ? subjectName(req.subjectId())
                        : req.subject() == null || req.subject().isBlank() ? "Math" : req.subject().strip())
                .params(req.placeType() != null ? place(req.placeType(), req.placeId()) : place("subject", req.subjectId()))
                .param("active", req.active() == null || req.active()).param("by", adminId)
                .query(UUID.class).single();
        insertVersion(id, 1, req.version());
        return get(id);
    }

    @Transactional
    public TemplateView update(UUID id, UpdateTemplateRequest req) {
        get(id);
        jdbc.sql("""
                UPDATE math_templates SET label = COALESCE(:label, label), topic_code = COALESCE(:topic, topic_code),
                       subject = COALESCE(:subject, subject), active = COALESCE(:active, active)
                WHERE id = :id
                """).param("label", req.label()).param("topic", req.topicCode())
                .param("subject", req.subjectId() != null ? subjectName(req.subjectId()) : req.subject())
                .param("active", req.active()).param("id", id).update();
        // One place at a time: placeType wins; subjectId / clearSubject are the older way to set a subject.
        if (req.placeType() != null) {
            setPlace(List.of(id), req.placeType(), req.placeId());
        } else if (Boolean.TRUE.equals(req.clearSubject())) {
            setPlace(List.of(id), "none", null);
        } else if (req.subjectId() != null) {
            setPlace(List.of(id), "subject", req.subjectId());
        }
        return get(id);
    }

    /** Who created the template (teachers may only change their own). */
    public UUID creatorOf(UUID templateId) {
        return jdbc.sql("SELECT created_by FROM math_templates WHERE id = :id").param("id", templateId).query(UUID.class)
                .optional().orElseThrow(() -> ApiException.notFound("Template"));
    }

    public UUID creatorOfVersion(UUID versionId) {
        return jdbc.sql("""
                SELECT t.created_by FROM math_template_versions v JOIN math_templates t ON t.id = v.template_id WHERE v.id = :id
                """).param("id", versionId).query(UUID.class).optional().orElseThrow(() -> ApiException.notFound("Template version"));
    }

    /** Creators of these templates (unknown ids are left out). */
    public List<UUID> creators(List<UUID> ids) {
        return jdbc.sql("SELECT DISTINCT created_by FROM math_templates WHERE id IN (:ids)").param("ids", ids)
                .query(UUID.class).list();
    }

    /** Put many templates under one subject (or none) in one step; returns how many moved. */
    @Transactional
    public int move(MoveTemplatesRequest req) {
        List<UUID> ids = req.ids().stream().distinct().toList();
        long found = jdbc.sql("SELECT count(*) FROM math_templates WHERE id IN (:ids)").param("ids", ids).query(Long.class).single();
        if (found != ids.size()) {
            throw ApiException.notFound("Template");
        }
        return req.placeType() != null ? setPlace(ids, req.placeType(), req.placeId())
                : setPlace(ids, req.subjectId() == null ? "none" : "subject", req.subjectId());
    }

    /** Put templates at one place (subject, course, chapter or lesson; "none" = nowhere); returns how many changed. */
    private int setPlace(List<UUID> ids, String type, UUID placeId) {
        Map<String, Object> p = place(type, placeId);
        String name = "subject".equals(type) ? subjectName(placeId) : null;
        return jdbc.sql("""
                UPDATE math_templates SET subject_id = :sid, course_id = :cid, chapter_id = :chid, lesson_id = :lid,
                       subject = COALESCE(:name, subject)
                WHERE id IN (:ids)
                """).params(p).param("name", name).param("ids", ids).update();
    }

    /** Column values for a place; the place must exist. Type "none" (or a null id) means no place. */
    private Map<String, Object> place(String type, UUID placeId) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("sid", null);
        p.put("cid", null);
        p.put("chid", null);
        p.put("lid", null);
        if (type == null || "none".equals(type) || placeId == null) {
            return p;
        }
        String table = switch (type) {
            case "subject" -> "subjects";
            case "course" -> "courses";
            case "chapter" -> "chapters";
            case "lesson" -> "lessons";
            default -> throw ApiException.badRequest("invalid_place", "Unknown place type " + type);
        };
        long found = jdbc.sql("SELECT count(*) FROM " + table + " WHERE id = :id").param("id", placeId).query(Long.class).single();
        if (found == 0) {
            throw ApiException.notFound(Character.toUpperCase(type.charAt(0)) + type.substring(1));
        }
        p.put(switch (type) { case "subject" -> "sid"; case "course" -> "cid"; case "chapter" -> "chid"; default -> "lid"; }, placeId);
        return p;
    }

    /**
     * Archive or restore templates; returns how many changed. Archived = inactive: no new questions come from it, but
     * practice sets, lessons and past attempts that use it keep their history.
     */
    @Transactional
    public int archive(ArchiveTemplatesRequest req) {
        List<UUID> ids = req.ids().stream().distinct().toList();
        long found = jdbc.sql("SELECT count(*) FROM math_templates WHERE id IN (:ids)").param("ids", ids).query(Long.class).single();
        if (found != ids.size()) {
            throw ApiException.notFound("Template");
        }
        return jdbc.sql("UPDATE math_templates SET active = :active WHERE id IN (:ids) AND active <> :active")
                .param("active", !req.archived()).param("ids", ids).update();
    }

    /**
     * Delete templates (with all their versions) that nothing uses. A template used by a practice set (and so possibly
     * by student attempts), a lesson section's practice or a video is kept, with the reason, so history stays intact.
     */
    @Transactional
    public Map<String, Object> delete(DeleteTemplatesRequest req) {
        int deleted = 0;
        List<Map<String, Object>> kept = new ArrayList<>();
        for (UUID id : req.ids().stream().distinct().toList()) {
            String label = jdbc.sql("SELECT label FROM math_templates WHERE id = :id FOR UPDATE").param("id", id)
                    .query(String.class).optional().orElse(null);
            if (label == null) {
                continue; // already gone
            }
            List<String> sets = jdbc.sql("""
                    SELECT DISTINCT a.title FROM practice_set_rules r
                    JOIN math_template_versions v ON v.id = r.template_version_id JOIN assessments a ON a.id = r.assessment_id
                    WHERE v.template_id = :id ORDER BY a.title
                    """).param("id", id).query(String.class).list();
            long sections = jdbc.sql("SELECT count(*) FROM lesson_section_templates WHERE math_template_id = :id")
                    .param("id", id).query(Long.class).single();
            long videos = jdbc.sql("SELECT count(*) FROM videos WHERE math_template_id = :id").param("id", id)
                    .query(Long.class).single();
            List<String> uses = new ArrayList<>();
            if (!sets.isEmpty()) {
                uses.add("practice set" + (sets.size() == 1 ? " " : "s ") + String.join(", ", sets.stream().map(t -> "“" + t + "”").toList()));
            }
            if (sections > 0) {
                uses.add(sections + " lesson section" + (sections == 1 ? "" : "s"));
            }
            if (videos > 0) {
                uses.add(videos + " video" + (videos == 1 ? "" : "s"));
            }
            if (!uses.isEmpty()) {
                kept.add(Map.of("id", id, "label", label, "reason", "used by " + String.join(" and ", uses)));
                continue;
            }
            jdbc.sql("DELETE FROM math_template_versions WHERE template_id = :id").param("id", id).update();
            jdbc.sql("DELETE FROM math_templates WHERE id = :id").param("id", id).update();
            deleted++;
        }
        return Map.of("deleted", deleted, "kept", kept);
    }

    private String subjectName(UUID subjectId) {
        return jdbc.sql("SELECT name FROM subjects WHERE id = :id").param("id", subjectId).query(String.class).optional()
                .orElseThrow(() -> ApiException.notFound("Subject"));
    }

    /** New draft version; copies the latest version when no content is supplied. */
    @Transactional
    public VersionView createVersion(UUID templateId, VersionContent content) {
        jdbc.sql("SELECT id FROM math_templates WHERE id = :id FOR UPDATE").param("id", templateId).query(UUID.class)
                .optional().orElseThrow(() -> ApiException.notFound("Template"));
        int next = jdbc.sql("SELECT COALESCE(max(version_no), 0) + 1 FROM math_template_versions WHERE template_id = :id")
                .param("id", templateId).query(Integer.class).single();
        if (content == null) {
            VersionView latest = jdbc.sql("SELECT " + VERSION_COLUMNS + " FROM math_template_versions v "
                            + "WHERE v.template_id = :id ORDER BY v.version_no DESC LIMIT 1")
                    .param("id", templateId).query(this::mapVersion).single();
            content = toContent(latest);
        }
        checkContent(content);
        return version(insertVersion(templateId, next, content));
    }

    /** Drafts are editable; published versions are immutable (edit by creating a new version). */
    @Transactional
    public VersionView updateDraft(UUID versionId, VersionContent c) {
        String status = jdbc.sql("SELECT status FROM math_template_versions WHERE id = :id FOR UPDATE")
                .param("id", versionId).query(String.class).optional()
                .orElseThrow(() -> ApiException.notFound("Template version"));
        if (!"draft".equals(status)) {
            throw ApiException.conflict("version_not_draft", "Published versions are immutable; create a new version");
        }
        checkContent(c);
        var n = normalize(c);
        jdbc.sql("""
                UPDATE math_template_versions SET prompt_template = :prompt, answer_formula = :formula,
                    answer_mode = :mode, default_min = :dmin, default_max = :dmax,
                    variables = CAST(:vars AS jsonb), constraints = CAST(:cons AS jsonb),
                    relative_tolerance_percent = :rel, absolute_tolerance = :abs, decimal_places = :dp,
                    accept_rounded_decimal = :acc, wrong_answer_formulas = CAST(:wrong AS jsonb),
                    figure = CAST(:fig AS jsonb)
                WHERE id = :id
                """).params(versionParams(n)).param("id", versionId).update();
        return version(versionId);
    }

    public Map<String, Object> preview(UUID versionId, PreviewRequest req) {
        VersionView v = version(versionId);
        int count = req == null || req.count() == null ? 5 : req.count();
        String seed = req == null || req.seed() == null || req.seed().isBlank() ? UUID.randomUUID().toString() : req.seed();
        GenerateResponse r = math.generate(toConfig(v), count, seed, v.id(), req == null ? null : req.overrides());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("seed", seed);
        out.put("engineVersion", r.engineVersion());
        out.put("answerFormulaLatex", r.answerFormulaLatex());
        out.put("warnings", r.warnings());
        out.put("interchangeableGroups", r.interchangeableGroups());
        out.put("items", r.items());
        return out;
    }

    /** Validate unsaved form content (live preview in the editor). */
    public ValidateResponse validateContent(VersionContent c) {
        checkContent(c);
        return math.validate(toConfig(normalize(c)), 5);
    }

    @Transactional
    public VersionView publish(UUID versionId) {
        VersionView v = version(versionId);
        jdbc.sql("SELECT id FROM math_template_versions WHERE id = :id FOR UPDATE").param("id", versionId)
                .query(UUID.class).single();
        if (!"draft".equals(v.status())) {
            throw ApiException.conflict("version_not_draft", "Only draft versions can be published");
        }
        ValidateResponse result = math.validate(toConfig(v), 5);
        if (!result.valid()) {
            throw ApiException.unprocessable("template_invalid", "The template has validation errors", result.errors());
        }
        jdbc.sql("UPDATE math_template_versions SET status = 'published', engine_version = :ev WHERE id = :id")
                .param("ev", result.engineVersion()).param("id", versionId).update();
        return version(versionId);
    }

    @Transactional
    public VersionView archive(UUID versionId) {
        version(versionId);
        jdbc.sql("UPDATE math_template_versions SET status = 'archived' WHERE id = :id").param("id", versionId).update();
        return version(versionId);
    }

    // ---------------------------------------------------------------- helpers

    public TemplateConfig toConfig(VersionView v) {
        return toConfig(v, v.answerMode());
    }

    /** Config with a different answer mode, e.g. a fill-in template asked as multiple choice in a practice set. */
    public TemplateConfig toConfig(VersionView v, String answerMode) {
        return new TemplateConfig(v.promptTemplate(), v.answerFormula(), answerMode, v.defaultMin(), v.defaultMax(),
                v.variables(), v.constraints().stream().map(String::valueOf).toList(), v.relativeTolerancePercent(),
                v.absoluteTolerance(), v.decimalPlaces(), v.acceptRoundedDecimal(), v.wrongAnswerFormulas(), v.figure());
    }

    private TemplateConfig toConfig(Normalized n) {
        return new TemplateConfig(n.prompt, n.formula, n.mode, n.dmin, n.dmax, n.vars, n.cons, n.rel, n.abs, n.dp, n.acc, n.wrong,
                n.figure);
    }

    private record Normalized(String prompt, String formula, String mode, BigDecimal dmin, BigDecimal dmax,
                              Map<String, Object> vars, List<String> cons, BigDecimal rel, BigDecimal abs, int dp,
                              boolean acc, List<String> wrong, Map<String, Object> figure) {}

    private Normalized normalize(VersionContent c) {
        String formula = "display_only".equals(c.answerMode()) || c.answerFormula() == null || c.answerFormula().isBlank()
                ? null : c.answerFormula().strip();
        List<String> cons = c.constraints() == null ? List.of()
                : c.constraints().stream().filter(Objects::nonNull).map(String::strip).filter(s -> !s.isEmpty()).toList();
        List<String> wrong = "display_only".equals(c.answerMode()) || c.wrongAnswerFormulas() == null ? List.of()
                : c.wrongAnswerFormulas().stream().filter(Objects::nonNull).map(String::strip).filter(s -> !s.isEmpty()).toList();
        return new Normalized(c.promptTemplate(), formula, c.answerMode(),
                c.defaultMin() == null ? BigDecimal.ONE : c.defaultMin(),
                c.defaultMax() == null ? BigDecimal.TEN : c.defaultMax(),
                c.variables() == null ? Map.of() : c.variables(), cons,
                c.relativeTolerancePercent() == null ? BigDecimal.ZERO : c.relativeTolerancePercent(),
                c.absoluteTolerance() == null ? BigDecimal.ZERO : c.absoluteTolerance(),
                c.decimalPlaces() == null ? 2 : c.decimalPlaces(),
                c.acceptRoundedDecimal() != null && c.acceptRoundedDecimal(), wrong,
                c.figure() == null || c.figure().isEmpty() ? null : c.figure());
    }

    private void checkContent(VersionContent c) {
        boolean displayOnly = "display_only".equals(c.answerMode());
        if (!displayOnly && (c.answerFormula() == null || c.answerFormula().isBlank())) {
            throw ApiException.badRequest("formula_required", "An answer formula is required for graded templates");
        }
        if (c.defaultMin() != null && c.defaultMax() != null && c.defaultMin().compareTo(c.defaultMax()) > 0) {
            throw ApiException.badRequest("invalid_range", "Min must not exceed Max");
        }
    }

    private Map<String, Object> versionParams(Normalized n) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("prompt", n.prompt);
        p.put("formula", n.formula);
        p.put("mode", n.mode);
        p.put("dmin", n.dmin);
        p.put("dmax", n.dmax);
        p.put("vars", json.write(n.vars));
        p.put("cons", json.write(n.cons));
        p.put("rel", n.rel);
        p.put("abs", n.abs);
        p.put("dp", n.dp);
        p.put("acc", n.acc);
        p.put("wrong", json.write(n.wrong));
        p.put("fig", n.figure == null ? null : json.write(n.figure));
        return p;
    }

    private UUID insertVersion(UUID templateId, int versionNo, VersionContent c) {
        var n = normalize(c);
        return jdbc.sql("""
                INSERT INTO math_template_versions (template_id, version_no, status, prompt_template, answer_formula,
                    answer_mode, default_min, default_max, variables, constraints, relative_tolerance_percent,
                    absolute_tolerance, decimal_places, accept_rounded_decimal, wrong_answer_formulas, figure, engine_version)
                VALUES (:tid, :no, 'draft', :prompt, :formula, :mode, :dmin, :dmax, CAST(:vars AS jsonb),
                    CAST(:cons AS jsonb), :rel, :abs, :dp, :acc, CAST(:wrong AS jsonb), CAST(:fig AS jsonb), 'pending')
                RETURNING id
                """).params(versionParams(n)).param("tid", templateId).param("no", versionNo)
                .query(UUID.class).single();
    }

    private VersionContent toContent(VersionView v) {
        return new VersionContent(v.promptTemplate(), v.answerFormula(), v.answerMode(), v.defaultMin(), v.defaultMax(),
                v.variables(), v.constraints().stream().map(String::valueOf).toList(), v.relativeTolerancePercent(),
                v.absoluteTolerance(), v.decimalPlaces(), v.acceptRoundedDecimal(), v.wrongAnswerFormulas(), v.figure());
    }

    private VersionView mapVersion(ResultSet rs, int n) throws SQLException {
        return new VersionView(rs.getString("id"), rs.getString("template_id"), rs.getInt("version_no"),
                rs.getString("status"), rs.getString("prompt_template"), rs.getString("answer_formula"),
                rs.getString("answer_mode"), rs.getBigDecimal("default_min"), rs.getBigDecimal("default_max"),
                json.map(rs.getString("variables")), new ArrayList<>(json.list(rs.getString("constraints"))),
                rs.getBigDecimal("relative_tolerance_percent"), rs.getBigDecimal("absolute_tolerance"),
                rs.getInt("decimal_places"), rs.getBoolean("accept_rounded_decimal"), rs.getString("engine_version"),
                String.valueOf(rs.getObject("created_at")),
                json.list(rs.getString("wrong_answer_formulas")).stream().map(String::valueOf).toList(),
                rs.getString("figure") == null ? null : json.map(rs.getString("figure")));
    }
}
