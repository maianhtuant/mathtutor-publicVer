package com.mathtutor.videos;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mathtutor.common.ApiException;
import com.mathtutor.practice.QuickPracticeService;
import com.mathtutor.security.CurrentUser.Principal;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Video lessons grouped by subject, plus the one-question practice widget on the video page. */
@Service
public class VideoService {

    public record VideoRequest(@Size(max = 200) String title, @Size(max = 10000) String description,
                               @Size(max = 500) @Pattern(regexp = "^$|https?://.*", message = "must be an http(s) link") String videoUrl,
                               UUID subjectId, @Size(max = 100) String category,
                               @Pattern(regexp = "PUBLIC|PRIVATE|DRAFT") String visibility,
                               UUID mathTemplateId, Boolean clearMathTemplate) {}

    public record SubjectRequest(@Size(max = 60) String name, @Size(max = 500) String description, Integer displayOrder,
                                 Boolean active, UUID parentId, Boolean clearParent) {}

    /** New order of sibling subjects (all under the same parent), first to last. */
    public record ReorderRequest(@NotEmpty @Size(max = 500) List<@NotNull UUID> ids) {}

    private final JdbcClient jdbc;
    private final QuickPracticeService practice;

    public VideoService(JdbcClient jdbc, QuickPracticeService practice) {
        this.jdbc = jdbc;
        this.practice = practice;
    }

    /** SQL condition for videos the caller may see. */
    private static String visibleTo(Principal p) {
        if (p == null) {
            return "v.visibility = 'PUBLIC'";
        }
        return p.isStaff() ? "TRUE" : "v.visibility IN ('PUBLIC', 'PRIVATE')";
    }

    private static final String VIDEO_COLUMNS = """
            v.id, v.title, v.description, v.video_url AS "videoUrl", v.provider, v.embed_id AS "embedId",
            v.category, v.visibility, v.subject_id AS "subjectId", s.name AS "subjectName",
            s.parent_id AS "parentSubjectId", v.math_template_id AS "mathTemplateId", t.label AS "mathTemplateLabel",
            v.created_at AS "createdAt", v.updated_at AS "updatedAt"
            """;
    private static final String VIDEO_FROM = """
            FROM videos v JOIN subjects s ON s.id = v.subject_id
            LEFT JOIN math_templates t ON t.id = v.math_template_id
            """;

    // ------------------------------------------------------------------ public

    public List<Map<String, Object>> subjects(Principal p, boolean includeInactive) {
        return jdbc.sql("""
                SELECT s.id, s.name, s.description, s.display_order AS "displayOrder", s.active,
                       s.parent_id AS "parentId",
                       (SELECT count(*) FROM videos v WHERE v.subject_id = s.id AND %s) AS "videoCount"
                FROM subjects s WHERE :all OR s.active
                ORDER BY s.parent_id NULLS FIRST, s.display_order, s.name
                """.formatted(visibleTo(p))).param("all", includeInactive).query().listOfRows();
    }

    public List<Map<String, Object>> list(Principal p, UUID subjectId, String q) {
        String search = q == null ? "" : q.strip().toLowerCase();
        var rows = jdbc.sql("SELECT " + VIDEO_COLUMNS + VIDEO_FROM + """
                WHERE %s AND s.active
                  AND (CAST(:subject AS uuid) IS NULL OR v.subject_id IN (%s))
                  AND (:q = '' OR lower(v.title) LIKE '%%' || :q || '%%' OR lower(COALESCE(v.category, '')) LIKE '%%' || :q || '%%')
                ORDER BY v.created_at DESC
                """.formatted(visibleTo(p), DESCENDANTS_OF_SUBJECT)).param("subject", subjectId).param("q", search)
                .query().listOfRows();
        return rows.stream().map(VideoService::decorate).toList();
    }

