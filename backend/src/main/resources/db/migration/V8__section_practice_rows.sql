-- "Practice this section" can mix several templates, like a practice set:
-- each row = one template and how many problems it contributes, in order.
CREATE TABLE lesson_section_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES lesson_sections(id),
    position INTEGER NOT NULL CHECK (position > 0),
    math_template_id UUID NOT NULL REFERENCES math_templates(id),
    question_count SMALLINT NOT NULL CHECK (question_count BETWEEN 1 AND 20),
    UNIQUE (section_id, position)
);
CREATE INDEX lesson_section_templates_template ON lesson_section_templates(math_template_id);

INSERT INTO lesson_section_templates (section_id, position, math_template_id, question_count)
SELECT id, 1, math_template_id, practice_count FROM lesson_sections WHERE math_template_id IS NOT NULL;

DROP INDEX lesson_sections_template;
ALTER TABLE lesson_sections DROP COLUMN math_template_id;
ALTER TABLE lesson_sections DROP COLUMN practice_count;
