package com.mathtutor.content;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.mathtutor.common.ApiException;
import com.mathtutor.practice.QuickPracticeService;
import com.mathtutor.security.CurrentUser;
import com.mathtutor.videos.VideoUrlParser;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/** Student-facing catalogue, enrollment, lessons and study heartbeats. */
@RestController
@RequestMapping("/api")
public class CourseController {

    /** Heartbeat: seconds studied since the last beat (server-capped) and optional progress. */
    public record ProgressRequest(@Min(0) @Max(3600) Integer activeSeconds, @Min(0) @Max(100) Integer progressPercent,
                                  Boolean completed) {}

    static final int MAX_HEARTBEAT_SECONDS = 60;
    static final int MIN_HEARTBEAT_GAP_SECONDS = 5;

    private final JdbcClient jdbc;
    private final CurrentUser currentUser;
    private final QuickPracticeService practice;

    public CourseController(JdbcClient jdbc, CurrentUser currentUser, QuickPracticeService practice) {
        this.jdbc = jdbc;
        this.currentUser = currentUser;
        this.practice = practice;
    }

    @GetMapping("/courses")
    public List<Map<String, Object>> catalogue() {
        var me = currentUser.require();
        return jdbc.sql("""
                SELECT c.id, c.title, c.description,
                       (SELECT count(*) FROM lessons l WHERE l.course_id = c.id AND l.status = 'published') AS "lessonCount",
                       EXISTS (SELECT 1 FROM enrollments e WHERE e.course_id = c.id AND e.user_id = :u AND e.status = 'active') AS "enrolled",
                       s.completion_percent AS "completionPercent"
                FROM courses c
                LEFT JOIN course_learning_summary s ON s.course_id = c.id AND s.user_id = :u
                WHERE c.status = 'published'
                ORDER BY c.title
                """).param("u", me.id()).query().listOfRows();
    }

    @GetMapping("/courses/{id}")
    public Map<String, Object> course(@PathVariable UUID id) {
        var me = currentUser.require();
        var rows = jdbc.sql("""
                SELECT c.id, c.title, c.description, c.readiness, s.id AS "subjectId", s.name AS "subjectName",
                       EXISTS (SELECT 1 FROM enrollments e WHERE e.course_id = c.id AND e.user_id = :u AND e.status = 'active') AS "enrolled"
                FROM courses c LEFT JOIN subjects s ON s.id = c.subject_id
                WHERE c.id = :id AND c.status = 'published'
                """).param("id", id).param("u", me.id()).query().listOfRows();
        if (rows.isEmpty()) {
            throw ApiException.notFound("Course");
        }
        Map<String, Object> course = new LinkedHashMap<>(rows.getFirst());
        List<Map<String, Object>> chapters = outline(id, me.id());
        course.put("chapters", chapters);
        course.put("chapterCount", chapters.size());
        long published = 0;
        Object continueLesson = null;
        for (var ch : chapters) {
            @SuppressWarnings("unchecked")
            var lessons = (List<Map<String, Object>>) ch.get("lessons");
            published += lessons.size();
            for (var l : lessons) {
                if (continueLesson == null && !"completed".equals(l.get("progressStatus"))) {
                    continueLesson = Map.of("id", l.get("id"), "title", l.get("title"));
                }
            }
        }
        course.put("publishedLessonCount", published);
        course.put("continueLesson", continueLesson);
        return course;
    }

