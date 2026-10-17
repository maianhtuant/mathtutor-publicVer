-- A template's place: one subject, course, chapter or lesson (at most one is set). The chapter, course and subject
-- above a lesson are derived when read, so moving a lesson or changing a course's subject carries its templates along.
ALTER TABLE math_templates
    ADD COLUMN course_id UUID REFERENCES courses(id),
    ADD COLUMN chapter_id UUID REFERENCES chapters(id),
    ADD COLUMN lesson_id UUID REFERENCES lessons(id),
    ADD CONSTRAINT math_templates_one_place CHECK (num_nonnulls(subject_id, course_id, chapter_id, lesson_id) <= 1);
CREATE INDEX math_templates_course ON math_templates(course_id);
CREATE INDEX math_templates_chapter ON math_templates(chapter_id);
CREATE INDEX math_templates_lesson ON math_templates(lesson_id);
