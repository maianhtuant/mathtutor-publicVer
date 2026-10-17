package com.mathtutor.content;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.mathtutor.common.ApiException;
import com.mathtutor.security.CurrentUser;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@RestController
@RequestMapping("/api/admin")
public class AdminContentController {

    public record CourseRequest(@Size(max = 200) String title, @Size(max = 10000) String description,
                                @Pattern(regexp = "draft|published|archived") String status,
                                UUID subjectId, Boolean clearSubject, @Size(max = 300) String readiness) {}

    /** New order of siblings (same subject / course / chapter), first to last. */
    public record ReorderRequest(@NotEmpty @Size(max = 500) List<@NotNull UUID> ids) {}

    public record ChapterRequest(@NotBlank @Size(max = 200) String title) {}

    public record LessonRequest(@Size(max = 200) String title, @Size(max = 100000) String content,
                                @Size(max = 2000) @Pattern(regexp = "^$|https?://.*") String videoUrl,
                                @Pattern(regexp = "draft|published|archived") String status,
                                @Size(max = 500) String goal, Boolean freePreview) {}

    /** A lesson section: video + explanation / transcript / worked example + optional inline practice. */
    public record SectionRequest(@Size(max = 200) String title,
                                 @Size(max = 2000) @Pattern(regexp = "^$|https?://.*") String videoUrl,
                                 @Size(max = 100000) String explanation, @Size(max = 100000) String transcript,
                                 @Size(max = 100000) String workedExample, @Size(max = 2000) String practiceHint,
                                 @Size(max = 20) List<@Valid PracticeRow> practice) {}

    /** One "Practice this section" row: a math template and how many problems it contributes. */
    public record PracticeRow(@jakarta.validation.constraints.NotNull UUID mathTemplateId, @Min(1) @Max(20) int questionCount) {}

    private final JdbcClient jdbc;
    private final CurrentUser currentUser;

    public AdminContentController(JdbcClient jdbc, CurrentUser currentUser) {
        this.jdbc = jdbc;
        this.currentUser = currentUser;
    }

    /** Whole content tree (subject -> course -> chapter -> lesson) as flat lists; the client nests them. */
    @GetMapping("/content-tree")
    public Map<String, Object> contentTree() {
        currentUser.requireStaff();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("subjects", jdbc.sql("""
                SELECT s.id, s.name, s.description, s.parent_id AS "parentId", s.display_order AS "displayOrder", s.active,
                       (SELECT count(*) FROM videos v WHERE v.subject_id = s.id) AS "videoCount",
                       (SELECT count(*) FROM math_templates t WHERE t.subject_id = s.id) AS "templateCount"
                FROM subjects s ORDER BY s.display_order, s.name
                """).query().listOfRows());
        out.put("courses", jdbc.sql("""
                SELECT id, title, status, subject_id AS "subjectId" FROM courses ORDER BY display_order, created_at
                """).query().listOfRows());
        out.put("chapters", jdbc.sql("""
                SELECT id, course_id AS "courseId", title, position FROM chapters ORDER BY position
                """).query().listOfRows());
        out.put("lessons", jdbc.sql("""
                SELECT id, chapter_id AS "chapterId", course_id AS "courseId", title, position, status
                FROM lessons ORDER BY position
                """).query().listOfRows());
        return out;
    }

    @GetMapping("/courses")
    public List<Map<String, Object>> courses() {
        currentUser.requireStaff();
        return jdbc.sql("""
                SELECT c.id, c.title, c.description, c.status, c.subject_id AS "subjectId", c.created_at AS "createdAt",
                       (SELECT count(*) FROM lessons l WHERE l.course_id = c.id) AS "lessonCount",
                       (SELECT count(*) FROM enrollments e WHERE e.course_id = c.id AND e.status = 'active') AS "enrollmentCount"
                FROM courses c ORDER BY c.display_order, c.created_at
                """).query().listOfRows();
    }

