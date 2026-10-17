package com.mathtutor.progress;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.mathtutor.attempts.AttemptService;
import com.mathtutor.security.CurrentUser;

/** Personal progress (/api/me/...) and administrator reports (/api/admin/...). */
@RestController
@RequestMapping("/api")
public class ProgressController {

    private final JdbcClient jdbc;
    private final CurrentUser currentUser;
    private final AttemptService attempts;

    public ProgressController(JdbcClient jdbc, CurrentUser currentUser, AttemptService attempts) {
        this.jdbc = jdbc;
        this.currentUser = currentUser;
        this.attempts = attempts;
    }

    /** Only published sets, in enrolled courses, with an active assignment. */
    @GetMapping("/me/practice-sets")
    public List<Map<String, Object>> myPracticeSets() {
        var me = currentUser.require();
        return jdbc.sql("""
                SELECT a.id, a.title, a.kind, c.title AS "courseTitle", a.pass_percent AS "passPercent",
                       a.time_limit_seconds AS "timeLimitSeconds", a.max_attempts AS "maxAttempts",
                       (SELECT COALESCE(sum(question_count), 0) FROM practice_set_rules r WHERE r.assessment_id = a.id AND r.removed_at IS NULL)
                         + (SELECT count(*) FROM assessment_questions q WHERE q.assessment_id = a.id AND q.removed_at IS NULL) AS "questionCount",
                       (SELECT count(*) FROM assessment_attempts t WHERE t.assessment_id = a.id AND t.user_id = :u) AS "attemptsUsed",
                       (SELECT max(t.score) FROM assessment_attempts t WHERE t.assessment_id = a.id AND t.user_id = :u
                          AND t.status IN ('submitted', 'expired')) AS "bestScore",
                       (SELECT t.id FROM assessment_attempts t WHERE t.assessment_id = a.id AND t.user_id = :u
                          AND t.status = 'in_progress') AS "openAttemptId"
                FROM practice_assignments p
                JOIN assessments a ON a.id = p.assessment_id
                JOIN enrollments e ON e.user_id = p.user_id AND e.course_id = p.course_id AND e.status = 'active'
                JOIN courses c ON c.id = a.course_id
                WHERE p.user_id = :u AND p.status = 'active' AND a.status = 'published'
                ORDER BY c.title, a.title
                """).param("u", me.id()).query().listOfRows();
    }

    @GetMapping("/me/attempts")
    public List<Map<String, Object>> myAttempts() {
        return attemptHistory(currentUser.require().id());
    }

    @GetMapping("/me/progress")
    public Map<String, Object> myProgress() {
        return progress(currentUser.require().id());
    }

    // ----------------------------------------------------------------- admin

    @GetMapping("/admin/users/{userId}/practice-results")
    public Map<String, Object> practiceResults(@PathVariable UUID userId) {
        currentUser.requireStudentVisible(userId);
        Map<String, Object> out = progress(userId);
        out.put("attempts", attemptHistory(userId));
        return out;
    }

    @GetMapping("/admin/attempts/{id}")
    public Map<String, Object> attempt(@PathVariable UUID id) {
        UUID student = jdbc.sql("SELECT user_id FROM assessment_attempts WHERE id = :id").param("id", id).query(UUID.class)
                .optional().orElseThrow(() -> com.mathtutor.common.ApiException.notFound("Attempt"));
        currentUser.requireStudentVisible(student);
        return attempts.view(id, null, true);
    }

