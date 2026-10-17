-- Math templates belong to a subject from the subject tree (e.g. GED, Math > Pre-Algebra).
-- The old free-text "subject" column stays as a display copy of the subject's name.
ALTER TABLE math_templates ADD COLUMN subject_id UUID REFERENCES subjects(id);
CREATE INDEX math_templates_subject ON math_templates(subject_id);

UPDATE math_templates t SET subject_id = s.id
FROM subjects s
WHERE t.subject_id IS NULL AND lower(s.name) = lower(t.subject);
