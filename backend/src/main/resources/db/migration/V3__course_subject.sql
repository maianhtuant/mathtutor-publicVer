-- Content tree: subject -> course -> chapter -> lesson. Courses may stay unassigned.
ALTER TABLE courses ADD COLUMN subject_id UUID REFERENCES subjects(id);
CREATE INDEX courses_subject ON courses(subject_id);

-- Existing demo course belongs to Math when both exist.
UPDATE courses SET subject_id = (SELECT id FROM subjects WHERE lower(name) = 'math' AND parent_id IS NULL)
WHERE subject_id IS NULL AND title = 'Arithmetic Foundations';
