-- Per-row answer mode in a practice set: the same template can be asked as fill-in (numeric) in one row and
-- as multiple choice in another. NULL = use the template's own answer mode.
ALTER TABLE practice_set_rules ADD COLUMN answer_mode VARCHAR(16)
    CHECK (answer_mode IS NULL OR answer_mode IN ('numeric', 'multiple_choice'));