    public Map<String, Object> get(Principal p, UUID id) {
        var rows = jdbc.sql("SELECT " + VIDEO_COLUMNS + VIDEO_FROM + " WHERE v.id = :id AND " + visibleTo(p))
                .param("id", id).query().listOfRows();
        if (rows.isEmpty()) {
            // Same answer whether the video does not exist or is hidden from this caller.
            throw ApiException.notFound("Lesson");
        }
        Map<String, Object> v = decorate(rows.getFirst());
        // Root-to-leaf subject chain for breadcrumbs, e.g. Math > Pre-Algebra > Fractions.
        var path = jdbc.sql("""
                WITH RECURSIVE up AS (
                    SELECT id, name, parent_id, 0 AS depth FROM subjects WHERE id = :s
                    UNION ALL
                    SELECT p.id, p.name, p.parent_id, up.depth + 1 FROM subjects p JOIN up ON p.id = up.parent_id
                    WHERE up.depth < 20)
                SELECT id, name FROM up ORDER BY depth DESC
                """).param("s", v.get("subjectId")).query().listOfRows();
        v.put("subjectPath", path);
        v.put("parentSubjectName", path.size() > 1 ? path.get(path.size() - 2).get("name") : null);
        v.put("related", jdbc.sql("SELECT " + VIDEO_COLUMNS + VIDEO_FROM + """
                WHERE v.subject_id = :s AND v.id <> :id AND %s ORDER BY v.created_at DESC LIMIT 6
                """.formatted(visibleTo(p))).param("s", v.get("subjectId")).param("id", id).query().listOfRows()
                .stream().map(VideoService::decorate).toList());
        return v;
    }

    private static Map<String, Object> decorate(Map<String, Object> row) {
        Map<String, Object> m = new LinkedHashMap<>(row);
        String provider = (String) m.get("provider");
        String embedId = (String) m.get("embedId");
        m.put("embedUrl", VideoUrlParser.embedUrl(provider, embedId));
        m.put("thumbnailUrl", VideoUrlParser.thumbnailUrl(provider, embedId));
        return m;
    }

    // ------------------------------------------------------------------ practice widget

    /** One fresh question from the video's linked template (answers stay on the server). */
    public Map<String, Object> practiceQuestion(Principal p, UUID videoId) {
        Map<String, Object> video = get(p, videoId);
        return practice.question(p.id(), "video:" + videoId, (UUID) video.get("mathTemplateId"));
    }

    public Map<String, Object> checkPractice(Principal p, UUID videoId, QuickPracticeService.CheckRequest req) {
        return practice.check(p.id(), "video:" + videoId, req);
    }

    // ------------------------------------------------------------------ admin

    public List<Map<String, Object>> adminList() {
        return jdbc.sql("SELECT " + VIDEO_COLUMNS + VIDEO_FROM + " ORDER BY s.name, v.created_at DESC").query().listOfRows()
                .stream().map(VideoService::decorate).toList();
    }

    @Transactional
    public Map<String, Object> create(Principal admin, VideoRequest r) {
        if (blank(r.title()) || blank(r.videoUrl()) || r.subjectId() == null) {
            throw ApiException.badRequest("missing_fields", "Title, video URL and subject are required");
        }
        var parsed = VideoUrlParser.parse(r.videoUrl());
        UUID id = jdbc.sql("""
                INSERT INTO videos (title, description, video_url, provider, embed_id, category, subject_id, visibility,
                    math_template_id, uploaded_by)
                VALUES (:t, :d, :u, :p, :e, :c, :s, :vis, :m, :by) RETURNING id
                """).param("t", r.title().strip()).param("d", r.description()).param("u", r.videoUrl().strip())
                .param("p", parsed.provider()).param("e", parsed.embedId()).param("c", emptyToNull(r.category()))
                .param("s", r.subjectId()).param("vis", r.visibility() == null ? "PRIVATE" : r.visibility())
                .param("m", r.mathTemplateId()).param("by", admin.id()).query(UUID.class).single();
        return get(admin, id);
    }

    @Transactional
    public Map<String, Object> update(Principal admin, UUID id, VideoRequest r) {
        get(admin, id);
        String url = blank(r.videoUrl()) ? null : r.videoUrl().strip();
        var parsed = url == null ? null : VideoUrlParser.parse(url);
        jdbc.sql("""
                UPDATE videos SET title = COALESCE(:t, title), description = COALESCE(:d, description),
                    video_url = COALESCE(:u, video_url), provider = COALESCE(:p, provider),
                    embed_id = CASE WHEN CAST(:u AS text) IS NULL THEN embed_id ELSE :e END,
                    category = CASE WHEN CAST(:c AS text) IS NULL THEN category ELSE NULLIF(CAST(:c AS text), '') END,
                    subject_id = COALESCE(:s, subject_id), visibility = COALESCE(:vis, visibility),
                    math_template_id = CASE WHEN :clearM THEN NULL ELSE COALESCE(:m, math_template_id) END,
                    updated_at = now()
                WHERE id = :id
                """).param("t", blank(r.title()) ? null : r.title().strip()).param("d", r.description())
                .param("u", url).param("p", parsed == null ? null : parsed.provider())
                .param("e", parsed == null ? null : parsed.embedId()).param("c", r.category())
                .param("s", r.subjectId()).param("vis", r.visibility()).param("m", r.mathTemplateId())
                .param("clearM", Boolean.TRUE.equals(r.clearMathTemplate())).param("id", id).update();
        return get(admin, id);
    }