    /** Chapters with their published lessons and the caller's progress (course page and lesson sidebar). */
    private List<Map<String, Object>> outline(UUID courseId, UUID userId) {
        List<Map<String, Object>> chapters = new ArrayList<>();
        for (var ch : jdbc.sql("SELECT id, title, position FROM chapters WHERE course_id = :id ORDER BY position")
                .param("id", courseId).query().listOfRows()) {
            Map<String, Object> c = new LinkedHashMap<>(ch);
            c.put("lessons", jdbc.sql("""
                    SELECT l.id, l.title, l.position, l.free_preview AS "freePreview",
                           COALESCE(p.status, 'not_started') AS "progressStatus",
                           COALESCE(p.progress_percent, 0) AS "progressPercent"
                    FROM lessons l LEFT JOIN lesson_progress p ON p.lesson_id = l.id AND p.user_id = :u
                    WHERE l.chapter_id = :ch AND l.status = 'published' ORDER BY l.position
                    """).param("ch", ch.get("id")).param("u", userId).query().listOfRows());
            chapters.add(c);
        }
        return chapters;
    }

    /** Self-enrollment unlocks lessons only; it never grants practice-set access. */
    @PostMapping("/courses/{id}/enroll")
    public Map<String, Object> enroll(@PathVariable UUID id) {
        var me = currentUser.require();
        jdbc.sql("SELECT id FROM courses WHERE id = :id AND status = 'published'").param("id", id).query(UUID.class)
                .optional().orElseThrow(() -> ApiException.notFound("Course"));
        jdbc.sql("INSERT INTO enrollments (user_id, course_id) VALUES (:u, :c) ON CONFLICT (user_id, course_id) DO UPDATE SET status = 'active', removed_at = NULL, removed_by = NULL")
                .param("u", me.id()).param("c", id).update();
        return course(id);
    }

    @GetMapping("/lessons/{id}")
    public Map<String, Object> lesson(@PathVariable UUID id) {
        var me = currentUser.require();
        var rows = jdbc.sql("""
                SELECT l.id, l.title, l.goal, l.content, l.video_url AS "videoUrl", l.position, l.free_preview AS "freePreview",
                       l.course_id AS "courseId", c.title AS "courseTitle",
                       ch.id AS "chapterId", ch.title AS "chapterTitle", ch.position AS "chapterPosition",
                       COALESCE(p.status, 'not_started') AS "progressStatus",
                       COALESCE(p.progress_percent, 0) AS "progressPercent", COALESCE(p.active_seconds, 0) AS "activeSeconds",
                       EXISTS (SELECT 1 FROM enrollments e WHERE e.course_id = l.course_id AND e.user_id = :u AND e.status = 'active') AS "enrolled"
                FROM lessons l JOIN courses c ON c.id = l.course_id JOIN chapters ch ON ch.id = l.chapter_id
                LEFT JOIN lesson_progress p ON p.lesson_id = l.id AND p.user_id = :u
                WHERE l.id = :id AND l.status = 'published' AND c.status = 'published'
                """).param("id", id).param("u", me.id()).query().listOfRows();
        if (rows.isEmpty()) {
            throw ApiException.notFound("Lesson");
        }
        Map<String, Object> lesson = new LinkedHashMap<>(rows.getFirst());
        // Staff may open any lesson ("View as student"); students need enrollment or a free preview.
        if (!me.isStaff() && !Boolean.TRUE.equals(lesson.get("enrolled")) && !Boolean.TRUE.equals(lesson.get("freePreview"))) {
            throw ApiException.forbidden("Enroll in the course to study this lesson");
        }
        lesson.put("embedUrl", embedUrl((String) lesson.get("videoUrl")));
        List<Map<String, Object>> sections = new ArrayList<>();
        for (var s : jdbc.sql("""
                SELECT s.id, s.position, s.title, s.video_url AS "videoUrl", s.explanation, s.transcript,
                       s.worked_example AS "workedExample", s.practice_hint AS "practiceHint",
                       p.total AS "practiceCount", p.labels AS "practiceLabel", COALESCE(p.total, 0) > 0 AS "hasPractice"
                FROM lesson_sections s
                LEFT JOIN LATERAL (
                    SELECT sum(r.question_count) AS total, string_agg(t.label, ', ' ORDER BY r.position) AS labels
                    FROM lesson_section_templates r JOIN math_templates t ON t.id = r.math_template_id
                    WHERE r.section_id = s.id AND """ + USABLE_TEMPLATE + """

                ) p ON TRUE
                WHERE s.lesson_id = :id ORDER BY s.position
                """).param("id", id).query().listOfRows()) {
            Map<String, Object> m = new LinkedHashMap<>(s);
            m.put("embedUrl", embedUrl((String) s.get("videoUrl")));
            sections.add(m);
        }
        lesson.put("sections", sections);
        var chapters = outline((UUID) lesson.get("courseId"), me.id());
        lesson.put("outline", chapters);
        // Previous / next published lesson across chapters.
        List<Object> order = new ArrayList<>();
        for (var ch : chapters) {
            @SuppressWarnings("unchecked")
            var ls = (List<Map<String, Object>>) ch.get("lessons");
            ls.forEach(l -> order.add(l.get("id")));
        }
        int at = order.indexOf(id);
        lesson.put("previousLessonId", at > 0 ? order.get(at - 1) : null);
        lesson.put("nextLessonId", at >= 0 && at < order.size() - 1 ? order.get(at + 1) : null);
        return lesson;
    }

