-- Multiple choice: author-written wrong answers, as formulas over the template variables (e.g. "a+b").
-- Missing ones are filled with automatic distractors by the math-service.
ALTER TABLE math_template_versions ADD COLUMN wrong_answer_formulas JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(wrong_answer_formulas) = 'array');

-- Published practice sets can be edited. A removed row that past attempts reference is kept
-- (removed_at set) so those attempts stay valid; unreferenced rows are deleted outright.
ALTER TABLE practice_set_rules ADD COLUMN removed_at TIMESTAMPTZ;
ALTER TABLE practice_set_rules DROP CONSTRAINT practice_set_rules_assessment_id_position_key;
CREATE UNIQUE INDEX practice_set_rules_active_position ON practice_set_rules(assessment_id, position) WHERE removed_at IS NULL;

ALTER TABLE assessment_questions ADD COLUMN removed_at TIMESTAMPTZ;
ALTER TABLE assessment_questions DROP CONSTRAINT assessment_questions_assessment_id_position_key;
CREATE UNIQUE INDEX assessment_questions_active_position ON assessment_questions(assessment_id, position) WHERE removed_at IS NULL;