    public void delete(UUID id) {
        if (jdbc.sql("DELETE FROM videos WHERE id = :id").param("id", id).update() == 0) {
            throw ApiException.notFound("Lesson");
        }
    }

    @Transactional
    public Map<String, Object> createSubject(SubjectRequest r) {
        if (blank(r.name())) {
            throw ApiException.badRequest("missing_fields", "Name is required");
        }
        if (r.parentId() != null) {
            subject(r.parentId()); // 404 when the parent does not exist; any depth is allowed
        }
        requireUniqueName(r.name(), null);
        UUID id = jdbc.sql("""
                INSERT INTO subjects (name, description, display_order, active, parent_id)
                VALUES (:n, :d, :o, :a, :p) RETURNING id
                """).param("n", r.name().strip()).param("d", emptyToNull(r.description()))
                .param("o", r.displayOrder() == null ? 0 : r.displayOrder()).param("a", r.active() == null || r.active())
                .param("p", r.parentId()).query(UUID.class).single();
        return subject(id);
    }

    @Transactional
    public Map<String, Object> updateSubject(UUID id, SubjectRequest r) {
        subject(id);
        if (id.equals(r.parentId())) {
            throw ApiException.badRequest("invalid_parent", "A subject cannot be its own parent");
        }
        if (r.parentId() != null) {
            subject(r.parentId());
            // Moving a subject under one of its own descendants would create a loop.
            boolean intoOwnBranch = jdbc.sql("SELECT count(*) FROM (" + DESCENDANTS_OF_SUBJECT + ") d WHERE d.id = :p")
                    .param("subject", id).param("p", r.parentId()).query(Long.class).single() > 0;
            if (intoOwnBranch) {
                throw ApiException.badRequest("invalid_parent", "A subject cannot be moved inside one of its own sub-subjects");
            }
        }
        if (!blank(r.name())) {
            requireUniqueName(r.name(), id);
        }
        jdbc.sql("""
                UPDATE subjects SET name = COALESCE(:n, name), description = COALESCE(:d, description),
                    display_order = COALESCE(:o, display_order), active = COALESCE(:a, active),
                    parent_id = CASE WHEN :clearP THEN NULL ELSE COALESCE(:p, parent_id) END
                WHERE id = :id
                """).param("n", blank(r.name()) ? null : r.name().strip()).param("d", r.description())
                .param("o", r.displayOrder()).param("a", r.active()).param("p", r.parentId())
                .param("clearP", Boolean.TRUE.equals(r.clearParent())).param("id", id).update();
        return subject(id);
    }

    /** Rewrite display_order of sibling subjects to match the given order (arrows / drag and drop in the tree). */
    @Transactional
    public void reorderSubjects(ReorderRequest r) {
        List<UUID> ids = r.ids().stream().distinct().toList();
        var parents = jdbc.sql("SELECT DISTINCT parent_id FROM subjects WHERE id IN (:ids)").param("ids", ids)
                .query((rs, n) -> Optional.ofNullable(rs.getObject(1, UUID.class))).list();
        long found = jdbc.sql("SELECT count(*) FROM subjects WHERE id IN (:ids)").param("ids", ids).query(Long.class).single();
        if (found != ids.size()) {
            throw ApiException.notFound("Subject");
        }
        if (parents.size() != 1) {
            throw ApiException.badRequest("invalid_order", "Only subjects under the same parent can be reordered together");
        }
        for (int i = 0; i < ids.size(); i++) {
            jdbc.sql("UPDATE subjects SET display_order = :o WHERE id = :id").param("o", i + 1).param("id", ids.get(i)).update();
        }
    }

    public void deleteSubject(UUID id) {
        subject(id);
        long used = jdbc.sql("""
                SELECT (SELECT count(*) FROM videos WHERE subject_id = :id) + (SELECT count(*) FROM subjects WHERE parent_id = :id)
                     + (SELECT count(*) FROM courses WHERE subject_id = :id)
                     + (SELECT count(*) FROM math_templates WHERE subject_id = :id)
                """).param("id", id).query(Long.class).single();
        if (used > 0) {
            throw ApiException.conflict("subject_in_use",
                    "Move or delete its courses, videos, math templates and sub-subjects first, or mark it inactive");
        }
        jdbc.sql("DELETE FROM subjects WHERE id = :id").param("id", id).update();
    }