    private static String embedUrl(String url) {
        var parsed = VideoUrlParser.parse(url);
        return VideoUrlParser.embedUrl(parsed.provider(), parsed.embedId());
    }

    // ------------------------------------------------------------------ section practice (inline, ungraded)

    /** Problem number {@code index} (0-based) of the section's practice: rows are used in order, e.g. 2 x LCM then 1 x GCF. */
    @PostMapping("/sections/{id}/practice")
    public Map<String, Object> sectionPractice(@PathVariable UUID id,
                                               @org.springframework.web.bind.annotation.RequestParam(defaultValue = "0") int index) {
        var me = currentUser.require();
        List<UUID> sequence = practiceSequence(me, id);
        return practice.question(me.id(), "section:" + id, sequence.get(Math.floorMod(index, sequence.size())));
    }

    @PostMapping("/sections/{id}/practice/check")
    public Map<String, Object> checkSectionPractice(@PathVariable UUID id, @Valid @RequestBody QuickPracticeService.CheckRequest req) {
        var me = currentUser.require();
        practiceSequence(me, id);
        return practice.check(me.id(), "section:" + id, req);
    }

    /** Templates usable for practice: active with a published, gradable version. */
    // Leading space on purpose: text blocks drop the trailing space of the "... AND" they are appended to.
    private static final String USABLE_TEMPLATE = " t.active AND EXISTS (SELECT 1 FROM math_template_versions v"
            + " WHERE v.template_id = t.id AND v.status = 'published' AND v.answer_mode <> 'display_only') ";

    /**
     * The section's practice as one template id per problem (rows expanded in order), for a caller who may study
     * it (enrolled, administrator, or the lesson is a free preview).
     */
    private List<UUID> practiceSequence(CurrentUser.Principal me, UUID sectionId) {
        var row = jdbc.sql("""
                SELECT l.free_preview,
                       EXISTS (SELECT 1 FROM enrollments e WHERE e.course_id = l.course_id AND e.user_id = :u AND e.status = 'active') AS enrolled
                FROM lesson_sections s JOIN lessons l ON l.id = s.lesson_id JOIN courses c ON c.id = l.course_id
                WHERE s.id = :id AND l.status = 'published' AND c.status = 'published'
                """).param("id", sectionId).param("u", me.id())
                .query((rs, n) -> new boolean[] {rs.getBoolean(1), rs.getBoolean(2)})
                .optional().orElseThrow(() -> ApiException.notFound("Section"));
        if (!me.isStaff() && !row[0] && !row[1]) {
            throw ApiException.forbidden("Enroll in the course to practise this section");
        }
        List<UUID> sequence = new ArrayList<>();
        jdbc.sql("""
                SELECT r.math_template_id, r.question_count FROM lesson_section_templates r
                JOIN math_templates t ON t.id = r.math_template_id
                WHERE r.section_id = :s AND """ + USABLE_TEMPLATE + " ORDER BY r.position")
                .param("s", sectionId)
                .query((rs, n) -> { for (int i = 0; i < rs.getInt(2); i++) sequence.add(rs.getObject(1, UUID.class)); return null; })
                .list();
        if (sequence.isEmpty()) {
            throw ApiException.notFound("Practice for this section");
        }
        return sequence;
    }