    @PostMapping("/courses")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> createCourse(@Valid @RequestBody CourseRequest req) {
        var admin = currentUser.requireContent();
        if (req.title() == null || req.title().isBlank()) {
            throw ApiException.badRequest("title_required", "Title is required");
        }
        UUID id = jdbc.sql("""
                INSERT INTO courses (title, description, status, subject_id, readiness, created_by, display_order)
                VALUES (:t, :d, :s, :subj, :r, :by,
                        (SELECT COALESCE(max(display_order), 0) + 1 FROM courses WHERE subject_id IS NOT DISTINCT FROM CAST(:subj AS uuid)))
                RETURNING id
                """).param("t", req.title().strip()).param("d", req.description()).param("subj", req.subjectId())
                .param("r", req.readiness() == null || req.readiness().isBlank() ? null : req.readiness().strip())
                .param("s", req.status() == null ? "draft" : req.status()).param("by", admin.id())
                .query(UUID.class).single();
        return course(id);
    }

    @GetMapping("/courses/{id}")
    public Map<String, Object> course(@PathVariable UUID id) {
        currentUser.requireStaff();
        var rows = jdbc.sql("""
                SELECT id, title, description, status, readiness, subject_id AS "subjectId", created_at AS "createdAt"
                FROM courses WHERE id = :id
                """)
                .param("id", id).query().listOfRows();
        if (rows.isEmpty()) {
            throw ApiException.notFound("Course");
        }
        Map<String, Object> course = new LinkedHashMap<>(rows.getFirst());
        List<Map<String, Object>> chapters = new ArrayList<>();
        for (var ch : jdbc.sql("SELECT id, title, position FROM chapters WHERE course_id = :id ORDER BY position")
                .param("id", id).query().listOfRows()) {
            Map<String, Object> c = new LinkedHashMap<>(ch);
            List<Map<String, Object>> lessons = new ArrayList<>();
            for (var l : jdbc.sql("""
                    SELECT id, title, goal, content, video_url AS "videoUrl", position, status, free_preview AS "freePreview"
                    FROM lessons WHERE chapter_id = :ch ORDER BY position
                    """).param("ch", ch.get("id")).query().listOfRows()) {
                Map<String, Object> lm = new LinkedHashMap<>(l);
                lm.put("sections", sections((UUID) l.get("id")));
                lessons.add(lm);
            }
            c.put("lessons", lessons);
            chapters.add(c);
        }
        course.put("chapters", chapters);
        return course;
    }

    @PatchMapping("/courses/{id}")
    public Map<String, Object> updateCourse(@PathVariable UUID id, @Valid @RequestBody CourseRequest req) {
        currentUser.requireContent();
        int n = jdbc.sql("""
                UPDATE courses SET title = COALESCE(:t, title), description = COALESCE(:d, description),
                       status = COALESCE(:s, status),
                       subject_id = CASE WHEN :clearSubj THEN NULL ELSE COALESCE(:subj, subject_id) END,
                       readiness = CASE WHEN CAST(:r AS text) IS NULL THEN readiness ELSE NULLIF(btrim(CAST(:r AS text)), '') END
                WHERE id = :id
                """).param("t", req.title()).param("d", req.description()).param("s", req.status())
                .param("subj", req.subjectId()).param("clearSubj", Boolean.TRUE.equals(req.clearSubject()))
                .param("r", req.readiness())
                .param("id", id).update();
        if (n == 0) {
            throw ApiException.notFound("Course");
        }
        return course(id);
    }

    @PostMapping("/courses/{id}/chapters")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public Map<String, Object> createChapter(@PathVariable UUID id, @Valid @RequestBody ChapterRequest req) {
        currentUser.requireContent();
        jdbc.sql("SELECT id FROM courses WHERE id = :id FOR UPDATE").param("id", id).query(UUID.class).optional()
                .orElseThrow(() -> ApiException.notFound("Course"));
        jdbc.sql("""
                INSERT INTO chapters (course_id, title, position)
                VALUES (:c, :t, (SELECT COALESCE(max(position), 0) + 1 FROM chapters WHERE course_id = :c))
                """).param("c", id).param("t", req.title().strip()).update();
        return course(id);
    }