    /**
     * Turn an empty sub-subject (used by mistake as a "chapter") into a real chapter: it becomes the next
     * chapter of the parent subject's first course (a draft course named after the parent is created when
     * there is none), and the empty sub-subject is removed.
     */
    @Transactional
    public Map<String, Object> convertSubjectToChapter(UUID adminId, UUID id) {
        var row = jdbc.sql("SELECT name, parent_id FROM subjects WHERE id = :id FOR UPDATE").param("id", id)
                .query((rs, n) -> new Object[] {rs.getString(1), rs.getObject(2, UUID.class)}).optional()
                .orElseThrow(() -> ApiException.notFound("Subject"));
        String name = (String) row[0];
        UUID parentId = (UUID) row[1];
        if (parentId == null) {
            throw ApiException.badRequest("top_level_subject", "Only a sub-subject can be turned into a chapter");
        }
        var used = jdbc.sql("""
                SELECT (SELECT count(*) FROM subjects WHERE parent_id = :id), (SELECT count(*) FROM courses WHERE subject_id = :id),
                       (SELECT count(*) FROM videos WHERE subject_id = :id) + (SELECT count(*) FROM math_templates WHERE subject_id = :id)
                """).param("id", id).query((rs, n) -> new long[] {rs.getLong(1), rs.getLong(2), rs.getLong(3)}).single();
        if (used[0] + used[1] + used[2] > 0) {
            throw ApiException.conflict("subject_not_empty",
                    "“" + name + "” has sub-subjects, courses, videos or math templates; move them first");
        }
        String parentName = jdbc.sql("SELECT name FROM subjects WHERE id = :p").param("p", parentId).query(String.class).single();
        UUID courseId = jdbc.sql("SELECT id FROM courses WHERE subject_id = :p ORDER BY created_at LIMIT 1 FOR UPDATE")
                .param("p", parentId).query(UUID.class).optional()
                .orElseGet(() -> jdbc.sql("""
                        INSERT INTO courses (title, status, subject_id, created_by, display_order)
                        VALUES (:t, 'draft', :p, :by, (SELECT COALESCE(max(display_order), 0) + 1 FROM courses WHERE subject_id = :p))
                        RETURNING id
                        """).param("t", parentName).param("p", parentId).param("by", adminId).query(UUID.class).single());
        UUID chapterId = jdbc.sql("""
                INSERT INTO chapters (course_id, title, position)
                VALUES (:c, :t, (SELECT COALESCE(max(position), 0) + 1 FROM chapters WHERE course_id = :c)) RETURNING id
                """).param("c", courseId).param("t", name).query(UUID.class).single();
        jdbc.sql("DELETE FROM subjects WHERE id = :id").param("id", id).update();
        return Map.of("courseId", courseId, "chapterId", chapterId);
    }

    /** Ids of a subject (:subject) and all of its sub-subjects at any depth. */
    private static final String DESCENDANTS_OF_SUBJECT = """
            WITH RECURSIVE d AS (
                SELECT id, 0 AS depth FROM subjects WHERE id = :subject
                UNION ALL
                SELECT c.id, d.depth + 1 FROM subjects c JOIN d ON c.parent_id = d.id WHERE d.depth < 20)
            SELECT id FROM d""";

    private void requireUniqueName(String name, UUID exceptId) {
        boolean taken = jdbc.sql("SELECT count(*) FROM subjects WHERE lower(name) = lower(:n) AND id IS DISTINCT FROM :x")
                .param("n", name.strip()).param("x", exceptId).query(Long.class).single() > 0;
        if (taken) {
            throw ApiException.conflict("subject_exists", "A subject named “" + name.strip() + "” already exists");
        }
    }

    private Map<String, Object> subject(UUID id) {
        var rows = jdbc.sql("""
                SELECT id, name, description, display_order AS "displayOrder", active, parent_id AS "parentId"
                FROM subjects WHERE id = :id
                """).param("id", id).query().listOfRows();
        if (rows.isEmpty()) {
            throw ApiException.notFound("Subject");
        }
        return rows.getFirst();
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }

    private static String emptyToNull(String s) {
        return blank(s) ? null : s.strip();
    }

}