    @PostMapping("/lessons/{id}/progress")
    @Transactional
    public Map<String, Object> progress(@PathVariable UUID id, @Valid @RequestBody ProgressRequest req) {
        var me = currentUser.require();
        UUID courseId = jdbc.sql("SELECT course_id FROM lessons WHERE id = :id AND status = 'published'")
                .param("id", id).query(UUID.class).optional().orElseThrow(() -> ApiException.notFound("Lesson"));
        requireEnrollment(me.id(), courseId);

        jdbc.sql("""
                INSERT INTO lesson_progress (user_id, lesson_id, course_id) VALUES (:u, :l, :c) ON CONFLICT DO NOTHING
                """).param("u", me.id()).param("l", id).param("c", courseId).update();
        var current = jdbc.sql("""
                SELECT status, progress_percent, last_accessed_at FROM lesson_progress
                WHERE user_id = :u AND lesson_id = :l FOR UPDATE
                """).param("u", me.id()).param("l", id)
                .query((rs, n) -> new Object[] {rs.getString(1), rs.getInt(2), rs.getObject(3, OffsetDateTime.class)})
                .single();
        String status = (String) current[0];
        int percent = (Integer) current[1];
        OffsetDateTime last = (OffsetDateTime) current[2];
        OffsetDateTime now = OffsetDateTime.now();

        // Server-validated study time: cap each beat and ignore duplicates arriving too quickly.
        long credit = 0;
        if (req.activeSeconds() != null && req.activeSeconds() > 0) {
            long sinceLast = last == null ? MAX_HEARTBEAT_SECONDS : Duration.between(last, now).getSeconds();
            if (sinceLast >= MIN_HEARTBEAT_GAP_SECONDS) {
                credit = Math.min(Math.min(req.activeSeconds(), MAX_HEARTBEAT_SECONDS), sinceLast);
            }
        }
        if (!"completed".equals(status)) {
            if (Boolean.TRUE.equals(req.completed()) || (req.progressPercent() != null && req.progressPercent() == 100)) {
                status = "completed";
                percent = 100;
            } else {
                percent = Math.min(99, Math.max(percent, req.progressPercent() == null ? percent : req.progressPercent()));
                status = "in_progress";
            }
        }
        jdbc.sql("""
                UPDATE lesson_progress SET status = :s, progress_percent = :p, active_seconds = active_seconds + :credit,
                       last_accessed_at = now(),
                       completed_at = CASE WHEN :s = 'completed' THEN COALESCE(completed_at, now()) ELSE NULL END
                WHERE user_id = :u AND lesson_id = :l
                """).param("s", status).param("p", percent).param("credit", credit).param("u", me.id())
                .param("l", id).update();
        return jdbc.sql("""
                SELECT status, progress_percent AS "progressPercent", active_seconds AS "activeSeconds",
                       completed_at AS "completedAt", :credit AS "creditedSeconds"
                FROM lesson_progress WHERE user_id = :u AND lesson_id = :l
                """).param("u", me.id()).param("l", id).param("credit", credit).query().singleRow();
    }

    private void requireEnrollment(UUID userId, UUID courseId) {
        boolean enrolled = jdbc.sql("SELECT count(*) FROM enrollments WHERE user_id = :u AND course_id = :c AND status = 'active'")
                .param("u", userId).param("c", courseId).query(Long.class).single() > 0;
        if (!enrolled) {
            throw ApiException.forbidden("Enroll in the course to study this lesson");
        }
    }
}