    @PatchMapping("/chapters/{id}")
    public Map<String, Object> updateChapter(@PathVariable UUID id, @Valid @RequestBody ChapterRequest req) {
        currentUser.requireContent();
        UUID courseId = jdbc.sql("UPDATE chapters SET title = :t WHERE id = :id RETURNING course_id")
                .param("t", req.title().strip()).param("id", id).query(UUID.class).optional()
                .orElseThrow(() -> ApiException.notFound("Chapter"));
        return course(courseId);
    }

    @PostMapping("/chapters/{id}/lessons")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public Map<String, Object> createLesson(@PathVariable UUID id, @Valid @RequestBody LessonRequest req) {
        currentUser.requireContent();
        UUID courseId = jdbc.sql("SELECT course_id FROM chapters WHERE id = :id FOR UPDATE").param("id", id)
                .query(UUID.class).optional().orElseThrow(() -> ApiException.notFound("Chapter"));
        if (req.title() == null || req.title().isBlank()) {
            throw ApiException.badRequest("title_required", "Title is required");
        }
        jdbc.sql("""
                INSERT INTO lessons (chapter_id, course_id, title, content, video_url, position, status)
                VALUES (:ch, :c, :t, :content, :v, (SELECT COALESCE(max(position), 0) + 1 FROM lessons WHERE chapter_id = :ch), :s)
                """).param("ch", id).param("c", courseId).param("t", req.title().strip())
                .param("content", req.content() == null ? "" : req.content())
                .param("v", req.videoUrl() == null || req.videoUrl().isBlank() ? null : req.videoUrl())
                .param("s", req.status() == null ? "draft" : req.status()).update();
        return course(courseId);
    }

    @PatchMapping("/lessons/{id}")
    public Map<String, Object> updateLesson(@PathVariable UUID id, @Valid @RequestBody LessonRequest req) {
        currentUser.requireContent();
        UUID courseId = jdbc.sql("""
                UPDATE lessons SET title = COALESCE(:t, title), content = COALESCE(:content, content),
                       video_url = CASE WHEN CAST(:v AS text) IS NULL THEN video_url
                                    ELSE NULLIF(CAST(:v AS text), '') END,
                       status = COALESCE(:s, status),
                       goal = CASE WHEN CAST(:g AS text) IS NULL THEN goal ELSE NULLIF(btrim(CAST(:g AS text)), '') END,
                       free_preview = COALESCE(:fp, free_preview)
                WHERE id = :id RETURNING course_id
                """).param("t", req.title()).param("content", req.content()).param("v", req.videoUrl())
                .param("s", req.status()).param("g", req.goal()).param("fp", req.freePreview())
                .param("id", id).query(UUID.class).optional()
                .orElseThrow(() -> ApiException.notFound("Lesson"));
        return course(courseId);
    }

    /** One lesson with its course/chapter context, sections and previous/next lesson (admin lesson editor). */
    @GetMapping("/lessons/{id}")
    public Map<String, Object> lesson(@PathVariable UUID id) {
        currentUser.requireStaff();
        var rows = jdbc.sql("""
                SELECT l.id, l.title, l.goal, l.content, l.video_url AS "videoUrl", l.position, l.status,
                       l.free_preview AS "freePreview", c.id AS "courseId", c.title AS "courseTitle", c.status AS "courseStatus",
                       ch.id AS "chapterId", ch.title AS "chapterTitle", ch.position AS "chapterPosition"
                FROM lessons l JOIN chapters ch ON ch.id = l.chapter_id JOIN courses c ON c.id = l.course_id
                WHERE l.id = :id
                """).param("id", id).query().listOfRows();
        if (rows.isEmpty()) {
            throw ApiException.notFound("Lesson");
        }
        Map<String, Object> lesson = new LinkedHashMap<>(rows.getFirst());
        lesson.put("sections", sections(id));
        List<UUID> order = jdbc.sql("""
                SELECT l.id FROM lessons l JOIN chapters ch ON ch.id = l.chapter_id
                WHERE l.course_id = :c ORDER BY ch.position, l.position
                """).param("c", lesson.get("courseId")).query(UUID.class).list();
        int at = order.indexOf(id);
        lesson.put("previousLessonId", at > 0 ? order.get(at - 1) : null);
        lesson.put("nextLessonId", at >= 0 && at < order.size() - 1 ? order.get(at + 1) : null);
        return lesson;
    }

