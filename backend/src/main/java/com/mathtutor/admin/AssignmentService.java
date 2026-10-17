package com.mathtutor.admin;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mathtutor.common.ApiException;

/**
 * Individual practice access (default deny). Lock order shared with attempts:
 * enrollment -> assignment -> attempt.
 */
@Service
public class AssignmentService {

    private final JdbcClient jdbc;

    public AssignmentService(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** Grant or regrant. Creates the course enrollment in the same transaction if needed. */
    @Transactional
    public Map<String, Object> grant(UUID adminId, UUID userId, UUID setId) {
        String role = jdbc.sql("SELECT role FROM users WHERE id = :id").param("id", userId).query(String.class)
                .optional().orElseThrow(() -> ApiException.notFound("User"));
        if (!"USER".equals(role)) {
            throw ApiException.badRequest("not_a_student", "Practice sets can only be assigned to student accounts");
        }
        UUID courseId = jdbc.sql("SELECT course_id FROM assessments WHERE id = :id").param("id", setId)
                .query(UUID.class).optional().orElseThrow(() -> ApiException.notFound("Practice set"));
        jdbc.sql("INSERT INTO enrollments (user_id, course_id) VALUES (:u, :c) ON CONFLICT (user_id, course_id) DO UPDATE SET status = 'active', removed_at = NULL, removed_by = NULL")
                .param("u", userId).param("c", courseId).update();
        jdbc.sql("SELECT 1 FROM enrollments WHERE user_id = :u AND course_id = :c FOR UPDATE")
                .param("u", userId).param("c", courseId).query(Integer.class).single();
        jdbc.sql("""
                INSERT INTO practice_assignments (user_id, assessment_id, course_id, status, granted_by)
                VALUES (:u, :a, :c, 'active', :by)
                ON CONFLICT (user_id, assessment_id) DO UPDATE
                SET status = 'active', granted_by = EXCLUDED.granted_by, granted_at = now(),
                    revoked_by = NULL, revoked_at = NULL
                """).param("u", userId).param("a", setId).param("c", courseId).param("by", adminId).update();
        return assignment(userId, setId);
    }

    /** Logical revocation: the record and every result are preserved. */
    @Transactional
    public Map<String, Object> revoke(UUID adminId, UUID userId, UUID setId) {
        UUID courseId = jdbc.sql("SELECT course_id FROM practice_assignments WHERE user_id = :u AND assessment_id = :a")
                .param("u", userId).param("a", setId).query(UUID.class).optional()
                .orElseThrow(() -> ApiException.notFound("Assignment"));
        jdbc.sql("SELECT 1 FROM enrollments WHERE user_id = :u AND course_id = :c FOR UPDATE")
                .param("u", userId).param("c", courseId).query(Integer.class).single();
        jdbc.sql("SELECT 1 FROM practice_assignments WHERE user_id = :u AND assessment_id = :a FOR UPDATE")
                .param("u", userId).param("a", setId).query(Integer.class).single();
        jdbc.sql("""
                UPDATE practice_assignments SET status = 'revoked', revoked_by = :by, revoked_at = now()
                WHERE user_id = :u AND assessment_id = :a AND status = 'active'
                """).param("by", adminId).param("u", userId).param("a", setId).update();
        return assignment(userId, setId);
    }

    /** Every set with this student's assignment status (for the admin matrix). */
    public List<Map<String, Object>> list(UUID userId) {
        jdbc.sql("SELECT id FROM users WHERE id = :id").param("id", userId).query(UUID.class).optional()
                .orElseThrow(() -> ApiException.notFound("User"));
        return jdbc.sql("""
                SELECT a.id AS "setId", a.title, a.status AS "setStatus", a.kind, c.title AS "courseTitle",
                       COALESCE(p.status, 'none') AS "assignment", p.granted_at AS "grantedAt",
                       p.revoked_at AS "revokedAt",
                       (SELECT count(*) FROM assessment_attempts t WHERE t.assessment_id = a.id AND t.user_id = :u)
                         AS "attempts"
                FROM assessments a JOIN courses c ON c.id = a.course_id
                LEFT JOIN practice_assignments p ON p.assessment_id = a.id AND p.user_id = :u
                WHERE a.status <> 'archived' OR p.user_id IS NOT NULL
                ORDER BY c.title, a.title
                """).param("u", userId).query().listOfRows();
    }

    private Map<String, Object> assignment(UUID userId, UUID setId) {
        return jdbc.sql("""
                SELECT user_id AS "userId", assessment_id AS "setId", course_id AS "courseId", status,
                       granted_by AS "grantedBy", granted_at AS "grantedAt", revoked_by AS "revokedBy",
                       revoked_at AS "revokedAt"
                FROM practice_assignments WHERE user_id = :u AND assessment_id = :a
                """).param("u", userId).param("a", setId).query().singleRow();
    }
}
