-- Course / lesson pages: readiness note, lesson goal, free-preview lessons, and lesson sections
-- (video + explanation / transcript / worked example + optional inline practice from a math template).

ALTER TABLE courses ADD COLUMN readiness VARCHAR(300);

ALTER TABLE lessons ADD COLUMN goal VARCHAR(500);
ALTER TABLE lessons ADD COLUMN free_preview BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE lesson_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID NOT NULL REFERENCES lessons(id),
    position INTEGER NOT NULL CHECK (position > 0),
    title VARCHAR(200) NOT NULL CHECK (btrim(title) <> ''),
    video_url VARCHAR(2000),
    explanation TEXT NOT NULL DEFAULT '',
    transcript TEXT,
    worked_example TEXT,
    math_template_id UUID REFERENCES math_templates(id),
    practice_count SMALLINT NOT NULL DEFAULT 2 CHECK (practice_count BETWEEN 1 AND 20),
    practice_hint TEXT,
    UNIQUE (lesson_id, position)
);
CREATE INDEX lesson_sections_template ON lesson_sections(math_template_id);