    // ------------------------------------------------------------------ lesson sections

    private List<Map<String, Object>> sections(UUID lessonId) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (var row : jdbc.sql("""
                SELECT s.id, s.position, s.title, s.video_url AS "videoUrl", s.explanation, s.transcript,
                       s.worked_example AS "workedExample", s.practice_hint AS "practiceHint"
                FROM lesson_sections s WHERE s.lesson_id = :l ORDER BY s.position
                """).param("l", lessonId).query().listOfRows()) {
            Map<String, Object> m = new LinkedHashMap<>(row);
            m.put("practice", jdbc.sql("""
                    SELECT p.position, p.math_template_id AS "mathTemplateId", t.label, s.name AS "subjectName",
                           p.question_count AS "questionCount", t.active,
                           EXISTS (SELECT 1 FROM math_template_versions v WHERE v.template_id = t.id AND v.status = 'published')
                             AS published
                    FROM lesson_section_templates p JOIN math_templates t ON t.id = p.math_template_id
                    LEFT JOIN subjects s ON s.id = t.subject_id
                    WHERE p.section_id = :s ORDER BY p.position
                    """).param("s", row.get("id")).query().listOfRows());
            out.add(m);
        }
        return out;
    }

    /** Replace a section's practice rows (list order = position). */
    private void savePractice(UUID sectionId, List<PracticeRow> rows) {
        jdbc.sql("DELETE FROM lesson_section_templates WHERE section_id = :s").param("s", sectionId).update();
        int pos = 1;
        for (PracticeRow r : rows) {
            jdbc.sql("""
                    INSERT INTO lesson_section_templates (section_id, position, math_template_id, question_count)
                    VALUES (:s, :p, :m, :c)
                    """).param("s", sectionId).param("p", pos++).param("m", r.mathTemplateId()).param("c", r.questionCount())
                    .update();
        }
    }

    private UUID courseOfLesson(UUID lessonId) {
        return jdbc.sql("SELECT course_id FROM lessons WHERE id = :id").param("id", lessonId).query(UUID.class)
                .optional().orElseThrow(() -> ApiException.notFound("Lesson"));
    }

    @PostMapping("/lessons/{id}/sections")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public Map<String, Object> createSection(@PathVariable UUID id, @Valid @RequestBody SectionRequest req) {
        currentUser.requireContent();
        jdbc.sql("SELECT id FROM lessons WHERE id = :id FOR UPDATE").param("id", id).query(UUID.class).optional()
                .orElseThrow(() -> ApiException.notFound("Lesson"));
        if (req.title() == null || req.title().isBlank()) {
            throw ApiException.badRequest("title_required", "Section title is required");
        }
        UUID sectionId = jdbc.sql("""
                INSERT INTO lesson_sections (lesson_id, position, title, video_url, explanation, transcript, worked_example,
                    practice_hint)
                VALUES (:l, (SELECT COALESCE(max(position), 0) + 1 FROM lesson_sections WHERE lesson_id = :l), :t, :v,
                    :e, :tr, :w, :h)
                RETURNING id
                """).param("l", id).param("t", req.title().strip()).param("v", blankToNull(req.videoUrl()))
                .param("e", req.explanation() == null ? "" : req.explanation()).param("tr", blankToNull(req.transcript()))
                .param("w", blankToNull(req.workedExample())).param("h", blankToNull(req.practiceHint()))
                .query(UUID.class).single();
        if (req.practice() != null) {
            savePractice(sectionId, req.practice());
        }
        return course(courseOfLesson(id));
    }

    @PatchMapping("/sections/{id}")
    @Transactional
    public Map<String, Object> updateSection(@PathVariable UUID id, @Valid @RequestBody SectionRequest req) {
        currentUser.requireContent();
        // Text fields: null keeps the value, "" clears it.
        UUID lessonId = jdbc.sql("""
                UPDATE lesson_sections SET title = COALESCE(NULLIF(btrim(CAST(:t AS text)), ''), title),
                    video_url = CASE WHEN CAST(:v AS text) IS NULL THEN video_url ELSE NULLIF(CAST(:v AS text), '') END,
                    explanation = COALESCE(:e, explanation),
                    transcript = CASE WHEN CAST(:tr AS text) IS NULL THEN transcript ELSE NULLIF(CAST(:tr AS text), '') END,
                    worked_example = CASE WHEN CAST(:w AS text) IS NULL THEN worked_example ELSE NULLIF(CAST(:w AS text), '') END,
                    practice_hint = CASE WHEN CAST(:h AS text) IS NULL THEN practice_hint ELSE NULLIF(CAST(:h AS text), '') END
                WHERE id = :id RETURNING lesson_id
                """).param("t", req.title()).param("v", req.videoUrl()).param("e", req.explanation())
                .param("tr", req.transcript()).param("w", req.workedExample())
                .param("h", req.practiceHint()).param("id", id).query(UUID.class).optional()
                .orElseThrow(() -> ApiException.notFound("Section"));
        if (req.practice() != null) {
            savePractice(id, req.practice());
        }
        return course(courseOfLesson(lessonId));
    }

    /** Move a section one place up (-1) or down (+1) within its lesson. */
    @PostMapping("/sections/{id}/move")
    @Transactional
    public Map<String, Object> moveSection(@PathVariable UUID id, @RequestParam int delta) {
        currentUser.requireContent();
        var s = jdbc.sql("SELECT lesson_id, position FROM lesson_sections WHERE id = :id FOR UPDATE").param("id", id)
                .query((rs, n) -> new Object[] {rs.getObject(1, UUID.class), rs.getInt(2)}).optional()
                .orElseThrow(() -> ApiException.notFound("Section"));
        UUID lessonId = (UUID) s[0];
        int from = (Integer) s[1];
        int to = from + Integer.signum(delta);
        var other = jdbc.sql("SELECT id FROM lesson_sections WHERE lesson_id = :l AND position = :p FOR UPDATE")
                .param("l", lessonId).param("p", to).query(UUID.class).optional();
        if (other.isPresent()) {
            // Swap through a temporary position to respect UNIQUE (lesson_id, position).
            jdbc.sql("UPDATE lesson_sections SET position = 100000 WHERE id = :id").param("id", id).update();
            jdbc.sql("UPDATE lesson_sections SET position = :p WHERE id = :id").param("p", from).param("id", other.get()).update();
            jdbc.sql("UPDATE lesson_sections SET position = :p WHERE id = :id").param("p", to).param("id", id).update();
        }
        return course(courseOfLesson(lessonId));
    }

    @DeleteMapping("/sections/{id}")
    @Transactional
    public Map<String, Object> deleteSection(@PathVariable UUID id) {
        currentUser.requireContent();
        var s = jdbc.sql("SELECT lesson_id, position FROM lesson_sections WHERE id = :id FOR UPDATE").param("id", id)
                .query((rs, n) -> new Object[] {rs.getObject(1, UUID.class), rs.getInt(2)}).optional()
                .orElseThrow(() -> ApiException.notFound("Section"));
        jdbc.sql("DELETE FROM lesson_section_templates WHERE section_id = :id").param("id", id).update();
        jdbc.sql("DELETE FROM lesson_sections WHERE id = :id").param("id", id).update();
        closeGap("lesson_sections", "lesson_id", (UUID) s[0], (Integer) s[1]);
        return course(courseOfLesson((UUID) s[0]));
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s;
    }

    // ------------------------------------------------------------------ delete
    // Deletes are refused whenever they would destroy learning history (no ON DELETE CASCADE in the schema);
    // the message points the admin to archiving instead.

    @DeleteMapping("/lessons/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void deleteLesson(@PathVariable UUID id) {
        currentUser.requireContent();
        var lesson = jdbc.sql("SELECT chapter_id, position FROM lessons WHERE id = :id FOR UPDATE").param("id", id)
                .query((rs, n) -> new Object[] {rs.getObject(1, UUID.class), rs.getInt(2)}).optional()
                .orElseThrow(() -> ApiException.notFound("Lesson"));
        long progress = jdbc.sql("SELECT count(*) FROM lesson_progress WHERE lesson_id = :id").param("id", id)
                .query(Long.class).single();
        if (progress > 0) {
            throw ApiException.conflict("lesson_in_use",
                    progress + " student(s) have progress on this lesson. Archive it instead to keep their history.");
        }
        // Math templates placed on this lesson move up to its chapter.
        jdbc.sql("UPDATE math_templates SET chapter_id = :chapter, lesson_id = NULL WHERE lesson_id = :id")
                .param("chapter", lesson[0]).param("id", id).update();
        jdbc.sql("""
                DELETE FROM lesson_section_templates WHERE section_id IN (SELECT id FROM lesson_sections WHERE lesson_id = :id)
                """).param("id", id).update();
        jdbc.sql("DELETE FROM lesson_sections WHERE lesson_id = :id").param("id", id).update(); // content, not history
        jdbc.sql("DELETE FROM lessons WHERE id = :id").param("id", id).update();
        closeGap("lessons", "chapter_id", (UUID) lesson[0], (Integer) lesson[1]);
    }

    @DeleteMapping("/chapters/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void deleteChapter(@PathVariable UUID id) {
        currentUser.requireContent();
        var chapter = jdbc.sql("SELECT course_id, position FROM chapters WHERE id = :id FOR UPDATE").param("id", id)
                .query((rs, n) -> new Object[] {rs.getObject(1, UUID.class), rs.getInt(2)}).optional()
                .orElseThrow(() -> ApiException.notFound("Chapter"));
        long lessons = jdbc.sql("SELECT count(*) FROM lessons WHERE chapter_id = :id").param("id", id).query(Long.class).single();
        if (lessons > 0) {
            throw ApiException.conflict("chapter_not_empty", "Delete or move its " + lessons + " lesson(s) first.");
        }
        // Math templates placed on this chapter move up to its course.
        jdbc.sql("UPDATE math_templates SET course_id = :course, chapter_id = NULL WHERE chapter_id = :id")
                .param("course", chapter[0]).param("id", id).update();
        jdbc.sql("DELETE FROM chapters WHERE id = :id").param("id", id).update();
        closeGap("chapters", "course_id", (UUID) chapter[0], (Integer) chapter[1]);
    }

    /**
     * Delete a course. Students still enrolled always block it (remove them or archive the course). Without
     * {@code everything}, a course that still holds chapters, practice sets or former (removed) students' history is
     * refused with a 409 "course_not_empty" whose details count what would go, so the admin can confirm. With
     * {@code everything=true} the course is deleted together with all of that.
     */
    @DeleteMapping("/courses/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void deleteCourse(@PathVariable UUID id, @RequestParam(defaultValue = "false") boolean everything) {
        var p = currentUser.requireContent();
        jdbc.sql("SELECT id FROM courses WHERE id = :id FOR UPDATE").param("id", id).query(UUID.class).optional()
                .orElseThrow(() -> ApiException.notFound("Course"));
        List<String> enrolled = jdbc.sql("""
                SELECT u.email FROM enrollments e JOIN users u ON u.id = e.user_id
                WHERE e.course_id = :id AND e.status = 'active' ORDER BY u.email
                """).param("id", id).query(String.class).list();
        if (!enrolled.isEmpty()) {
            throw ApiException.conflict("course_in_use", enrolled.size() + " student(s) are still enrolled ("
                    + String.join(", ", enrolled.stream().limit(5).toList()) + (enrolled.size() > 5 ? ", …" : "")
                    + "). Remove them from the course first, or archive it to keep their history.");
        }
        var c = jdbc.sql("""
                SELECT (SELECT count(*) FROM chapters WHERE course_id = :id),
                       (SELECT count(*) FROM lessons WHERE course_id = :id),
                       (SELECT count(*) FROM assessments WHERE course_id = :id),
                       (SELECT count(*) FROM enrollments e WHERE e.course_id = :id AND (
                            EXISTS (SELECT 1 FROM lesson_progress p WHERE p.user_id = e.user_id AND p.course_id = e.course_id)
                         OR EXISTS (SELECT 1 FROM practice_assignments a WHERE a.user_id = e.user_id AND a.course_id = e.course_id)
                         OR EXISTS (SELECT 1 FROM assessment_attempts t WHERE t.user_id = e.user_id AND t.course_id = e.course_id)))
                """).param("id", id)
                .query((rs, n) -> new long[] {rs.getLong(1), rs.getLong(2), rs.getLong(3), rs.getLong(4)}).single();
        long chapters = c[0], lessons = c[1], sets = c[2], formerWithHistory = c[3];
        // Wiping students' history is a decision about people: administrators only.
        if (formerWithHistory > 0 && !p.isAdmin()) {
            throw ApiException.forbidden("This course still holds the progress and attempts of " + formerWithHistory
                    + " removed student(s); only an administrator can delete it");
        }
        if (!everything && chapters + sets + formerWithHistory > 0) {
            List<String> parts = new ArrayList<>();
            if (chapters > 0) parts.add(chapters + " chapter(s) with " + lessons + " lesson(s)");
            if (sets > 0) parts.add(sets + " practice set(s)");
            if (formerWithHistory > 0) parts.add("the progress and attempts of " + formerWithHistory + " removed student(s)");
            throw new ApiException(HttpStatus.CONFLICT, "course_not_empty",
                    "This course still contains " + (parts.size() == 1 ? parts.getFirst()
                            : String.join(", ", parts.subList(0, parts.size() - 1)) + " and " + parts.getLast())
                            + ". Delete it with everything in it?",
                    Map.of("chapters", chapters, "lessons", lessons, "practiceSets", sets, "formerStudentsWithHistory", formerWithHistory));
        }
        // Math templates placed on the course, its chapters or lessons move up to the course's subject (or nowhere).
        jdbc.sql("""
                UPDATE math_templates SET subject_id = (SELECT subject_id FROM courses WHERE id = :id),
                       course_id = NULL, chapter_id = NULL, lesson_id = NULL
                WHERE course_id = :id OR chapter_id IN (SELECT id FROM chapters WHERE course_id = :id)
                   OR lesson_id IN (SELECT id FROM lessons WHERE course_id = :id)
                """).param("id", id).update();
        // Children first (no ON DELETE CASCADE in the schema). Removed students' history goes with the course.
        String attempts = "SELECT id FROM assessment_attempts WHERE course_id = :id";
        String practiceSets = "SELECT id FROM assessments WHERE course_id = :id";
        String sections = "SELECT s.id FROM lesson_sections s JOIN lessons l ON l.id = s.lesson_id WHERE l.course_id = :id";
        for (String sql : List.of(
                "DELETE FROM attempt_answers WHERE attempt_id IN (" + attempts + ")",
                "DELETE FROM attempt_item_options WHERE item_id IN (SELECT id FROM attempt_items WHERE attempt_id IN (" + attempts + "))",
                "DELETE FROM attempt_items WHERE attempt_id IN (" + attempts + ")",
                "DELETE FROM assessment_attempts WHERE course_id = :id",
                "DELETE FROM practice_assignments WHERE course_id = :id",
                "DELETE FROM practice_set_rules WHERE assessment_id IN (" + practiceSets + ")",
                "DELETE FROM assessment_questions WHERE assessment_id IN (" + practiceSets + ")",
                "DELETE FROM assessments WHERE course_id = :id",
                "DELETE FROM lesson_progress WHERE course_id = :id",
                "DELETE FROM lesson_section_templates WHERE section_id IN (" + sections + ")",
                "DELETE FROM lesson_sections WHERE lesson_id IN (SELECT id FROM lessons WHERE course_id = :id)",
                "DELETE FROM lessons WHERE course_id = :id",
                "DELETE FROM chapters WHERE course_id = :id",
                "DELETE FROM enrollments WHERE course_id = :id",
                "DELETE FROM course_teachers WHERE course_id = :id",
                "DELETE FROM courses WHERE id = :id")) {
            jdbc.sql(sql).param("id", id).update();
        }
    }

    // ------------------------------------------------------------------ reorder (Content Tree arrows / drag and drop)

    @PostMapping("/courses/reorder")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void reorderCourses(@Valid @RequestBody ReorderRequest req) {
        currentUser.requireContent();
        List<UUID> ids = siblings("courses", "subject_id", req.ids(), "Course", false);
        for (int i = 0; i < ids.size(); i++) {
            jdbc.sql("UPDATE courses SET display_order = :o WHERE id = :id").param("o", i + 1).param("id", ids.get(i)).update();
        }
    }

    @PostMapping("/chapters/reorder")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void reorderChapters(@Valid @RequestBody ReorderRequest req) {
        currentUser.requireContent();
        renumber("chapters", siblings("chapters", "course_id", req.ids(), "Chapter", true));
    }

    @PostMapping("/lessons/reorder")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void reorderLessons(@Valid @RequestBody ReorderRequest req) {
        currentUser.requireContent();
        renumber("lessons", siblings("lessons", "chapter_id", req.ids(), "Lesson", true));
    }

    /**
     * Lock and check a reorder list: every id exists and all share one parent. With {@code complete}, the list must
     * name every sibling (positions are renumbered 1..n).
     */
    private List<UUID> siblings(String table, String parentColumn, List<UUID> requested, String what, boolean complete) {
        List<UUID> ids = requested.stream().distinct().toList();
        var parents = jdbc.sql("SELECT " + parentColumn + " FROM " + table + " WHERE id IN (:ids) FOR UPDATE")
                .param("ids", ids).query((rs, n) -> Optional.ofNullable(rs.getObject(1, UUID.class))).list();
        if (parents.size() != ids.size()) {
            throw ApiException.notFound(what);
        }
        if (parents.stream().distinct().count() != 1) {
            throw ApiException.badRequest("invalid_order", "Only items under the same parent can be reordered together");
        }
        if (complete) {
            long all = jdbc.sql("SELECT count(*) FROM " + table + " WHERE " + parentColumn + " = :p")
                    .param("p", parents.getFirst().orElse(null)).query(Long.class).single();
            if (all != ids.size()) {
                throw ApiException.badRequest("invalid_order", "The new order must list every item under the same parent");
            }
        }
        return ids;
    }

    /** Set position = list order (two steps to respect the unique position index). */
    private void renumber(String table, List<UUID> ids) {
        jdbc.sql("UPDATE " + table + " SET position = position + 100000 WHERE id IN (:ids)").param("ids", ids).update();
        for (int i = 0; i < ids.size(); i++) {
            jdbc.sql("UPDATE " + table + " SET position = :p WHERE id = :id").param("p", i + 1).param("id", ids.get(i)).update();
        }
    }

    /** Renumber siblings after a delete so positions stay 1..n (two steps to respect the unique position index). */
    private void closeGap(String table, String parentColumn, UUID parentId, int removedPosition) {
        String sql = "UPDATE " + table + " SET position = position + 100000 WHERE " + parentColumn + " = :p AND position > :pos";
        jdbc.sql(sql).param("p", parentId).param("pos", removedPosition).update();
        jdbc.sql("UPDATE " + table + " SET position = position - 100001 WHERE " + parentColumn + " = :p AND position > 100000")
                .param("p", parentId).update();
    }
}