    @GetMapping("/admin/reports/learning")
    public Map<String, Object> learningReport(@RequestParam(required = false) UUID courseId) {
        // A teacher's report covers only their own students.
        var p = currentUser.requirePeople();
        UUID scope = CurrentUser.scopeParam(p);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("students", jdbc.sql("""
                SELECT s.user_id AS "userId", u.email, u.full_name AS "fullName", s.course_id AS "courseId",
                       s.course_title AS "courseTitle", s.total_lessons AS "totalLessons",
                       s.completed_lessons AS "completedLessons", s.completion_percent AS "completionPercent",
                       s.active_seconds AS "activeSeconds", s.last_studied_at AS "lastStudiedAt",
                       (SELECT count(*) FROM assessment_attempts t WHERE t.user_id = s.user_id AND t.course_id = s.course_id
                          AND t.status IN ('submitted', 'expired')) AS "finishedAttempts",
                       (SELECT round(avg(100.0 * t.score / t.max_score), 2) FROM assessment_attempts t
                          WHERE t.user_id = s.user_id AND t.course_id = s.course_id
                          AND t.status IN ('submitted', 'expired')) AS "avgScorePercent"
                FROM course_learning_summary s JOIN users u ON u.id = s.user_id
                WHERE (CAST(:c AS uuid) IS NULL OR s.course_id = :c) AND """ + CurrentUser.studentScope(p, "s.user_id") + """

                ORDER BY s.course_title, u.email
                """).param("c", courseId).param("scopeTeacher", scope).query().listOfRows());
        out.put("topics", jdbc.sql("""
                SELECT i.topic_code AS "topicCode", count(*) AS "totalQuestions",
                       count(*) FILTER (WHERE a.is_correct IS TRUE) AS "correctQuestions",
                       round(100.0 * count(*) FILTER (WHERE a.is_correct IS TRUE) / count(*), 2) AS "accuracyPercent"
                FROM attempt_items i
                JOIN assessment_attempts t ON t.id = i.attempt_id
                LEFT JOIN attempt_answers a ON a.attempt_id = i.attempt_id AND a.item_id = i.id
                WHERE t.status IN ('submitted', 'expired') AND (CAST(:c AS uuid) IS NULL OR t.course_id = :c)
                  AND """ + CurrentUser.studentScope(p, "t.user_id") + """

                GROUP BY i.topic_code ORDER BY i.topic_code
                """).param("c", courseId).param("scopeTeacher", scope).query().listOfRows());
        out.put("sets", jdbc.sql("""
                SELECT a.id AS "setId", a.title, c.title AS "courseTitle",
                       count(t.id) FILTER (WHERE t.status IN ('submitted', 'expired')) AS "finishedAttempts",
                       count(DISTINCT t.user_id) AS "students",
                       round(avg(100.0 * t.score / t.max_score) FILTER (WHERE t.status IN ('submitted', 'expired')), 2)
                         AS "avgScorePercent",
                       count(t.id) FILTER (WHERE t.passed) AS "passedAttempts"
                FROM assessments a JOIN courses c ON c.id = a.course_id
                LEFT JOIN assessment_attempts t ON t.assessment_id = a.id AND """ + CurrentUser.studentScope(p, "t.user_id") + """

                WHERE CAST(:c AS uuid) IS NULL OR a.course_id = :c
                GROUP BY a.id, a.title, c.title ORDER BY c.title, a.title
                """).param("c", courseId).param("scopeTeacher", scope).query().listOfRows());
        return out;
    }

    // ----------------------------------------------------------------- shared

    private List<Map<String, Object>> attemptHistory(UUID userId) {
        return jdbc.sql("""
                SELECT t.id, t.assessment_id AS "setId", a.title AS "setTitle", t.attempt_no AS "attemptNo", t.status,
                       t.started_at AS "startedAt", t.submitted_at AS "submittedAt", t.score, t.max_score AS "maxScore",
                       t.passed
                FROM assessment_attempts t JOIN assessments a ON a.id = t.assessment_id
                WHERE t.user_id = :u ORDER BY t.started_at DESC
                """).param("u", userId).query().listOfRows();
    }

    /**
     * Lessons: completion from published lessons. Practice: finished attempts only;
     * accuracy by topic is computed over all finished attempts.
     */
    private Map<String, Object> progress(UUID userId) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("courses", jdbc.sql("""
                SELECT course_id AS "courseId", course_title AS "courseTitle", total_lessons AS "totalLessons",
                       completed_lessons AS "completedLessons", completion_percent AS "completionPercent",
                       active_seconds AS "activeSeconds", last_studied_at AS "lastStudiedAt"
                FROM course_learning_summary WHERE user_id = :u ORDER BY course_title
                """).param("u", userId).query().listOfRows());
        out.put("recentLesson", jdbc.sql("""
                SELECT l.id, l.title, p.last_accessed_at AS "lastAccessedAt" FROM lesson_progress p
                JOIN lessons l ON l.id = p.lesson_id
                WHERE p.user_id = :u AND p.last_accessed_at IS NOT NULL ORDER BY p.last_accessed_at DESC LIMIT 1
                """).param("u", userId).query().listOfRows().stream().findFirst().orElse(null));
        out.put("practice", jdbc.sql("""
                SELECT a.id AS "setId", a.title, count(*) AS "finishedAttempts", max(t.score) AS "bestScore",
                       (array_agg(t.score ORDER BY t.submitted_at DESC))[1] AS "latestScore", max(t.max_score) AS "maxScore",
                       bool_or(t.passed) AS "everPassed"
                FROM assessment_attempts t JOIN assessments a ON a.id = t.assessment_id
                WHERE t.user_id = :u AND t.status IN ('submitted', 'expired')
                GROUP BY a.id, a.title ORDER BY a.title
                """).param("u", userId).query().listOfRows());
        out.put("topics", jdbc.sql("""
                SELECT i.topic_code AS "topicCode", count(*) AS "totalQuestions",
                       count(*) FILTER (WHERE a.is_correct IS TRUE) AS "correctQuestions",
                       round(100.0 * count(*) FILTER (WHERE a.is_correct IS TRUE) / count(*), 2) AS "accuracyPercent",
                       sum(COALESCE(a.awarded_points, 0)) AS "pointsEarned", sum(i.points) AS "pointsPossible"
                FROM attempt_items i
                JOIN assessment_attempts t ON t.id = i.attempt_id
                LEFT JOIN attempt_answers a ON a.attempt_id = i.attempt_id AND a.item_id = i.id
                WHERE t.user_id = :u AND t.status IN ('submitted', 'expired')
                GROUP BY i.topic_code ORDER BY "accuracyPercent"
                """).param("u", userId).query().listOfRows());
        out.put("statisticsBasis", "all finished attempts");
        return out;
    }
}
