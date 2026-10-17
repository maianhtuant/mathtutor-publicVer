-- Removing a student from a course keeps the enrollment row (lesson progress, practice attempts and
-- assignments reference it) and marks it removed; enrolling again reactivates it.
ALTER TABLE enrollments ADD COLUMN status VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed'));
ALTER TABLE enrollments ADD COLUMN removed_at TIMESTAMPTZ;
ALTER TABLE enrollments ADD COLUMN removed_by UUID REFERENCES users(id);

-- Learning summaries only cover current enrollments.
CREATE OR REPLACE VIEW course_learning_summary AS
SELECT e.user_id,
       e.course_id,
       c.title AS course_title,
       COUNT(l.id) AS total_lessons,
       COUNT(l.id) FILTER (WHERE p.status = 'completed') AS completed_lessons,
       COALESCE(
           ROUND(100.0 * COUNT(l.id) FILTER (WHERE p.status = 'completed')
                 / NULLIF(COUNT(l.id), 0), 2), 0
       ) AS completion_percent,
       COALESCE(SUM(p.active_seconds), 0) AS active_seconds,
       MAX(p.last_accessed_at) AS last_studied_at
FROM enrollments e
JOIN courses c ON c.id = e.course_id
LEFT JOIN lessons l ON l.course_id = e.course_id AND l.status = 'published'
LEFT JOIN lesson_progress p ON p.user_id = e.user_id AND p.lesson_id = l.id
WHERE e.status = 'active'
GROUP BY e.user_id, e.course_id, c.title;
