-- Admin-defined order of courses inside their subject (Content Tree arrows / drag and drop).
-- Existing courses keep their current order (creation time) within each subject.
ALTER TABLE courses ADD COLUMN display_order INTEGER NOT NULL DEFAULT 0;

UPDATE courses c SET display_order = o.n
FROM (SELECT id, row_number() OVER (PARTITION BY subject_id ORDER BY created_at) AS n FROM courses) o
WHERE o.id = c.id;
